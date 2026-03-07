// src/utils/slots.js
import { addMinutes, combineDateAndTime } from "./time";

/**
 * Genera slots por SALTOS de durationMin (no por stepMinutes).
 * Regla:
 * - Armamos la línea de tiempo ocupada (turnos + bloqueos), ordenada y mergeada
 * - Calculamos los gaps libres dentro de cada intervalo de trabajo
 * - En cada gap, los slots arrancan en gapStart y avanzan de a durationMin
 */
export function generateSlots({
  dateStr,
  intervals,
  durationMin,
  bufferMin = 0,
  now = null,
  existingAppointments = [],
}) {
  if (!Array.isArray(intervals) || intervals.length === 0) return [];

  const dur = Math.max(1, Number(durationMin || 30));
  const buf = Math.max(0, Number(bufferMin || 0));

  // ---- Helpers
  const toDate = (iso) => new Date(iso);
  const toISO = (d) => d.toISOString();

  function fmtHM(d) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function clampMinStart(start) {
    if (!now) return start;
    // no permitir slots que arrancan "antes de ahora"
    return start < now ? now : start;
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  // ---- Busy intervals (turnos/bloqueos)
  // buffer: para turnos, extendemos el "fin" con bufferMin (para que deje hueco)
  const busyRaw = (existingAppointments || [])
    .filter(Boolean)
    .map((b) => {
      const s = toDate(b.startAt);
      const e0 = toDate(b.endAt);
      const e = addMinutes(e0, buf); // buffer al final
      return { start: s, end: e };
    })
    .filter((x) => x.start < x.end)
    .sort((a, b) => a.start - b.start);

  // merge busy overlaps
  const busy = [];
  for (const b of busyRaw) {
    const last = busy[busy.length - 1];
    if (!last) busy.push({ ...b });
    else if (b.start <= last.end) {
      if (b.end > last.end) last.end = b.end;
    } else {
      busy.push({ ...b });
    }
  }

  const slots = [];

  // ---- Por cada intervalo de trabajo (ej 09:00-12:30)
  for (const it of intervals) {
    const workStart = combineDateAndTime(dateStr, it.start);
    const workEnd = combineDateAndTime(dateStr, it.end);
    if (!(workStart < workEnd)) continue;

    // recortar por now
    const startLimit = clampMinStart(workStart);

    // calcular gaps libres dentro de [startLimit, workEnd]
    // gaps = segmentos no ocupados por busy
    let cursor = startLimit;

    // busy relevantes dentro del tramo
    const relevant = busy.filter((b) => overlaps(cursor, workEnd, b.start, b.end));

    for (const b of relevant) {
      // gap antes del busy
      const gapStart = cursor;
      const gapEnd = b.start;

      // generar slots dentro del gap
      pushSlotsInGap(gapStart, gapEnd);

      // mover cursor al fin del busy
      if (b.end > cursor) cursor = b.end;
    }

    // gap final hasta workEnd
    pushSlotsInGap(cursor, workEnd);

    function pushSlotsInGap(gStart, gEnd) {
      if (!(gStart < gEnd)) return;

      // primer inicio posible
      let t = new Date(gStart);

      // si "now" cayó en medio del gap, ya está clampMinStart aplicado
      while (true) {
        const tEnd = addMinutes(t, dur);
        if (tEnd > gEnd) break;

        slots.push({
          startAt: toISO(t),
          endAt: toISO(tEnd),
          label: fmtHM(t),
        });

        // ✅ avanzamos por duración del servicio
        t = addMinutes(t, dur);
      }
    }
  }

  return slots;
}
