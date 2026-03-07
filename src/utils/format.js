// src/utils/format.js

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function formatDateDMY(dateOrIso) {
  if (!dateOrIso) return "";

  const s = String(dateOrIso);

  // Si viene ISO (con T), usamos fecha local
  if (s.includes("T")) {
    const d = new Date(s);
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  // Si viene YYYY-MM-DD
  const dateStr = s.slice(0, 10);
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}-${m}-${y}`;
}

export function formatTimeHHMM(isoOrHHMM) {
  if (!isoOrHHMM) return "";

  const s = String(isoOrHHMM);

  // Si viene "09:00"
  if (!s.includes("T")) return s.slice(0, 5);

  // ISO => hora LOCAL (NO slice)
  const d = new Date(s);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
