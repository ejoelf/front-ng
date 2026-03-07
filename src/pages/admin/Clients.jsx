import "./Clients.css";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/common/Toast";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";

import { PAYMENT_OPTIONS } from "../../utils/paymentMethods";
import {
  labelPaymentMethod,
  labelApptStatus,
  labelIncomeStatus,
} from "../../utils/labels";

import api from "../../services/http";

/** Utils */
function onlyFirstName(name = "") {
  const n = String(name).trim();
  if (!n) return "";
  return n.split(/\s+/)[0];
}

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function safeString(v) {
  return v == null ? "" : String(v);
}

function splitName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return { firstName: "", lastName: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatLocalDateTimeFromParts(dateStr, startHHMM) {
  if (!dateStr || !startHHMM) {
    return `${dateStr || ""} ${startHHMM || ""}`.trim();
  }

  const [y, m, d] = String(dateStr).split("-");
  return `${d}/${m}/${y} ${startHHMM}`;
}

function dateStrFromISO(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

function timeHHMMFromISO(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** API helpers (BACK REAL) */
async function apiListClients() {
  const { data } = await api.get("/clients");
  return data?.clients || [];
}

async function apiCreateClient(payload) {
  const { data } = await api.post("/clients", payload);
  return data;
}

async function apiUpdateClient(id, payload) {
  const { data } = await api.patch(`/clients/${id}`, payload);
  return data;
}

async function apiDeleteClient(id) {
  const { data } = await api.delete(`/clients/${id}`);
  return data;
}

async function apiListAppointmentsByClientId(clientId) {
  const { data } = await api.get("/appointments", { params: { clientId } });
  return data?.appointments || [];
}

async function apiGetIncomeByAppointmentId(appointmentId) {
  const { data } = await api.get(`/incomes/by-appointment/${appointmentId}`);
  return data?.income || null;
}

async function apiMarkIncomePaid(payload) {
  const { data } = await api.post("/incomes/mark-paid", payload);
  return data;
}

async function apiListServices() {
  const { data } = await api.get("/services");
  return data?.services || [];
}

async function apiListStaff() {
  const { data } = await api.get("/staff");
  return data?.staff || [];
}

export default function Clients() {
  const { show } = useToast();

  const [q, setQ] = useState("");
  const [refresh, setRefresh] = useState(0);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [newOpen, setNewOpen] = useState(false);

  const [clientsRaw, setClientsRaw] = useState([]);
  const [servicesRaw, setServicesRaw] = useState([]);
  const [staffRaw, setStaffRaw] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const [clients, services, staff] = await Promise.all([
          apiListClients(),
          apiListServices(),
          apiListStaff(),
        ]);

        if (!alive) return;
        setClientsRaw(clients);
        setServicesRaw(services);
        setStaffRaw(staff);
      } catch (e) {
        if (!alive) return;
        const msg =
          e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          e?.message ||
          "No se pudieron cargar los clientes.";

        show({ type: "error", title: "Error", message: msg });
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [refresh, show]);

  const servicesById = useMemo(() => {
    const m = new Map();
    for (const s of servicesRaw) m.set(s.id, s);
    return m;
  }, [servicesRaw]);

  const staffById = useMemo(() => {
    const m = new Map();
    for (const st of staffRaw) m.set(st.id, st);
    return m;
  }, [staffRaw]);

  const clients = useMemo(() => {
    const all = clientsRaw || [];
    const term = q.trim().toLowerCase();

    if (!term) return all;

    return all.filter((c) => {
      const name = safeString(c.name).toLowerCase();
      const phone = safeString(c.phone);
      const email = safeString(c.email).toLowerCase();
      const tags = Array.isArray(c.tags)
        ? c.tags.join(" ").toLowerCase()
        : safeString(c.tags).toLowerCase();

      return (
        name.includes(term) ||
        phone.includes(term) ||
        email.includes(term) ||
        tags.includes(term)
      );
    });
  }, [q, clientsRaw]);

  const total = clients.length;

  return (
    <div className="clients">
      <div className="clientsHeader">
        <div>
          <h1>Clientes</h1>
          <div className="muted">
            Se cargan automáticamente al crear turnos. También podés crear y
            editar clientes manualmente.
          </div>
        </div>

        <div className="clientsHeaderRight">
          <div className="clientsStat card">
            <div className="clientsStatLabel">Total</div>
            <div className="clientsStatValue">{total}</div>
          </div>

          <div className="clientsSearch">
            <Input
              label="Buscar"
              placeholder="Nombre, teléfono, email o etiqueta"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="clientsNew">
            <Button type="button" onClick={() => setNewOpen(true)}>
              Nuevo
            </Button>
          </div>
        </div>
      </div>

      <div className="clientsList">
        {loading ? (
          <div className="card clientsEmpty">Cargando...</div>
        ) : clients.length === 0 ? (
          <div className="card clientsEmpty">No hay clientes (todavía).</div>
        ) : (
          clients.map((c) => (
            <button
              key={c.id}
              type="button"
              className="card clientRow"
              onClick={() => {
                setSelected(c);
                setOpen(true);
              }}
            >
              <div className="clientLeft">
                <div className="clientAvatar">{initials(c.name)}</div>
                <div className="clientMain">
                  <div className="clientName">
                    {onlyFirstName(c.name) || c.name || "Sin nombre"}
                  </div>
                  <div className="muted clientMeta">{c.phone}</div>
                </div>
              </div>

              <div className="clientRight">
                {Array.isArray(c.tags) && c.tags.length ? (
                  <div className="clientTags">
                    {c.tags.slice(0, 2).map((t) => (
                      <span key={t} className="clientTag">
                        {t}
                      </span>
                    ))}
                    {c.tags.length > 2 ? (
                      <span className="clientTag muted">
                        +{c.tags.length - 2}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="muted small">—</div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <Modal
        open={open}
        title="Ficha de cliente"
        onClose={() => {
          setOpen(false);
          setSelected(null);
        }}
      >
        {selected ? (
          <ClientModal
            client={selected}
            servicesById={servicesById}
            staffById={staffById}
            onSaved={() => setRefresh((x) => x + 1)}
            onDeleted={() => {
              setOpen(false);
              setSelected(null);
              setRefresh((x) => x + 1);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={newOpen}
        title="Nuevo cliente"
        onClose={() => setNewOpen(false)}
      >
        <NewClientModal
          onCreated={() => {
            setNewOpen(false);
            setRefresh((x) => x + 1);
          }}
        />
      </Modal>
    </div>
  );
}

function NewClientModal({ onCreated }) {
  const { show } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  async function create() {
    const name = `${firstName} ${lastName}`.trim();

    if (!name) {
      show({
        type: "warning",
        title: "Falta nombre",
        message: "Completá nombre y apellido.",
      });
      return;
    }

    if (!String(phone || "").trim()) {
      show({
        type: "warning",
        title: "Falta WhatsApp",
        message: "El teléfono es obligatorio.",
      });
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      show({
        type: "warning",
        title: "Email inválido",
        message: "Revisá el formato.",
      });
      return;
    }

    try {
      await apiCreateClient({
        name,
        phone: String(phone).trim(),
        email: String(email || "").trim(),
      });

      show({
        type: "success",
        title: "Creado",
        message: "Cliente creado correctamente.",
      });

      onCreated();
    } catch (e) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        "No se pudo crear.";

      show({ type: "error", title: "Error", message: msg });
    }
  }

  return (
    <div className="clientModal">
      <div className="clientEditGrid">
        <Input
          label="Nombre"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          label="Apellido"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <Input
          label="WhatsApp"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Email (opcional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="clientSaveRow" style={{ gridColumn: "1 / -1" }}>
          <Button type="button" onClick={create}>
            Crear cliente
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClientModal({ client, servicesById, staffById, onSaved, onDeleted }) {
  const { show } = useToast();

  const { firstName: initialFN, lastName: initialLN } = splitName(client.name);

  const [firstName, setFirstName] = useState(initialFN);
  const [lastName, setLastName] = useState(initialLN);

  const [birthday, setBirthday] = useState(client.birthday || "");
  const [email, setEmail] = useState(client.email || "");
  const [notes, setNotes] = useState(client.notes || "");
  const [tagsText, setTagsText] = useState(
    Array.isArray(client.tags) ? client.tags.join(", ") : client.tags || ""
  );

  const [histRefresh, setHistRefresh] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState([]);

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState(0);

  const [confirmPayOpen, setConfirmPayOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadHistory() {
      setHistoryLoading(true);

      try {
        const appts = await apiListAppointmentsByClientId(client.id);

        const enriched = appts
          .map((a) => {
            const svc = servicesById.get(a.serviceId);
            const st = staffById.get(a.staffId);

            const nextDateStr = a.dateStr || dateStrFromISO(a.startAt);
            const nextStart = a.start || timeHHMMFromISO(a.startAt);
            const nextEnd = a.end || timeHHMMFromISO(a.endAt);

            return {
              ...a,
              serviceName: a.serviceName || svc?.name || "Servicio",
              staffName: a.staffName || st?.name || "Staff",
              dateStr: nextDateStr,
              start: nextStart,
              end: nextEnd,
              startAt:
                a.startAt ||
                (nextDateStr && nextStart
                  ? `${nextDateStr}T${nextStart}:00`
                  : null),
              endAt:
                a.endAt ||
                (nextDateStr && nextEnd ? `${nextDateStr}T${nextEnd}:00` : null),
            };
          })
          .sort((a, b) =>
            `${b.dateStr || ""}${b.start || ""}`.localeCompare(
              `${a.dateStr || ""}${a.start || ""}`
            )
          );

        if (!alive) return;
        setHistory(enriched);
      } catch (e) {
        if (!alive) return;
        const msg =
          e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          e?.message ||
          "No se pudo cargar el historial.";

        show({ type: "error", title: "Error", message: msg });
        setHistory([]);
      } finally {
        if (alive) setHistoryLoading(false);
      }
    }

    loadHistory();

    return () => {
      alive = false;
    };
  }, [client.id, histRefresh, servicesById, staffById, show]);

  const waLink = useMemo(() => {
    const phone = String(client.phone || "").replace(/[^\d]/g, "");
    if (!phone) return "#";

    const msg = encodeURIComponent(
      `Hola! ${onlyFirstName(client.name) || "..."}. Te contacto desde Peluquería NG.`
    );

    return `https://wa.me/${phone}?text=${msg}`;
  }, [client.phone, client.name]);

  function parseTags(raw) {
    const parts = String(raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return Array.from(new Set(parts));
  }

  async function saveClient() {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      show({
        type: "warning",
        title: "Email inválido",
        message: "Revisá el formato (ej: juan.perez@email.com).",
      });
      return;
    }

    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      show({
        type: "warning",
        title: "Cumpleaños inválido",
        message: "Usá el formato YYYY-MM-DD.",
      });
      return;
    }

    const fullName = `${String(firstName || "").trim()} ${String(
      lastName || ""
    ).trim()}`.trim();

    const payload = {
      name: fullName || client.name || "Cliente",
      birthday: birthday || "",
      email: email || "",
      notes: notes || "",
      tags: parseTags(tagsText),
    };

    try {
      await apiUpdateClient(client.id, payload);
      onSaved();

      show({
        type: "success",
        title: "Guardado",
        message: "Los datos del cliente se actualizaron correctamente.",
      });
    } catch (e) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        "No se pudo guardar.";

      show({ type: "error", title: "Error al guardar", message: msg });
    }
  }

  function askDelete() {
    setConfirmDeleteOpen(true);
  }

  async function doDelete() {
    try {
      await apiDeleteClient(client.id);

      show({
        type: "success",
        title: "Eliminado",
        message: "Cliente ocultado del listado correctamente.",
      });

      setConfirmDeleteOpen(false);
      onDeleted();
    } catch (e) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        "No se pudo eliminar.";

      show({ type: "error", title: "No se pudo eliminar", message: msg });
      setConfirmDeleteOpen(false);
    }
  }

  async function openPayFor(appt) {
    try {
      const inc = await apiGetIncomeByAppointmentId(appt.id);

      if (!inc) {
        show({
          type: "error",
          title: "Sin ingreso",
          message: "No se encontró el ingreso asociado a este turno.",
        });
        return;
      }

      if (inc.paidStatus === "paid") return;

      setPayTarget({ appt, income: inc });
      setPayMethod(inc.paymentMethod || "cash");
      setPayAmount(
        Number(inc.amountFinal ?? inc.amountEstimated ?? appt.price ?? 0)
      );
      setPayOpen(true);
    } catch (e) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        "No se pudo obtener el ingreso.";

      show({ type: "error", title: "Error", message: msg });
    }
  }

  function requestConfirmPay() {
    if (!payTarget?.income) return;
    setConfirmPayOpen(true);
  }

  async function doConfirmPay() {
    if (!payTarget?.income) return;

    try {
      await apiMarkIncomePaid({
        incomeId: payTarget.income.id,
        paymentMethod: payMethod,
        amountFinal: payAmount,
        paidDateStr: todayLocalISO(),
      });

      show({
        type: "success",
        title: "Cobrado",
        message: "Se registró el cobro y se impactó en Caja.",
      });

      setConfirmPayOpen(false);
      setPayOpen(false);
      setPayTarget(null);

      setHistRefresh((x) => x + 1);
      onSaved();
    } catch (e) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        "No se pudo marcar cobrado.";

      show({ type: "error", title: "Error", message: msg });
      setConfirmPayOpen(false);
    }
  }

  return (
    <div className="clientModal">
      <div className="clientCardTop card">
        <div className="clientCardHead">
          <div className="clientAvatar big">{initials(client.name)}</div>

          <div className="clientCardInfo">
            <div className="clientCardName">{client.name || "Sin nombre"}</div>
            <div className="muted">{client.phone}</div>
            {client.email ? (
              <div className="muted small">{client.email}</div>
            ) : null}
          </div>

          <div className="clientCardActions">
            <a
              className="clientQuickBtn"
              href={waLink}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>

            <button
              type="button"
              className="clientDangerBtn"
              onClick={askDelete}
            >
              Eliminar
            </button>
          </div>
        </div>

        <div className="clientEditGrid">
          <Input
            label="Nombre"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            label="Apellido"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <Input label="WhatsApp" value={client.phone || ""} disabled />

          <label className="selectField">
            <div className="label">Cumpleaños (opcional)</div>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
            <div className="hint">Ideal para descuentos o promos.</div>
          </label>

          <label className="selectField">
            <div className="label">Email (opcional)</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan.perez@email.com"
            />
          </label>

          <label className="selectField" style={{ gridColumn: "1 / -1" }}>
            <div className="label">Etiquetas</div>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="VIP, Promo, Sorteo..."
            />
            <div className="hint">Separadas por coma. Ej: VIP, Sorteo</div>
          </label>

          <label className="selectField" style={{ gridColumn: "1 / -1" }}>
            <div className="label">Notas</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: no le gusta muy corto, prefiere fade bajo..."
            />
          </label>

          <div className="clientSaveRow" style={{ gridColumn: "1 / -1" }}>
            <Button type="button" onClick={saveClient}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>

      <hr className="hr" />

      <div className="clientHistTitle">Historial</div>

      <div className="clientHist">
        {historyLoading ? (
          <div className="muted">Cargando historial...</div>
        ) : history.length === 0 ? (
          <div className="muted">Sin historial todavía.</div>
        ) : (
          history.map((a) => (
            <HistoryRow key={a.id} appt={a} onPay={() => openPayFor(a)} />
          ))
        )}
      </div>

      <Modal
        open={payOpen}
        title="Marcar cobrado"
        onClose={() => {
          setPayOpen(false);
          setPayTarget(null);
          setConfirmPayOpen(false);
        }}
      >
        <div className="apptPay">
          <div className="muted">
            Elegí método y monto. Esto impacta en Caja con fecha de hoy (
            {todayLocalISO()}).
          </div>

          <div className="payGrid" style={{ marginTop: 10 }}>
            <label className="selectField">
              <div className="label">Método</div>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                {PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {labelPaymentMethod(opt.code)}
                  </option>
                ))}
              </select>
            </label>

            <label className="selectField">
              <div className="label">Monto final</div>
              <input
                type="number"
                min="0"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </label>
          </div>

          <div className="apptActions" style={{ marginTop: 12 }}>
            <Button
              type="button"
              onClick={() => {
                setPayOpen(false);
                setPayTarget(null);
                setConfirmPayOpen(false);
              }}
            >
              Cancelar
            </Button>

            <Button type="button" onClick={requestConfirmPay}>
              Confirmar cobro
            </Button>
          </div>
        </div>

        <Modal
          open={confirmPayOpen}
          title="Confirmar cobro"
          onClose={() => setConfirmPayOpen(false)}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div className="muted">
              Vas a marcar este servicio como <strong>COBRADO</strong>.
              <br />
              <strong>No hay vuelta atrás</strong>. ¿Confirmás?
            </div>

            <div className="apptActions" style={{ marginTop: 6 }}>
              <Button type="button" onClick={() => setConfirmPayOpen(false)}>
                Volver
              </Button>

              <Button type="button" onClick={doConfirmPay}>
                Sí, marcar cobrado
              </Button>
            </div>
          </div>
        </Modal>
      </Modal>

      <Modal
        open={confirmDeleteOpen}
        title="Eliminar cliente"
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div className="muted">
            Vas a ocultar a <strong>{client.name || "este cliente"}</strong> del
            listado.
            <br />
            Su historial de turnos se conserva y el cliente podrá restaurarse si
            vuelve a registrarse.
          </div>

          <div className="apptActions" style={{ marginTop: 6 }}>
            <Button type="button" onClick={() => setConfirmDeleteOpen(false)}>
              Cancelar
            </Button>

            <Button type="button" variant="danger" onClick={doDelete}>
              Sí, eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function HistoryRow({ appt, onPay }) {
  const [inc, setInc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadInc() {
      setLoading(true);
      try {
        const income = await apiGetIncomeByAppointmentId(appt.id);
        if (!alive) return;
        setInc(income);
      } catch {
        if (!alive) return;
        setInc(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadInc();

    return () => {
      alive = false;
    };
  }, [appt.id]);

  const paidLabel = inc ? labelIncomeStatus(inc.paidStatus) : "—";
  const canPay = inc && inc.paidStatus !== "paid" && inc.paidStatus !== "void";

  return (
    <div className="card histItem">
      <div className="histTop">
        <strong>{appt.serviceName}</strong>
        <span className="muted">
          {formatLocalDateTimeFromParts(appt.dateStr, appt.start)}
        </span>
      </div>

      <div className="muted small">
        {appt.staffName} · Turno: {labelApptStatus(appt.status)}
      </div>

      <div className="histPayRow">
        <span className={`histPayPill cash-${inc?.paidStatus || "pending"}`}>
          {loading ? "..." : paidLabel}
        </span>

        {canPay ? (
          <Button type="button" onClick={onPay}>
            Marcar cobrado
          </Button>
        ) : (
          <span className="muted small">
            {inc?.paidStatus === "paid" ? "Cobrado" : ""}
          </span>
        )}
      </div>

      {appt.notes ? <div className="muted small">Obs: {appt.notes}</div> : null}
    </div>
  );
}