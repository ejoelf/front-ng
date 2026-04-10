import api from "./http";

// 🔍 Obtener turno por código
export async function getAppointmentByCode(code) {
  const { data } = await api.get(`/appointments/by-code/${code}`);
  return data?.data;
}

// ❌ Cancelar turno por código
export async function cancelAppointmentByCode(code) {
  const { data } = await api.post(`/appointments/cancel-by-code/${code}`);
  return data?.data;
}

// 🔁 Reprogramar turno por código
export async function rescheduleAppointmentByCode({
  code,
  newStartAtISO,
  newStaffId,
}) {
  const { data } = await api.post(`/appointments/reschedule-by-code/${code}`, {
    newStartAtISO,
    newStaffId,
  });
  return data?.data;
}

// 📅 Obtener disponibilidad (reutilizamos lo que ya tenés)
export async function getAvailability({ dateStr, serviceId, staffId }) {
  const { data } = await api.get(`/appointments/availability`, {
    params: { dateStr, serviceId, staffId },
  });
  return data?.data?.slots || [];
}