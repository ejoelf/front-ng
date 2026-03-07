// src/services/mock/mockClients.js
import { loadDB, saveDB, migrateDB } from "./mockDb";

function normPhone(phone) {
  return String(phone || "").trim();
}

function normName(name) {
  return String(name || "").trim();
}

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

/**
 * ✅ Propaga cambios del cliente al resto del DB
 * - appointments: clientName / clientEmail
 * - incomes: clientName
 * - si cambia phone: migra referencias por phone
 */
function propagateClientChanges(db, { oldPhone, newPhone, name, email }) {
  const oldPh = normPhone(oldPhone);
  const newPh = normPhone(newPhone);

  // appointments
  db.appointments = db.appointments || [];
  for (const a of db.appointments) {
    const aPhone = normPhone(a.clientPhone);

    if (oldPh && aPhone === oldPh) {
      // ✅ si cambió el teléfono, migramos
      if (newPh && newPh !== oldPh) a.clientPhone = newPh;

      // ✅ actualizamos nombre/email para UI que no hidrata
      if (name) a.clientName = name;
      if (email) a.clientEmail = email;

      // no pisamos notes del turno
    }
  }

  // incomes (por appointmentId + clientName)
  db.incomes = db.incomes || [];
  for (const inc of db.incomes) {
    // Solo ingresos que vienen de turnos (appointmentId)
    if (!inc?.appointmentId) continue;

    const appt = db.appointments.find((a) => a.id === inc.appointmentId);
    if (!appt) continue;

    const apPhone = normPhone(appt.clientPhone);
    if (newPh ? apPhone === newPh : oldPh && apPhone === oldPh) {
      if (name) inc.clientName = name;
    }
  }
}

export function listClients() {
  const db = migrateDB(loadDB());
  saveDB(db);

  return (db.clients || [])
    .filter((c) => !c.isDeleted) // ✅ NO mostrar eliminados
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export function listAppointmentsByClientPhone(phone) {
  const db = migrateDB(loadDB());
  saveDB(db);

  const ph = normPhone(phone);
  return (db.appointments || [])
    .filter((a) => normPhone(a.clientPhone) === ph)
    .slice()
    .sort((a, b) => String(b.startAt || "").localeCompare(String(a.startAt || "")));
}

export function createClient(payload) {
  const db = migrateDB(loadDB());

  const name = normName(payload?.name);
  const phone = normPhone(payload?.phone);
  const email = String(payload?.email || "").trim();

  if (!name) return { ok: false, message: "Nombre inválido" };
  if (!phone) return { ok: false, message: "Teléfono/WhatsApp inválido" };
  if (!isValidEmail(email)) return { ok: false, message: "Email inválido" };

  db.clients = db.clients || [];

  // ✅ evitar duplicados por teléfono (si estaba eliminado, lo restauramos)
  const existing = db.clients.find((c) => normPhone(c.phone) === phone);

  if (existing) {
    if (existing.isDeleted) {
      existing.isDeleted = false;
      existing.deletedAt = "";
      existing.name = name;
      existing.email = email;
      existing.birthday = String(payload?.birthday || "").trim();
      existing.notes = String(payload?.notes || "").trim();
      existing.tags = Array.isArray(payload?.tags) ? payload.tags : [];
      existing.updatedAt = new Date().toISOString();

      // ✅ restaurado: también propagamos por las dudas
      propagateClientChanges(db, {
        oldPhone: existing.phone,
        newPhone: phone,
        name,
        email,
      });

      saveDB(db);
      return { ok: true, client: existing, restored: true };
    }

    return { ok: false, message: "Ya existe un cliente con ese teléfono" };
  }

  const client = {
    id: `cl_${crypto.randomUUID()}`,
    name,
    phone,
    birthday: String(payload?.birthday || "").trim(),
    email,
    notes: String(payload?.notes || "").trim(),
    tags: Array.isArray(payload?.tags) ? payload.tags : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // ✅ soft delete
    isDeleted: false,
    deletedAt: "",
  };

  db.clients.push(client);

  saveDB(db);
  return { ok: true, client };
}

export function updateClient(clientId, patch) {
  const db = migrateDB(loadDB());

  db.clients = db.clients || [];
  const c = db.clients.find((x) => x.id === clientId);
  if (!c) return { ok: false, message: "Cliente no encontrado" };
  if (c.isDeleted) return { ok: false, message: "No se puede editar un cliente eliminado" };

  const oldPhone = c.phone;

  const next = { ...c };

  if (patch?.name != null) next.name = normName(patch.name);
  if (patch?.phone != null) next.phone = normPhone(patch.phone);
  if (patch?.birthday != null) next.birthday = String(patch.birthday || "").trim();
  if (patch?.email != null) next.email = String(patch.email || "").trim();
  if (patch?.notes != null) next.notes = String(patch.notes || "").trim();
  if (patch?.tags != null) next.tags = Array.isArray(patch.tags) ? patch.tags : [];

  if (!next.name) return { ok: false, message: "Nombre inválido" };
  if (!next.phone) return { ok: false, message: "Teléfono/WhatsApp inválido" };
  if (!isValidEmail(next.email)) return { ok: false, message: "Email inválido" };

  // ✅ si cambia el phone, que no choque con otro (ignoramos eliminados)
  const phoneClash = db.clients.some(
    (x) => !x.isDeleted && x.id !== c.id && normPhone(x.phone) === normPhone(next.phone)
  );
  if (phoneClash) return { ok: false, message: "Ya existe otro cliente con ese teléfono" };

  Object.assign(c, next, { updatedAt: new Date().toISOString() });

  // ✅ propagación para que Agenda/Caja reflejen cambios aunque no hidraten
  propagateClientChanges(db, {
    oldPhone,
    newPhone: c.phone,
    name: c.name,
    email: c.email,
  });

  saveDB(db);
  return { ok: true };
}

export function deleteClient(clientId) {
  const db = migrateDB(loadDB());
  db.clients = db.clients || [];

  const c = db.clients.find((x) => x.id === clientId);
  if (!c) return { ok: false, message: "Cliente no encontrado" };

  // ✅ SOFT DELETE (para que migrateDB no lo recree desde appointments)
  c.isDeleted = true;
  c.deletedAt = new Date().toISOString();
  c.updatedAt = new Date().toISOString();

  saveDB(db);
  return { ok: true };
}
