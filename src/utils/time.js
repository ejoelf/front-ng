export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function parseHHMM(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return { h, m };
}

export function combineDateAndTime(dateStr, hhmm) {
  const { h, m } = parseHHMM(hhmm);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

export function toHHMM(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function isSameISODate(isoDateA, isoDateB) {
  return isoDateA === isoDateB;
}
  