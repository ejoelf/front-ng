// src/pages/Booking/Booking.jsx
import "./Booking.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { useToast } from "../../components/common/Toast";

import api from "../../services/http";
import { toISODate } from "../../utils/date";
import { formatDateDMY, formatTimeHHMM } from "../../utils/format";

function todayISO() {
  // ✅ fecha local (no UTC)
  return toISODate(new Date());
}

function safeTrim(v) {
  return String(v ?? "").trim();
}

// ✅ solo :00 y :30 (hora local)
function isHalfHourSlot(startAtISO) {
  const d = new Date(startAtISO);
  const m = d.getMinutes();
  return m === 0 || m === 30;
}

export default function Booking() {
  const navigate = useNavigate();
  const { show } = useToast();

  const toast = {
    success: (message, title = "") => show({ type: "success", title, message }),
    error: (message, title = "") => show({ type: "error", title, message }),
    info: (message, title = "") => show({ type: "info", title, message }),
    warning: (message, title = "") => show({ type: "warning", title, message }),
  };

  function resetBooking() {
    setDone(false);
    setDoneInfo(null);

    setSelectedSlot(null);
    setSlotError(false);

    setFirstName("");
    setLastName("");
    setClientPhone("");
    setEmail("");
    setNotes("");
  }

  // =============================
  // DATA REAL
  // =============================
  const [services, setServices] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);

  // =============================
  // STATES
  // =============================
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(todayISO());

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotError, setSlotError] = useState(false);

  // datos cliente
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [done, setDone] = useState(false);
  const [doneInfo, setDoneInfo] = useState(null);

  // =============================
  // FETCH BASE (services + staff)
  // =============================
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingBase(true);

        // 🔹 público: idealmente estos endpoints NO requieren token
        const [sv, st] = await Promise.all([api.get("/public/services"), api.get("/public/staff")]);

        if (!alive) return;

        const nextServices = Array.isArray(sv?.data?.services) ? sv.data.services : [];
        const nextStaff = Array.isArray(st?.data?.staff) ? st.data.staff : [];

        setServices(nextServices);
        setAllStaff(nextStaff);

        // set defaults
        if (!serviceId && nextServices[0]?.id) setServiceId(nextServices[0].id);
        if (!staffId && nextStaff[0]?.id) setStaffId(nextStaff[0].id);
      } catch (e) {
        if (!alive) return;
        toast.error(e?.response?.data?.error?.message || "No se pudo cargar Servicios/Staff.");
      } finally {
        if (alive) setLoadingBase(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4) staff filtrado según servicio (allowedStaffIds)
  const staff = useMemo(() => {
    const s = services.find((x) => x.id === serviceId);
    const allowed = s?.allowedStaffIds;
    if (!allowed || allowed.length === 0) return allStaff;
    return allStaff.filter((st) => allowed.includes(st.id));
  }, [allStaff, services, serviceId]);

  // 5) auto-fix: si cambia servicio y el staff actual ya no aplica
  useEffect(() => {
    if (!serviceId && services[0]?.id) {
      setServiceId(services[0].id);
    }
  }, [services, serviceId]);

  useEffect(() => {
    if (!staffId && staff[0]?.id) {
      setStaffId(staff[0].id);
      return;
    }
    if (staffId && staff.length > 0 && !staff.some((s) => s.id === staffId)) {
      setStaffId(staff[0].id);
      setSelectedSlot(null);
    }
  }, [staff, staffId]);

  const selectedService = services.find((s) => s.id === serviceId);
  const selectedStaff = staff.find((s) => s.id === staffId);

  // =============================
  // SLOTS REAL (backend)
  // =============================
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!serviceId || !staffId || !date) {
        setSlots([]);
        return;
      }

      try {
        setLoadingSlots(true);

        // ✅ endpoint sugerido: GET /api/availability?dateStr&staffId&serviceId
        const { data } = await api.get("/public/availability", {
          params: { dateStr: date, staffId, serviceId },
        });

        if (!alive) return;

        const raw = Array.isArray(data?.slots) ? data.slots : [];
        const normalized = raw
          .filter((sl) => sl?.startAt && isHalfHourSlot(sl.startAt))
          .map((sl) => ({
            ...sl,
            label: sl.label || formatTimeHHMM(sl.startAt),
          }));

        setSlots(normalized);
      } catch (e) {
        if (!alive) return;
        setSlots([]);
        toast.error(e?.response?.data?.error?.message || "No se pudieron cargar horarios.");
      } finally {
        if (alive) setLoadingSlots(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [serviceId, staffId, date]);

  // ✅ si el slot seleccionado deja de existir (cambio de fecha/staff/servicio), lo limpiamos
  useEffect(() => {
    if (!selectedSlot) return;
    const stillExists = slots.some((s) => s.startAt === selectedSlot.startAt);
    if (!stillExists) setSelectedSlot(null);
  }, [slots, selectedSlot]);

  function validate() {
    if (!selectedSlot) {
      setSlotError(true);
      toast.error("Elegí un horario disponible.");
      return false;
    }

    const fn = safeTrim(firstName);
    const ln = safeTrim(lastName);
    const ph = safeTrim(clientPhone);

    if (!fn) {
      toast.error("Poné el nombre.");
      return false;
    }
    if (!ln) {
      toast.error("Poné el apellido.");
      return false;
    }
    if (!ph) {
      toast.error("Poné un WhatsApp/teléfono.");
      return false;
    }

    return true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    const fullName = `${safeTrim(firstName)} ${safeTrim(lastName)}`.trim();

    const payload = {
      serviceId,
      staffId,
      startAt: selectedSlot.startAt,

      client: {
        firstName: safeTrim(firstName),
        lastName: safeTrim(lastName),
        phone: safeTrim(clientPhone),
        email: safeTrim(email) || null,
      },

      notes: safeTrim(notes) || null,
      channel: "web",
    };

    try {
      // ✅ endpoint sugerido: POST /api/appointments/public
      const { data } = await api.post("/appointments/public", payload);

      toast.success("Turno reservado correctamente ✅");

      // backend podría devolver appointment
      const appt = data?.appointment || null;
      const startAt = appt?.startAt || payload.startAt;

      setDoneInfo({
        name: fullName,
        service: selectedService?.name ?? "Servicio",
        staff: selectedStaff?.name ?? "Staff",
        date: formatDateDMY(startAt),
        time: formatTimeHHMM(startAt),
      });

      setDone(true);
    } catch (e2) {
      toast.error(e2?.response?.data?.error?.message || "No se pudo reservar. Intentá de nuevo.");
    }
  }

  // ✅ Pantalla final
  if (done) {
    return (
      <div className="bookingDoneWrap">
        <div className="bookingDoneCard card">
          <div className="bookingDoneIcon" aria-hidden="true">
            ✓
          </div>

          <h2 className="bookingDoneTitle">¡Turno reservado!</h2>
          <p className="bookingDoneSub muted">Gracias por confiar en nuestros servicios 🙌</p>

          {doneInfo ? (
            <div className="bookingDoneInfo">
              <div>
                <span>Cliente:</span> {doneInfo.name}
              </div>
              <div>
                <span>Servicio:</span> {doneInfo.service}
              </div>
              <div>
                <span>Con:</span> {doneInfo.staff}
              </div>
              <div>
                <span>Fecha:</span> {doneInfo.date}
              </div>
              <div>
                <span>Hora:</span> {doneInfo.time}
              </div>
            </div>
          ) : null}

          <div className="bookingDoneActions">
            <Button type="button" onClick={() => navigate("/")}>
              Volver al inicio
            </Button>

            <button type="button" className="bookingDoneLink" onClick={resetBooking}>
              Reservar otro turno
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingBase) {
    return (
      <div className="booking card">
        <div className="bookingTop">
          <div>
            <h2>Reservar turno</h2>
            <p className="muted">Cargando datos...</p>
          </div>

          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>

        <div className="muted" style={{ paddingTop: 10 }}>
          Un toque, ya lo armamos 🙌
        </div>
      </div>
    );
  }

  return (
    <form className="booking card" onSubmit={onSubmit}>
      <div className="bookingTop">
        <div>
          <h2>Reservar turno</h2>
          <p className="muted">Elegí servicio, con quién y un horario disponible.</p>
        </div>

        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>

      <div className="bookingGrid">
        <label className="selectField">
          <div className="label">Servicio</div>
          <select
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setSelectedSlot(null);
              setSlotError(false);
            }}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="selectField">
          <div className="label">Con quién</div>
          <select
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setSelectedSlot(null);
              setSlotError(false);
            }}
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <Input
          label="Fecha"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSelectedSlot(null);
            setSlotError(false);
          }}
        />

        <div className={`slotBox wide ${slotError ? "slotBoxError" : ""}`}>
          <div className="label">Horarios disponibles</div>

          {loadingSlots ? (
            <div className="slotEmpty">Cargando horarios...</div>
          ) : slots.length === 0 ? (
            <div className="slotEmpty">No hay horarios disponibles para esa fecha/staff (o está cerrado).</div>
          ) : (
            <div className="slotGrid">
              {slots.map((sl) => (
                <button
                  type="button"
                  key={sl.startAt}
                  className={`slotBtn ${selectedSlot?.startAt === sl.startAt ? "active" : ""}`}
                  onClick={() => {
                    setSelectedSlot(sl);
                    setSlotError(false);
                  }}
                >
                  {sl.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Input label="Nombre" placeholder="Ej: Juan" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input
          label="Apellido"
          placeholder="Ej: Pérez"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />

        <Input
          label="WhatsApp"
          placeholder="Ej: 358..."
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
        />

        <Input
          label="Email (opcional)"
          placeholder="Ej: juan@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="selectField wide">
          <div className="label">Observaciones (opcional)</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: No muy corto..." />
        </label>
      </div>

      <div className="bookingActions">
        <Button type="submit">Confirmar</Button>
      </div>
    </form>
  );
}