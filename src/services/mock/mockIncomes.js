// src/services/mock/mockIncomes.js
import { loadDB, saveDB, migrateDB } from "./mockDb";
import { normalizePaymentMethod } from "../../utils/paymentMethods";

const ALLOWED = new Set(["pending", "unpaid", "paid", "void"]);

function pad2(n) {
  return String(n).padStart(2, "0");
}

// ✅ fecha LOCAL YYYY-MM-DD (evita UTC bugs)
function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function getIncomeByAppointmentId(appointmentId) {
  const db = migrateDB(loadDB());
  saveDB(db);
  return db.incomes.find((i) => i.appointmentId === appointmentId) ?? null;
}

export function listIncomesByDate(dateStr) {
  const db = migrateDB(loadDB());
  saveDB(db);
  return db.incomes.filter((i) => i.date === dateStr);
}

export function markIncomePaid({ incomeId, paymentMethod, amountFinal, paidDateStr }) {
  const db = migrateDB(loadDB());
  const income = db.incomes.find((i) => i.id === incomeId);
  if (!income) return { ok: false, message: "Ingreso no encontrado" };

  const method = normalizePaymentMethod(paymentMethod);
  if (!method) return { ok: false, message: "Elegí un método de pago válido" };

  const amt = Number(amountFinal);
  if (!Number.isFinite(amt) || amt < 0) return { ok: false, message: "Monto final inválido" };

  // ✅ IMPORTANTE: el cobro impacta en Caja en la fecha del cobro (no del servicio)
  const dateToUse = String(paidDateStr || "").trim() || todayLocalISO();

  income.paidStatus = "paid";
  income.paymentMethod = method;
  income.amountFinal = amt;
  income.date = dateToUse;

  saveDB(db);
  return { ok: true };
}

export function listIncomes() {
  const db = migrateDB(loadDB());
  saveDB(db);
  return db.incomes;
}

export function listIncomesByRange({ fromDateStr, toDateStr }) {
  const db = migrateDB(loadDB());
  saveDB(db);

  return db.incomes
    .filter((i) => i.date >= fromDateStr && i.date <= toDateStr)
    .slice()
    .sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
}

export function listIncomesCSVRows({ fromDateStr, toDateStr }) {
  const rows = listIncomesByRange({ fromDateStr, toDateStr }).map((i) => ({
    date: i.date,
    clientName: i.clientName,
    serviceName: i.serviceName,
    paidStatus: i.paidStatus,
    paymentMethod: i.paymentMethod ?? "",
    amountEstimated: i.amountEstimated ?? 0,
    amountFinal: i.amountFinal ?? "",
    appointmentId: i.appointmentId ?? "",
  }));
  return rows;
}

/**
 * Cambia estado sin pedir método/monto.
 * Reglas:
 * - NO permite setear "paid" desde acá: para eso usá markIncomePaid()
 * - void => anula (amountFinal=0, paymentMethod=null)
 * - pending/unpaid => resetea (amountFinal=null, paymentMethod=null)
 */
export function setIncomeStatus(incomeId, paidStatus) {
  const status = String(paidStatus || "").trim();

  if (!ALLOWED.has(status)) {
    return { ok: false, message: "Estado inválido" };
  }

  if (status === "paid") {
    return { ok: false, message: "Para marcar como cobrado usá el flujo de 'Cobrar' (método + monto)." };
  }

  const db = migrateDB(loadDB());
  const inc = db.incomes.find((x) => x.id === incomeId);
  if (!inc) return { ok: false, message: "Ingreso no encontrado" };

  inc.paidStatus = status;

  if (status === "void") {
    inc.amountFinal = 0;
    inc.paymentMethod = null;
  }

  if (status === "pending" || status === "unpaid") {
    inc.amountFinal = null;
    inc.paymentMethod = null;
  }

  saveDB(db);
  return { ok: true };
}

// ✅ Crear ingreso manual (Caja -> botón Nuevo)
export function createManualIncome({ dateStr, serviceId, serviceName, amount, paymentMethod, detail }) {
  const db = migrateDB(loadDB());

  const d = String(dateStr || "").trim();
  if (!d) return { ok: false, message: "Fecha inválida" };

  const method = normalizePaymentMethod(paymentMethod);
  if (!method) return { ok: false, message: "Elegí un método de pago válido" };

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, message: "Monto inválido" };

  const name = String(serviceName || "").trim() || "Otro";

  const inc = {
    id: `inc_${crypto.randomUUID()}`,
    appointmentId: null, // ✅ no viene de turno
    date: d,
    serviceId: serviceId || null,
    serviceName: name,
    clientName: name === "Otro" ? "Ingreso manual" : "Caja",
    amountEstimated: amt,
    amountFinal: amt,
    paymentMethod: method,
    paidStatus: "paid",
    detail: String(detail || "").trim(),
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
  };

  db.incomes = db.incomes || [];
  db.incomes.push(inc);

  saveDB(db);
  return { ok: true, income: inc };
}
