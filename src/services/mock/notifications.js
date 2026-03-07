// src/services/mock/notifications.js

const KEY = "tp_notifications_v1";

function loadQueue() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueueNotification(payload) {
  const items = loadQueue();
  const item = {
    id: `nt_${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    status: "pending", // pending | sent | failed
    payload,
  };
  items.push(item);
  saveQueue(items);
  return item;
}

export function listNotifications() {
  return loadQueue().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markNotificationSent(id) {
  const items = loadQueue();
  const it = items.find((x) => x.id === id);
  if (!it) return { ok: false, message: "No existe" };
  it.status = "sent";
  it.sentAt = new Date().toISOString();
  saveQueue(items);
  return { ok: true };
}

export function markNotificationFailed(id, errorMessage = "") {
  const items = loadQueue();
  const it = items.find((x) => x.id === id);
  if (!it) return { ok: false, message: "No existe" };
  it.status = "failed";
  it.error = String(errorMessage || "");
  it.failedAt = new Date().toISOString();
  saveQueue(items);
  return { ok: true };
}

/**
 * ✅ Hook que se llama al crear el turno.
 * Hoy: lo encola (mock).
 * Mañana (backend): acá pegamos WhatsApp real (Twilio / Meta API / WPP Cloud / etc).
 */
export function notifyAppointmentCreated({ appointment, business }) {
  if (!appointment) return;

  // armamos un payload “estable”
  const payload = {
    type: "appointment_created",
    to: appointment.clientPhone,
    businessName: business?.name ?? "",
    appointmentId: appointment.id,
    date: appointment.startAt?.slice(0, 10),
    time: appointment.startAt?.slice(11, 16),
    service: appointment.serviceName,
    staff: appointment.staffName,
    client: appointment.clientName,
    channel: appointment.channel,
  };

  const item = enqueueNotification(payload);

  // mock: log para debug
  console.log("📨 Notification queued (mock):", item);

  return item;
}
