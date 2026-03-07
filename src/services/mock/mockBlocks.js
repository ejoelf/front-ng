// src/services/mock/mockBlocks.js
import { loadDB, saveDB, migrateDB } from "./mockDb";

export function listBlocks() {
  const db = migrateDB(loadDB());
  saveDB(db);
  return db.blocks;
}

/* ===== RECURRING BLOCKS ===== */

export function listRecurringBlocks() {
  const db = migrateDB(loadDB());
  saveDB(db);
  return db.recurringBlocks;
}

export function createRecurringBlock(rb) {
  const db = migrateDB(loadDB());

  const exists = (db.recurringBlocks || []).some(
    (x) =>
      Number(x.dayOfWeek) === Number(rb.dayOfWeek) &&
      (x.staffId ?? null) === (rb.staffId ?? null) &&
      x.start === rb.start &&
      x.end === rb.end
  );
  if (exists) return { ok: false, message: "Ya existe una regla igual." };

  db.recurringBlocks.push(rb);
  saveDB(db);
  return { ok: true };
}

export function deleteRecurringBlock(id) {
  const db = migrateDB(loadDB());
  db.recurringBlocks = db.recurringBlocks.filter((x) => x.id !== id);
  saveDB(db);
  return { ok: true };
}

/* ===== SPECIAL DAYS ===== */

export function listSpecialDays() {
  const db = migrateDB(loadDB());
  saveDB(db);
  return db.business.specialDays;
}

export function createSpecialDay(day) {
  const db = migrateDB(loadDB());
  const exists = db.business.specialDays.some((d) => d.dateStr === day.dateStr);
  if (exists) return { ok: false, message: "Ya existe una excepción para esa fecha" };
  db.business.specialDays.push(day);
  saveDB(db);
  return { ok: true };
}

export function deleteSpecialDay(dateStr) {
  const db = migrateDB(loadDB());
  db.business.specialDays = db.business.specialDays.filter((d) => d.dateStr !== dateStr);
  saveDB(db);
  return { ok: true };
}

/* ===== BLOCKS CRUD ===== */

export function createBlock(block) {
  const db = migrateDB(loadDB());
  db.blocks.push(block);
  saveDB(db);
  return { ok: true };
}

export function deleteBlock(blockId) {
  const db = migrateDB(loadDB());
  db.blocks = db.blocks.filter((b) => b.id !== blockId);
  saveDB(db);
  return { ok: true };
}

export function blockFullDay({ dateStr, staffId = null, reason = "Bloqueo día completo" }) {
  const db = migrateDB(loadDB());

  const exists = db.blocks.some(
    (b) =>
      b.dateStr === dateStr &&
      (b.staffId ?? null) === (staffId ?? null) &&
      b.start === "00:00" &&
      b.end === "23:59"
  );
  if (exists) {
    saveDB(db);
    return { ok: false, message: "Ya existe un bloqueo de día completo para esa fecha/staff." };
  }

  db.blocks.push({
    id: `bl_${crypto.randomUUID()}`,
    dateStr,
    staffId,
    start: "00:00",
    end: "23:59",
    reason,
    createdAt: new Date().toISOString(),
  });

  saveDB(db);
  return { ok: true };
}
