// src/services/mock/mockSchedule.js

export function getSpecialDay(db, dateStr) {
  return db.business.specialDays.find((d) => d.dateStr === dateStr) ?? null;
}

export function resolveScheduleForStaff(db, staffId) {
  const st = db.staff.find((s) => s.id === staffId);
  return st?.scheduleOverride || db.business.schedule;
}

export function isOpenOnDate(db, dateStr, staffId) {
  const special = getSpecialDay(db, dateStr);
  if (special) return special.open === true;

  const schedule = resolveScheduleForStaff(db, staffId);
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  return schedule.openDays.includes(day);
}

export function intervalsForDate(db, dateStr, staffId) {
  const special = getSpecialDay(db, dateStr);
  if (special && special.open === true && Array.isArray(special.intervals)) return special.intervals;

  const schedule = resolveScheduleForStaff(db, staffId);
  return schedule.intervals;
}

export function stepMinutesForStaff(db, staffId) {
  const schedule = resolveScheduleForStaff(db, staffId);
  return schedule.stepMinutes ?? 10;
}

export function bufferMinForStaff(db, staffId) {
  const schedule = resolveScheduleForStaff(db, staffId);
  return schedule.bufferMin ?? 0;
}
