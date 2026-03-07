export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function toTimeLabel(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
