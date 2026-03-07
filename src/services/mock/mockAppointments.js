// src/services/mock/mockAppointments.js
import { loadDB, saveDB, migrateDB } from "./mockDb";
import { addMinutes, combineDateAndTime } from "../../utils/time";
import { generateSlots } from "../../utils/slots";
import { hasOverlap, makeIncomeFromAppt, upsertClientInternal } from "./mockHelpers";
import { normalizePaymentMethod } from "../../utils/paymentMethods";

// ✅ scaffold para WhatsApp futuro
import { notifyAppointmentCreated } from "./notifications";

/* =================== SCHEDULE RESOLUTION =================== */

function getSpecialDay(db, dateStr) {
  return db.business.specialDays.find((d) => d.dateStr === dateStr) ?? null;
}

function resolveScheduleForStaff(db, staffId) {
  const st = db.staff.find((s) => s.id === staffId);
  return st?.scheduleOverride || db.business.schedule;
}

function isOpenOnDate(db, dateStr, staffId) {
  const special = getSpecialDay(db, dateStr);
  if (special) return special.open === true;

  const schedule = resolveScheduleForStaff(db, staffId);
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  return schedule.openDays.includes(day);
}

function intervalsForDate(db, dateStr, staffId) {
  const special = getSpecialDay(db, dateStr);
  if (special && special.open === true && Array.isArray(special.intervals)) return special.intervals;

  const schedule = resolveScheduleForStaff(db, staffId);
  return schedule.intervals;
}

function stepMinutesForStaff(db, staffId) {
  const schedule = resolveScheduleForStaff(db, staffId);
  return schedule.stepMinutes ?? 10;
}

function bufferMinForStaff(db, staffId) {
  const schedule = resolveScheduleForStaff(db, staffId);
  return schedule.bufferMin ?? 0;
}

/* =================== BUSY INTERVALS (turnos + bloqueos) =================== */

function getBusyIntervalsForSlots(db, { dateStr, staffId }) {
  const busy = [];

  // appointments
  for (const a of db.appointments) {
    if (a.status === "cancelled") continue;
    if (a.staffId !== staffId) continue;
    if (a.startAt.slice(0, 10) !== dateStr) continue;

    busy.push({
      id: a.id,
      startAt: a.startAt,
      endAt: a.endAt,
      status: a.status,
      staffId: a.staffId,
    });
  }

  // blocks (single date)
  for (const b of db.blocks) {
    if (b.dateStr !== dateStr) continue;
    if (b.staffId && b.staffId !== staffId) continue;

    const start = combineDateAndTime(dateStr, b.start);
    const end = combineDateAndTime(dateStr, b.end);

    busy.push({
      id: b.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      status: "blocked",
      staffId,
      reason: b.reason ?? "Bloqueo",
      recurring: false,
    });
  }

  // recurring blocks (weekly)
  const dow = new Date(`${dateStr}T00:00:00`).getDay();
  for (const rb of db.recurringBlocks || []) {
    if (Number(rb.dayOfWeek) !== dow) continue;
    if (rb.staffId && rb.staffId !== staffId) continue;

    const start = combineDateAndTime(dateStr, rb.start);
    const end = combineDateAndTime(dateStr, rb.end);

    busy.push({
      id: rb.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      status: "blocked",
      staffId,
      reason: rb.reason ?? "Bloqueo recurrente",
      recurring: true,
    });
  }

  return busy;
}

/* =================== CLIENT HYDRATION =================== */

function normPhone(v) {
  return String(v || "").trim();
}

/**
 * ✅ Devuelve un appointment "hidratado" con datos actuales del cliente (por teléfono)
 * - No pisa el DB, solo lo que se retorna
 * - Si el cliente está soft-deleted => no se usa
 * - NO pisa notes del turno (notes son de ese turno, no del cliente)
 */
function hydrateAppointmentClient(db, appt) {
  const ph = normPhone(appt.clientPhone);
  if (!ph) return appt;

  const c = (db.clients || []).find((x) => !x?.isDeleted && normPhone(x.phone) === ph);
  if (!c) return appt;

  const nextName = String(c.name || "").trim();
  const nextEmail = String(c.email || "").trim();

  return {
    ...appt,
    clientName: nextName || appt.clientName,
    clientEmail: nextEmail || (appt.clientEmail || ""),
    // ✅ notes del turno NO se tocan
  };
}

