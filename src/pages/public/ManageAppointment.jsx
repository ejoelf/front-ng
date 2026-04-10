import "./ManageAppointment.css";

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Button from "../../components/common/Button";
import { useToast } from "../../components/common/Toast";
import api from "../../services/http";
import { formatDateDMY, formatTimeHHMM } from "../../utils/format";

function getCodeFromURL(search) {
  return new URLSearchParams(search).get("code");
}

function toISODate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const WHATSAPP_NUMBER = "543585737060";
const WHATSAPP_TEXT = encodeURIComponent(
  "Hola! Mi nombre es (TU NOMBRE). Quería saber si es posible reprogramar un turno!"
);

export default function ManageAppointment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { show } = useToast();

  const audioRef = useRef(null);

  const toast = {
    success: (message) => show({ type: "success", message }),
    error: (message) => show({ type: "error", message }),
    info: (message) => show({ type: "info", message }),
  };

  const code = getCodeFromURL(location.search);

  const [appointmentsList, setAppointmentsList] = useState([]);
  const [searchMode, setSearchMode] = useState(!code);
  const [loading, setLoading] = useState(Boolean(code));
  const [appointment, setAppointment] = useState(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [manualCode, setManualCode] = useState("");
  const [searchAttempts, setSearchAttempts] = useState(0);

  const [mode, setMode] = useState("view");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStaffId, setRescheduleStaffId] = useState("");
  const [staffOptions, setStaffOptions] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [highlight, setHighlight] = useState(false);

  const [modal, setModal] = useState(null);

  useEffect(() => {
    audioRef.current = new Audio(
      "https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3"
    );
  }, []);

  function playSound() {
    audioRef.current?.play().catch(() => {});
  }

  async function loadAppointmentByCode(targetCode) {
    if (!targetCode) return;

    try {
      setLoading(true);

      const { data } = await api.get(`/appointments/by-code/${targetCode}`);
      const nextAppointment = data?.appointment || null;

      setAppointment(nextAppointment);
      setSearchMode(false);
      setMode("view");
      setSelectedSlot(null);
      setSlots([]);
      setSearchAttempts(0);
      setManualCode("");
      setModal(null);
      setRescheduleDate(
        nextAppointment?.dateStr || toISODate(nextAppointment?.startAt)
      );
      setRescheduleStaffId(nextAppointment?.staffId || "");
    } catch (e) {
      toast.error(
        e?.response?.data?.error?.message || "No se pudo cargar el turno."
      );
      setAppointment(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!code) return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const { data } = await api.get(`/appointments/by-code/${code}`);

        if (!alive) return;

        const nextAppointment = data?.appointment || null;
        setAppointment(nextAppointment);
        setSearchMode(false);
        setRescheduleDate(
          nextAppointment?.dateStr || toISODate(nextAppointment?.startAt)
        );
        setRescheduleStaffId(nextAppointment?.staffId || "");
      } catch (e) {
        if (!alive) return;
        toast.error(
          e?.response?.data?.error?.message || "No se pudo cargar el turno."
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [code]);

  useEffect(() => {
    if (mode !== "reschedule" || !appointment?.serviceId) return;

    let alive = true;

    (async () => {
      try {
        setLoadingStaff(true);

        const { data } = await api.get("/staff");
        const fullStaff = Array.isArray(data?.staff) ? data.staff : [];

        let allowedStaff = fullStaff.filter((s) => s?.isActive !== false);

        try {
          const serviceRes = await api.get("/services");
          const services = Array.isArray(serviceRes?.data?.services)
            ? serviceRes.data.services
            : [];
          const service = services.find(
            (s) => String(s.id) === String(appointment.serviceId)
          );

          if (Array.isArray(service?.allowedStaff) && service.allowedStaff.length > 0) {
            const allowedIds = service.allowedStaff.map((s) =>
              typeof s === "object" ? String(s.id) : String(s)
            );

            allowedStaff = allowedStaff.filter((s) =>
              allowedIds.includes(String(s.id))
            );
          }
        } catch {
          // si falla services, seguimos con staff activo
        }

        if (!alive) return;

        setStaffOptions(allowedStaff);

        const stillExists = allowedStaff.some(
          (s) => String(s.id) === String(rescheduleStaffId || appointment.staffId)
        );

        if (stillExists) {
          setRescheduleStaffId((prev) => prev || appointment.staffId || "");
        } else if (allowedStaff[0]?.id) {
          setRescheduleStaffId(String(allowedStaff[0].id));
        }
      } catch (e) {
        if (!alive) return;
        setStaffOptions([]);
        toast.error(
          e?.response?.data?.error?.message ||
            "No se pudo cargar el listado de profesionales."
        );
      } finally {
        if (alive) setLoadingStaff(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [mode, appointment]);

  async function handleSearch() {
    setAppointmentsList([]);

    if (!String(name || "").trim() || !String(phone || "").trim()) {
      toast.error("Completá nombre y teléfono.");
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post("/appointments/search-public", {
        name: String(name || "").trim(),
        phone: String(phone || "").trim(),
      });

      const found = Array.isArray(data?.appointments) ? data.appointments : [];

      if (!found.length) {
        const nextAttempts = searchAttempts + 1;
        setSearchAttempts(nextAttempts);

        if (nextAttempts >= 2) {
          setModal("codeFallback");
        } else {
          toast.error("No encontramos turnos. Corroborá los datos ingresados.");
        }
        return;
      }

      setSearchAttempts(0);

      if (found.length === 1 && found[0]?.confirmationCode) {
        await loadAppointmentByCode(found[0].confirmationCode);
        return;
      }

      setAppointmentsList(found);
    } catch (e) {
      toast.error(
        e?.response?.data?.error?.message || "Error buscando turno."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchByManualCode() {
    const trimmedCode = String(manualCode || "").trim();

    if (!trimmedCode) {
      toast.error("Ingresá el código de confirmación.");
      return;
    }

    await loadAppointmentByCode(trimmedCode);
  }

  useEffect(() => {
    if (
      mode !== "reschedule" ||
      !appointment ||
      !rescheduleDate ||
      !rescheduleStaffId
    ) {
      return;
    }

    let alive = true;

    (async () => {
      try {
        setLoadingSlots(true);
        setSelectedSlot(null);

        const { data } = await api.get("/public/availability", {
          params: {
            dateStr: rescheduleDate,
            serviceId: appointment.serviceId,
            staffId: rescheduleStaffId,
          },
        });

        if (!alive) return;

        setSlots(Array.isArray(data?.slots) ? data.slots : []);
      } catch (e) {
        if (!alive) return;
        setSlots([]);
        toast.error(
          e?.response?.data?.error?.message || "Error cargando horarios."
        );
      } finally {
        if (alive) setLoadingSlots(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [mode, appointment, rescheduleDate, rescheduleStaffId]);

  async function handleCancel() {
    try {
      await api.post("/appointments/cancel-by-code", {
        code: code || appointment?.confirmationCode,
      });

      setAppointment((prev) =>
        prev ? { ...prev, status: "cancelled" } : prev
      );

      playSound();
      toast.success("Turno cancelado.");
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || "Error cancelando.");
    }
  }

  async function handleReschedule() {
    if (!selectedSlot?.startAt) {
      toast.error("Elegí un horario.");
      return;
    }

    try {
      const { data } = await api.post("/appointments/reschedule-by-code", {
        code: code || appointment?.confirmationCode,
        newStartAtISO: selectedSlot.startAt,
        newStaffId: rescheduleStaffId,
      });

      const updatedAppointment = data?.appointment || null;

      if (updatedAppointment) {
        setAppointment(updatedAppointment);
        setRescheduleDate(
          updatedAppointment?.dateStr || toISODate(updatedAppointment?.startAt)
        );
        setRescheduleStaffId(updatedAppointment?.staffId || "");
      } else if (appointment?.confirmationCode) {
        await loadAppointmentByCode(appointment.confirmationCode);
      }

      setMode("view");
      setSlots([]);
      setSelectedSlot(null);

      setHighlight(true);
      setTimeout(() => setHighlight(false), 2000);

      playSound();
      toast.success("Turno reprogramado.");
    } catch (e) {
      toast.error(
        e?.response?.data?.error?.message || "No se pudo reprogramar."
      );
    }
  }

  function handleOpenReschedule() {
    if (!appointment) return;

    if (appointment.status === "cancelled") {
      toast.error("No podés reprogramar un turno cancelado.");
      return;
    }

    if ((appointment.rescheduleCount || 0) >= 2) {
      setModal("limit");
      return;
    }

    setRescheduleDate(
      appointment?.dateStr || toISODate(appointment?.startAt) || todayISO()
    );
    setRescheduleStaffId(appointment?.staffId || "");
    setSelectedSlot(null);
    setMode("reschedule");
  }

  function resetToSearch() {
    setAppointment(null);
    setAppointmentsList([]);
    setSearchMode(true);
    setMode("view");
    setSelectedSlot(null);
    setSlots([]);
    setSearchAttempts(0);
    setManualCode("");
    setModal(null);
    setRescheduleDate("");
    setRescheduleStaffId("");
    setStaffOptions([]);
  }

  function Modal() {
    if (!modal) return null;

    return (
      <div className="modalOverlay">
        <div className="modalBox">
          <button className="modalClose" onClick={() => setModal(null)}>
            ✕
          </button>

          {modal === "cancel" && (
            <>
              <h3>¿Cancelar turno?</h3>
              <p>Esta acción no se puede deshacer.</p>

              <div className="modalActions">
                <Button
                  variant="danger"
                  onClick={async () => {
                    await handleCancel();
                    setModal(null);
                  }}
                >
                  Sí, cancelar
                </Button>

                <Button onClick={() => setModal(null)}>Volver</Button>
              </div>
            </>
          )}

          {modal === "limit" && (
            <>
              <h3>Límite alcanzado</h3>
              <p>
                Este turno ya fue reprogramado demasiadas veces. Contactate
                directamente con la peluquería.
              </p>

              <div className="modalActions">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button>Contactar WhatsApp</Button>
                </a>

                <Button onClick={() => setModal(null)}>Cerrar</Button>
              </div>
            </>
          )}

          {modal === "codeFallback" && (
            <>
              <h3>No pudimos encontrar tu turno</h3>
              <p>
                Verificá los datos ingresados o usá el código de confirmación
                que figura en el email que recibiste al reservar.
              </p>

              <input
                placeholder="Ingresá tu código de confirmación"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />

              <div className="modalActions">
                <Button onClick={handleSearchByManualCode}>Buscar por código</Button>
                <Button variant="ghost" onClick={() => setModal(null)}>
                  Cerrar
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (searchMode) {
    return (
      <section className="managePage">
        <div className="manageCard">
          <div className="manageTopBar">
            <div>
              <h2>Gestionar turno</h2>
              <p className="manageTopHint">
                Ingresá tu nombre y teléfono para buscar tu turno y elegir qué
                querés hacer.
              </p>
            </div>

            
          </div>

          <input
            placeholder="Nombre y apellido"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            placeholder="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="manageSearchActions">
            <Button onClick={handleSearch} className="searchBtn" disabled={loading}>
              {loading ? "Buscando..." : "Buscar turno"}
            </Button>

            <Button variant="ghost" onClick={() => navigate("/")}>
              Volver al inicio
            </Button>
          </div>

          {appointmentsList.length > 0 ? (
            <div className="manageList">
              {appointmentsList.map((a) => (
                <div key={a.id} className="manageItem">
                  <div>
                    <p>
                      <strong>{a.serviceName}</strong>
                    </p>
                    <p>{formatDateDMY(a.startAt)}</p>
                    <p>{formatTimeHHMM(a.startAt)}</p>
                  </div>

                  <Button onClick={() => loadAppointmentByCode(a.confirmationCode)}>
                    Gestionar
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <Modal />
      </section>
    );
  }

  if (loading) {
    return (
      <section className="managePage">
        <div className="manageCard">
          <div className="manageTopBar">
            <div>
              <h2>Gestionar turno</h2>
              <p className="manageTopHint">Cargando datos del turno...</p>
            </div>

            <Button variant="ghost" onClick={() => navigate("/")}>
              Volver
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (!appointment) {
    return (
      <section className="managePage">
        <div className="manageCard">
          <div className="manageTopBar">
            <div>
              <h2>Gestionar turno</h2>
              <p className="manageTopHint">
                No encontramos información para mostrar.
              </p>
            </div>

            <Button variant="ghost" onClick={() => navigate("/")}>
              Volver
            </Button>
          </div>

          <div className="manageActions">
            <Button onClick={resetToSearch}>Buscar otro turno</Button>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Volver al inicio
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const isCancelled = appointment.status === "cancelled";

  return (
    <section className="managePage">
      <div className={`manageCard ${highlight ? "highlightCard" : ""}`}>
        <div className="manageTopBar">
          <div>
            <h2>Gestionar turno</h2>
            <p className="manageTopHint">
              Desde acá podés revisar la información de tu reserva, cancelarla o
              reprogramarla.
            </p>
          </div>

          <Button variant="ghost" onClick={() => navigate("/")}>
            Volver
          </Button>
        </div>

        <div className="manageInfo">
          <p>
            <strong>Servicio:</strong> {appointment.serviceName}
          </p>
          <p>
            <strong>Profesional:</strong> {appointment.staffName}
          </p>
          <p>
            <strong>Fecha:</strong> {formatDateDMY(appointment.startAt)}
          </p>
          <p>
            <strong>Hora:</strong> {formatTimeHHMM(appointment.startAt)}
          </p>
          <p>
            <strong>Cliente:</strong> {appointment.clientName}
          </p>
          <p>
            <strong>Teléfono:</strong> {appointment.clientPhone || "—"}
          </p>
          <p>
            <strong>Email:</strong> {appointment.clientEmail || "—"}
          </p>
          <p>
            <strong>Estado:</strong> {appointment.status}
          </p>
          <p>
            <strong>Código:</strong> {appointment.confirmationCode || "—"}
          </p>
          <p>
            <strong>Reprogramaciones usadas:</strong>{" "}
            {appointment.rescheduleCount || 0}/2
          </p>
        </div>

        {mode === "view" ? (
          <div className="manageActions">
            <Button
              variant="danger"
              onClick={() => setModal("cancel")}
              disabled={isCancelled}
            >
              Cancelar
            </Button>

            <Button onClick={handleOpenReschedule} disabled={isCancelled}>
              Reprogramar
            </Button>

            <Button variant="ghost" onClick={resetToSearch}>
              Buscar otro turno
            </Button>
          </div>
        ) : null}

        {mode === "reschedule" ? (
          <>
            <div className="manageActions">
              <label className="manageDateField">
                <span>Elegí el profesional</span>
                <select
                  value={rescheduleStaffId}
                  onChange={(e) => {
                    setRescheduleStaffId(e.target.value);
                    setSelectedSlot(null);
                  }}
                  disabled={loadingStaff || staffOptions.length === 0}
                >
                  {loadingStaff ? (
                    <option value="">Cargando profesionales...</option>
                  ) : staffOptions.length === 0 ? (
                    <option value="">No hay profesionales disponibles</option>
                  ) : (
                    staffOptions.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="manageDateField">
                <span>Elegí una nueva fecha</span>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={todayISO()}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                />
              </label>
            </div>

            <div className="manageActions">
              <Button variant="ghost" onClick={() => setMode("view")}>
                Volver
              </Button>

              <Button
                onClick={handleReschedule}
                disabled={!selectedSlot || !rescheduleStaffId}
              >
                Confirmar reprogramación
              </Button>
            </div>

            {loadingSlots ? (
              <div className="manageEmpty">Cargando horarios disponibles...</div>
            ) : slots.length === 0 ? (
              <div className="manageEmpty">
                No hay horarios disponibles para la combinación elegida de
                profesional y fecha.
              </div>
            ) : (
              <div className="manageSlots">
                {slots.map((sl) => (
                  <button
                    key={sl.startAt}
                    type="button"
                    className={`slot ${
                      selectedSlot?.startAt === sl.startAt ? "active" : ""
                    }`}
                    onClick={() => setSelectedSlot(sl)}
                  >
                    {sl.label || formatTimeHHMM(sl.startAt)}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>

      <Modal />
    </section>
  );
}