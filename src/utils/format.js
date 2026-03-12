function pad2(n) {
  return String(n).padStart(2, "0");
}

const BUSINESS_TZ = "America/Argentina/Cordoba";

function toBusinessParts(dateLike) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(
    dateLike instanceof Date ? dateLike : new Date(dateLike)
  );

  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

export function formatDateDMY(dateOrIso) {
  if (!dateOrIso) return "";

  const s = String(dateOrIso);

  if (s.includes("T")) {
    const parts = toBusinessParts(new Date(s));
    return `${parts.day}-${parts.month}-${parts.year}`;
  }

  const dateStr = s.slice(0, 10);
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}-${m}-${y}`;
}

export function formatTimeHHMM(isoOrHHMM) {
  if (!isoOrHHMM) return "";

  const s = String(isoOrHHMM);

  if (!s.includes("T")) return s.slice(0, 5);

  const parts = toBusinessParts(new Date(s));
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}