/* =================== API =================== */

export function listAppointments() {
  const db = migrateDB(loadDB());
  saveDB(db);
  return (db.appointments || []).map((a) => hydrateAppointmentClient(db, a));
}

export function listAppointmentsByDate({ dateStr, staffId }) {
  const db = migrateDB(loadDB());
  saveDB(db);

  return (db.appointments || [])
    .filter((a) => {
      const sameDate = a.startAt.slice(0, 10) === dateStr;
      const sameStaff = staffId ? a.staffId === staffId : true;
      return sameDate && sameStaff;
    })
    .map((a) => hydrateAppointmentClient(db, a));
}

export function getAvailableSlots({ dateStr, staffId, serviceId }) {
  const db = migrateDB(loadDB());
  saveDB(db);

  if (!isOpenOnDate(db, dateStr, staffId)) return [];

  const service = db.services.find((s) => s.id === serviceId);
  const durationMin = service?.durationMin ?? 30;

  const existingBusy = getBusyIntervalsForSlots(db, { dateStr, staffId });

  const now = (() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    if (todayStr !== dateStr) return null;
    return today;
  })();

  return generateSlots({
    dateStr,
    intervals: intervalsForDate(db, dateStr, staffId),
    stepMinutes: stepMinutesForStaff(db, staffId),
    durationMin,
    bufferMin: bufferMinForStaff(db, staffId),
    now,
    existingAppointments: existingBusy,
  });
}

export function createAppointment(apptDraft) {
  const db = migrateDB(loadDB());

  const service = db.services.find((s) => s.id === apptDraft.serviceId);
  const durationMin = service?.durationMin ?? 30;

  const start = new Date(apptDraft.startAt);
  const endAt = addMinutes(start, durationMin).toISOString();
  const dateStr = apptDraft.startAt.slice(0, 10);

  // ✅ sobreturno: si viene allowOverlap=true, no bloqueamos por solape
  const allowOverlap = Boolean(apptDraft.allowOverlap);

  if (!allowOverlap) {
    const busy = getBusyIntervalsForSlots(db, { dateStr, staffId: apptDraft.staffId }).map((x) => ({
      id: x.id,
      startAt: x.startAt,
      endAt: x.endAt,
      status: x.status === "blocked" ? "confirmed" : x.status,
    }));

    if (hasOverlap(busy, apptDraft.startAt, endAt)) {
      saveDB(db);
      return { ok: false, message: "Ese horario ya fue tomado/bloqueado. Elegí otro." };
    }
  }

  const appt = {
    ...apptDraft,
    endAt,
    status: apptDraft.status ?? "confirmed",
    allowOverlap,
  };

  db.appointments.push(appt);

  // ✅ el teléfono es la clave: si existe, completa/actualiza email/notes (sin pisar con vacío)
  upsertClientInternal(db, {
    name: appt.clientName,
    phone: appt.clientPhone,
    email: appt.clientEmail || "",
    notes: appt.notes || "",
  });

  db.incomes.push(makeIncomeFromAppt(appt));

  // normalize payment methods legacy
  for (const inc of db.incomes) {
    if (!inc) continue;
    inc.paymentMethod = normalizePaymentMethod(inc.paymentMethod);
  }

  saveDB(db);

  // ✅ Hook para WhatsApp / notificaciones futuras (no rompe si falla)
  try {
    notifyAppointmentCreated({ appointment: appt, business: db.business });
  } catch (e) {
    console.warn("notifyAppointmentCreated falló (mock):", e);
  }

  return { ok: true, appointment: appt };
}

export function cancelAppointment(appointmentId) {
  const db = migrateDB(loadDB());
  const a = db.appointments.find((x) => x.id === appointmentId);
  if (!a) return { ok: false, message: "Turno no encontrado" };
  a.status = "cancelled";

  const inc = db.incomes.find((i) => i.appointmentId === appointmentId);
  if (inc && inc.paidStatus !== "paid") {
    inc.paidStatus = "void";
    inc.paymentMethod = null;
    inc.amountFinal = 0;
  }

  saveDB(db);
  return { ok: true };
}

