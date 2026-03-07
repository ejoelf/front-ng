// src/services/mock/mockWeekTemplate.js
import { loadDB, saveDB, migrateDB } from "./mockDb";

function formatLocalYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToDateStr(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatLocalYYYYMMDD(d);
}

function weekStartMonday(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const dow = d.getDay(); // 0 dom..6 sáb
  const diff = dow === 0 ? -6 : 1 - dow; // lunes inicio
  d.setDate(d.getDate() + diff);
  return formatLocalYYYYMMDD(d);
}

function dateInRange(dateStr, fromDateStr, toDateStr) {
  return dateStr >= fromDateStr && dateStr <= toDateStr;
}

export function listBlocksByRange({ fromDateStr, toDateStr, staffId = null }) {
  const db = migrateDB(loadDB());
  saveDB(db);

  return db.blocks
    .filter((b) => {
      if (!dateInRange(b.dateStr, fromDateStr, toDateStr)) return false;
      if (staffId && (b.staffId ?? null) !== staffId) return false;
      return true;
    })
    .slice()
    .sort((a, b) => (a.dateStr + a.start + a.id).localeCompare(b.dateStr + b.start + b.id));
}

export function listSpecialDaysByRange({ fromDateStr, toDateStr }) {
  const db = migrateDB(loadDB());
  saveDB(db);

  return (db.business.specialDays || [])
    .filter((d) => dateInRange(d.dateStr, fromDateStr, toDateStr))
    .slice()
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

export function copyBlocksFromWeekToWeek({ targetWeekDateStr, staffId = null, includeFullDay = true }) {
  const db = migrateDB(loadDB());

  const targetStart = weekStartMonday(targetWeekDateStr);
  const sourceStart = addDaysToDateStr(targetStart, -7);
  const sourceEnd = addDaysToDateStr(sourceStart, 6);

  const sourceBlocks = db.blocks.filter((b) => {
    if (!dateInRange(b.dateStr, sourceStart, sourceEnd)) return false;
    if (staffId && (b.staffId ?? null) !== staffId) return false;
    if (!includeFullDay && b.start === "00:00" && b.end === "23:59") return false;
    return true;
  });

  let created = 0;
  let skipped = 0;

  for (const b of sourceBlocks) {
    const newDateStr = addDaysToDateStr(b.dateStr, 7);

    const exists = db.blocks.some(
      (x) =>
        x.dateStr === newDateStr &&
        (x.staffId ?? null) === (b.staffId ?? null) &&
        x.start === b.start &&
        x.end === b.end &&
        (x.reason ?? "") === (b.reason ?? "")
    );

    if (exists) {
      skipped++;
      continue;
    }

    db.blocks.push({
      id: `bl_${crypto.randomUUID()}`,
      dateStr: newDateStr,
      staffId: b.staffId ?? null,
      start: b.start,
      end: b.end,
      reason: b.reason ?? "",
      createdAt: new Date().toISOString(),
    });
    created++;
  }

  saveDB(db);
  return { ok: true, created, skipped, sourceStart, targetStart };
}

export function copySpecialDaysFromWeekToWeek({ targetWeekDateStr }) {
  const db = migrateDB(loadDB());

  const targetStart = weekStartMonday(targetWeekDateStr);
  const sourceStart = addDaysToDateStr(targetStart, -7);
  const sourceEnd = addDaysToDateStr(sourceStart, 6);

  const sourceDays = (db.business.specialDays || []).filter((d) => dateInRange(d.dateStr, sourceStart, sourceEnd));

  let created = 0;
  let skipped = 0;

  for (const d of sourceDays) {
    const newDateStr = addDaysToDateStr(d.dateStr, 7);

    const exists = (db.business.specialDays || []).some((x) => x.dateStr === newDateStr);
    if (exists) {
      skipped++;
      continue;
    }

    db.business.specialDays.push({
      dateStr: newDateStr,
      open: Boolean(d.open),
      intervals: Array.isArray(d.intervals) ? d.intervals.map((i) => ({ start: i.start, end: i.end })) : [],
    });
    created++;
  }

  saveDB(db);
  return { ok: true, created, skipped, sourceStart, targetStart };
}

export function createRecurringBlocksFromWeek({ weekDateStr, staffId = null, includeFullDay = true }) {
  const db = migrateDB(loadDB());

  const start = weekStartMonday(weekDateStr);
  const end = addDaysToDateStr(start, 6);

  const weekBlocks = db.blocks.filter((b) => {
    if (!dateInRange(b.dateStr, start, end)) return false;
    if (staffId && (b.staffId ?? null) !== staffId) return false;
    if (!includeFullDay && b.start === "00:00" && b.end === "23:59") return false;
    return true;
  });

  let created = 0;
  let skipped = 0;

  for (const b of weekBlocks) {
    const dow = new Date(`${b.dateStr}T00:00:00`).getDay();

    const exists = (db.recurringBlocks || []).some(
      (x) =>
        Number(x.dayOfWeek) === Number(dow) &&
        (x.staffId ?? null) === (b.staffId ?? null) &&
        x.start === b.start &&
        x.end === b.end
    );

    if (exists) {
      skipped++;
      continue;
    }

    db.recurringBlocks.push({
      id: `rb_${crypto.randomUUID()}`,
      dayOfWeek: dow,
      staffId: b.staffId ?? null,
      start: b.start,
      end: b.end,
      reason: b.reason ?? "Bloqueo recurrente",
      createdAt: new Date().toISOString(),
    });

    created++;
  }

  saveDB(db);
  return { ok: true, created, skipped, weekStart: start };
}
