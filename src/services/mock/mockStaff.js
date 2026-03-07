// src/services/mock/mockStaff.js
import { loadDB, saveDB, migrateDB } from "./mockDb";

export function listStaff() {
  const db = migrateDB(loadDB());
  saveDB(db);
  return db.staff;
}

export function createStaff(st) {
  const db = migrateDB(loadDB());

  db.staff.push(st);

  // ✅ PRO: si un servicio tiene allowedStaffIds definido (modo limitado)
  // agregamos automáticamente el nuevo staff para que aparezca en Booking.
  for (const sv of db.services) {
    if (!Array.isArray(sv.allowedStaffIds)) sv.allowedStaffIds = [];

    // Si la lista está vacía → significa “Todos” → no hace falta tocar nada
    if (sv.allowedStaffIds.length === 0) continue;

    // Si el servicio está limitado, sumamos al nuevo staff
    if (!sv.allowedStaffIds.includes(st.id)) {
      sv.allowedStaffIds.push(st.id);
    }
  }

  saveDB(db);
  return { ok: true };
}

export function deleteStaff(staffId) {
  const db = migrateDB(loadDB());
  db.staff = db.staff.filter((s) => s.id !== staffId);

  // opcional: limpiar allowedStaffIds en servicios
  for (const sv of db.services) {
    if (Array.isArray(sv.allowedStaffIds) && sv.allowedStaffIds.length) {
      sv.allowedStaffIds = sv.allowedStaffIds.filter((id) => id !== staffId);
    }
  }

  saveDB(db);
  return { ok: true };
}

export function updateStaff(staffId, patch) {
  const db = migrateDB(loadDB());
  const s = db.staff.find((x) => x.id === staffId);
  if (!s) return { ok: false, message: "Staff no encontrado" };
  Object.assign(s, patch);
  saveDB(db);
  return { ok: true };
}
