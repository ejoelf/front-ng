export const APPT_STATUS_LABEL = {
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  rescheduled: "Reprogramado",
  "no-show": "No asistió",
  completed: "Realizado", // <-- IMPORTANTE
};

export const INCOME_STATUS_LABEL = {
  pending: "Pendiente",
  paid: "Pagado",
  void: "Anulado",
  unpaid: "No pagado",
};

export const PAYMENT_METHOD_LABEL = {
  cash: "Efectivo",
  transfer: "Transferencia",
  qr: "QR",
  debit: "Débito",
  credit: "Crédito",
  other: "Otro",
  card: "Tarjeta", // (solo para agrupación si la usamos)
};

export function labelApptStatus(code) {
  return APPT_STATUS_LABEL[code] ?? (code || "-");
}
export function labelIncomeStatus(code) {
  return INCOME_STATUS_LABEL[code] ?? (code || "-");
}
export function labelPaymentMethod(code) {
  return PAYMENT_METHOD_LABEL[code] ?? (code || "-");
}
