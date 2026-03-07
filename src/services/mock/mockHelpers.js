// src/services/mock/mockHelpers.js

function normPhone(v) {
  return String(v || "").trim();
}

function normName(v) {
  return String(v || "").trim();
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function makeIncomeFromAppt(appt) {
  return {
    id: `inc_${crypto.randomUUID()}`,
    appointmentId: appt.id,
    date: appt.startAt.slice(0, 10),
    serviceName: appt.serviceName,
    clientName: appt.clientName,
    amountEstimated: Number(appt.price ?? 0), // ✅ asegurar número
    amountFinal: null,
    paymentMethod: null,
    paidStatus: "pending", // pending | paid | unpaid | void
  };
}

/**
 * ✅ Upsert interno (con soft-delete safe)
 * - Si no existe: lo crea
 * - Si existe: completa campos sin pisar con vacío
 * - Si existe y está eliminado (isDeleted): NO lo revive, NO lo toca
 *
 * Regla de nombre (más segura):
 * - Solo actualiza nombre si el actual está vacío o es "Cliente"
 */
export function upsertClientInternal(db, payload) {
  const phone = normPhone(payload?.phone);
  if (!phone) return null;

  const name = normName(payload?.name);
  const email = String(payload?.email || "").trim();
  const notes = String(payload?.notes || "").trim();

  db.clients = db.clients || [];

  let c = db.clients.find((x) => normPhone(x.phone) === phone);

  // ✅ si existe pero está eliminado => NO revivir, no tocar
  if (c && c.isDeleted) return c;

  if (!c) {
    c = {
      id: `cl_${crypto.randomUUID()}`,
      name: name || "Cliente",
      phone,
      notes: notes || "",
      email: email || "",
      birthday: "",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // ✅ soft delete flags
      isDeleted: false,
      deletedAt: "",
    };

    db.clients.push(c);
    return c;
  }

  // ✅ asegurar campos (compat)
  if (!("notes" in c)) c.notes = "";
  if (!("email" in c)) c.email = "";
  if (!("birthday" in c)) c.birthday = "";
  if (!("tags" in c)) c.tags = [];
  if (!("createdAt" in c)) c.createdAt = new Date().toISOString();
  if (!("updatedAt" in c)) c.updatedAt = new Date().toISOString();
  if (!("isDeleted" in c)) c.isDeleted = false;
  if (!("deletedAt" in c)) c.deletedAt = "";

  // ✅ Nombre: solo si el actual es vacío o genérico
  if (name) {
    const currentName = normName(c.name);
    if (!currentName || currentName === "Cliente") {
      c.name = name;
    }
  }

  // ✅ si vienen email/notes, guardarlos (pero sin pisar con vacío)
  if (email) c.email = email;
  if (notes) c.notes = notes;

  c.updatedAt = new Date().toISOString();
  return c;
}

export function hasOverlap(existingItems, startAtISO, endAtISO, excludeId = null) {
  const start = new Date(startAtISO);
  const end = new Date(endAtISO);

  return existingItems.some((a) => {
    if (excludeId && a.id === excludeId) return false;

    // ✅ si es appointment cancelado, ignorar
    if (a.status && a.status === "cancelled") return false;

    const aStart = new Date(a.startAt);
    const aEnd = new Date(a.endAt);
    return overlaps(start, end, aStart, aEnd);
  });
}
