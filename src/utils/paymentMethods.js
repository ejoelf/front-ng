export const PAYMENT_OPTIONS = [
  { code: "cash", label: "Efectivo" },
  { code: "transfer", label: "Transferencia" },
  { code: "qr", label: "QR" },
  { code: "debit", label: "Débito" },
  { code: "credit", label: "Crédito" },
  { code: "other", label: "Otro" },
];

// Convierte textos viejos o variantes a un código estable
export function normalizePaymentMethod(input) {
  if (!input) return null;

  const s = String(input).trim().toLowerCase();

  // ya es código
  if (["cash", "transfer", "qr", "debit", "credit", "other"].includes(s)) return s;

  // textos comunes (legacy)
  if (s.includes("efect")) return "cash";
  if (s.includes("transf")) return "transfer";

  if (s.includes("qr")) return "qr";

  if (s.includes("déb") || s.includes("deb")) return "debit";
  if (s.includes("créd") || s.includes("cred")) return "credit";

  // si venía "Tarjeta" genérico
  if (s.includes("tarj")) return "credit";

  return "other";
}

// Para reportes: agrupar Débito + Crédito como "Tarjeta"
export function groupPaymentMethod(code) {
  if (code === "debit" || code === "credit") return "card";
  return code || "other";
}