/**
 * ✅ Reprogramar con cambio de staff opcional
 * - newStaffId: si viene, mueve el turno a otro staff y valida contra agenda/bloqueos de ese staff
 */
export function rescheduleAppointment({ appointmentId, newStartAtISO, newStaffId }) {
  const db = migrateDB(loadDB());
  const a = db.appointments.find((x) => x.id === appointmentId);
  if (!a) return { ok: false, message: "Turno no encontrado" };
  if (a.status === "cancelled") return { ok: false, message: "No se puede reprogramar un turno cancelado" };

  const targetStaffId = String(newStaffId || "").trim() || a.staffId;

  // ✅ validar staff destino existe
  const st = db.staff.find((s) => s.id === targetStaffId);
  if (!st) {
    saveDB(db);
    return { ok: false, message: "Staff destino no encontrado" };
  }

  const service = db.services.find((s) => s.id === a.serviceId);
  const durationMin = service?.durationMin ?? 30;

  const newStart = new Date(newStartAtISO);
  const newEnd = addMinutes(newStart, durationMin).toISOString();
  const dateStr = newStartAtISO.slice(0, 10);

  // ✅ chequear solape contra el staff destino (y excluir este turno)
  const existingSameDay = db.appointments.filter(
    (x) =>
      x.staffId === targetStaffId &&
      x.startAt.slice(0, 10) === dateStr &&
      x.id !== a.id &&
      x.status !== "cancelled"
  );

  const blocksBusy = getBusyIntervalsForSlots(db, { dateStr, staffId: targetStaffId })
    .filter((x) => x.status === "blocked")
    .map((b) => ({ id: b.id, startAt: b.startAt, endAt: b.endAt, status: "confirmed" }));

  const busy = [...existingSameDay, ...blocksBusy];

  if (hasOverlap(busy, newStartAtISO, newEnd, a.id)) {
    saveDB(db);
    return { ok: false, message: "Ese horario está ocupado/bloqueado. Elegí otro." };
  }

  // ✅ aplicar cambios
  a.startAt = newStartAtISO;
  a.endAt = newEnd;
  a.status = "rescheduled";

  if (targetStaffId !== a.staffId) {
    a.staffId = targetStaffId;
    a.staffName = st.name || "Staff";
  }

  const inc = db.incomes.find((i) => i.appointmentId === a.id);
  if (inc) inc.date = dateStr;

  saveDB(db);
  return { ok: true };
}

export function updateAppointmentStatus(appointmentId, status) {
  const db = migrateDB(loadDB());
  const a = db.appointments.find((x) => x.id === appointmentId);
  if (!a) return { ok: false, message: "Turno no encontrado" };
  a.status = status;

  if (status === "no-show") {
    const inc = db.incomes.find((i) => i.appointmentId === appointmentId);
    if (inc && inc.paidStatus !== "paid") {
      inc.paidStatus = "void";
      inc.paymentMethod = null;
      inc.amountFinal = 0;
    }
  }

  saveDB(db);
  return { ok: true };
}

export function listAppointmentsByRange({ fromDateStr, toDateStr }) {
  const db = migrateDB(loadDB());
  saveDB(db);

  return (db.appointments || [])
    .filter((a) => {
      const d = a.startAt.slice(0, 10);
      return d >= fromDateStr && d <= toDateStr;
    })
    .slice()
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((a) => hydrateAppointmentClient(db, a));
}

export function listAppointmentsCSVRows({ fromDateStr, toDateStr }) {
  // ✅ hidratamos para que export salga con datos actuales del cliente
  const rows = listAppointmentsByRange({ fromDateStr, toDateStr }).map((a) => ({
    date: a.startAt.slice(0, 10),
    start: a.startAt.slice(11, 16),
    end: a.endAt.slice(11, 16),
    service: a.serviceName,
    staff: a.staffName,
    client: a.clientName,
    phone: a.clientPhone,
    status: a.status,
    channel: a.channel,
    price: a.price ?? 0,
    notes: a.notes ?? "",
  }));
  return rows;
}
