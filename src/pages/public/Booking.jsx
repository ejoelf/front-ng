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
  return toISODate(new Date());
}

function safeTrim(v) {
  return String(v ?? "").trim();
}

function capitalizeWords(value) {
  return safeTrim(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

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

  const [services, setServices] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);

  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotError, setSlotError] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [done, setDone] = useState(false);
  const [doneInfo, setDoneInfo] = useState(null);

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

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingBase(true);

        const [sv, st] = await Promise.all([
          api.get("/public/services"),
          api.get("/public/staff"),
        ]);

        if (!alive) return;

        const nextServices = Array.isArray(sv?.data?.services) ? sv.data.services : [];
        const nextStaff = Array.isArray(st?.data?.staff) ? st.data.staff : [];

        setServices(nextServices);
        setAllStaff(nextStaff);

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
  }, []);

  const staff = useMemo(() => {
    const s = services.find((x) => x.id === serviceId);
    const allowed = s?.allowedStaffIds;

    if (!allowed || allowed.length === 0) return allStaff;

    return allStaff.filter((st) => allowed.includes(st.id));
  }, [allStaff, services, serviceId]);

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
    const em = safeTrim(email);

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

    if (!em) {
      toast.error("Poné un email.");
      return false;
    }

    return true;
  }

  async function onSubmit(e) {
    e.preventDefault();

    if (!validate()) return;

    const normalizedFirstName = capitalizeWords(firstName);
    const normalizedLastName = capitalizeWords(lastName);
    const normalizedPhone = safeTrim(clientPhone);
    const normalizedEmail = safeTrim(email).toLowerCase();
    const normalizedNotes = safeTrim(notes) || null;
    const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();

    const payload = {
      serviceId,
      staffId,
      startAt: selectedSlot.startAt,
      client: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        phone: normalizedPhone,
        email: normalizedEmail,
      },
      notes: normalizedNotes,
      channel: "web",
    };

    try {
      const { data } = await api.post("/appointments/public", payload);

      toast.success("Turno reservado correctamente ✅");

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
      toast.error(
        e2?.response?.data?.error?.message || "No se pudo reservar.\nIntentá de nuevo."
      );
    }
  }

  if (done) {
    return (
      <section className="bookingPage">
        <div className="bookingCard bookingDone">
          <div className="bookingDoneIcon">✓</div>
          <h2>¡Turno reservado!</h2>
          <p>Gracias por confiar en nuestros servicios</p>

          {doneInfo ? (
            <div className="bookingDoneInfo">
              <p>
                <strong>Cliente:</strong> {doneInfo.name}
              </p>
              <p>
                <strong>Servicio:</strong> {doneInfo.service}
              </p>
              <p>
                <strong>Con:</strong> {doneInfo.staff}
              </p>
              <p>
                <strong>Fecha:</strong> {doneInfo.date}
              </p>
              <p>
                <strong>Hora:</strong> {doneInfo.time}
              </p>
            </div>
          ) : null}

          <div className="bookingActions">
            <Button type="button" onClick={() => navigate("/")}>
              Volver al inicio
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                resetBooking();
              }}
            >
              Reservar otro turno
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (loadingBase) {
    return (
      <section className="bookingPage">
        <div className="bookingCard">
          <h2>Reservar turno</h2>
          <p>Cargando datos...</p>

          <div className="bookingActions">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Volver
            </Button>
          </div>

          <p>Un toque, ya lo armamos</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bookingPage">
      <div className="bookingCard">
        <h2>Reservar turno</h2>
        <p>Elegí servicio, con quién y un horario disponible.</p>

        <div className="bookingActions bookingActionsTop">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>

        <form className="bookingForm" onSubmit={onSubmit}>
          <div className="bookingGrid">
            <label>
              <span>Servicio</span>
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

            <label>
              <span>Con quién</span>
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
              min={todayISO()}
              onChange={(e) => {
                setDate(e.target.value);
                setSelectedSlot(null);
                setSlotError(false);
              }}
            />
          </div>

          <div className={`bookingSlots ${slotError ? "isError" : ""}`}>
            <h3>Horarios disponibles</h3>

            {loadingSlots ? (
              <p>Cargando horarios...</p>
            ) : slots.length === 0 ? (
              <p>No hay horarios disponibles para esa fecha/staff (o está cerrado).</p>
            ) : (
              <div className="bookingSlotsGrid">
                {slots.map((sl) => (
                  <button
                    key={sl.startAt}
                    type="button"
                    className={`bookingSlotBtn ${
                      selectedSlot?.startAt === sl.startAt ? "isSelected" : ""
                    }`}
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

          <div className="bookingGrid">
            <Input
              label="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={() => setFirstName((prev) => capitalizeWords(prev))}
            />

            <Input
              label="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={() => setLastName((prev) => capitalizeWords(prev))}
            />

            <Input
              label="WhatsApp / Teléfono"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="bookingFieldFull">
            <label>
              <span>Observaciones (opcional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: No muy corto..."
              />
            </label>
          </div>

          <div className="bookingActions">
            <Button type="submit">Confirmar</Button>
          </div>
        </form>
      </div>
    </section>
  );
}