// src/services/mock/mockSlots.js
import { combineDateAndTime } from "../../utils/time";

export function getBusyIntervalsForSlots(db, { dateStr, staffId }) {
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
