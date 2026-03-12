import "./Cashbox.css";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/common/Toast";
import Modal from "../../components/common/Modal";

import api from "../../services/http";
import { formatDateDMY } from "../../utils/format";
import { downloadPDF, addTitle, addTable } from "../../utils/pdf";
import { PAYMENT_OPTIONS } from "../../utils/paymentMethods";
import { labelPaymentMethod } from "../../utils/labels";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function money(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

function labelStatusLocal(code) {
  if (code === "paid") return "Cobrado";
  if (code === "pending") return "Pendiente";
  if (code === "unpaid") return "No cobrado";
  if (code === "void") return "Anulado";
  return code || "—";
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function getIncomeDateStr(i, fallbackDateStr) {
  return (
    i?.paidDateStr ||
    i?.dateStr ||
    (typeof i?.date === "string" ? i.date.slice(0, 10) : "") ||
    fallbackDateStr
  );
}

function getClientLabel(i) {
  return i?.clientName || i?.client?.name || i?.client || "—";
}

function getServiceLabel(i) {
  return i?.serviceName || i?.service?.name || i?.service || i?.concept || "—";
}

function getEstimated(i) {
  const v =
    i?.amountEstimated ??
    i?.estimatedAmount ??
    i?.amount ??
    i?.amountFinal ??
    0;

  return Number(v || 0);
}

function getFinal(i) {
  const v = i?.amountFinal ?? i?.finalAmount ?? 0;
  return Number(v || 0);
}

function getStaffLabel(i) {
  return i?.staffName || "—";
}

function getTimeLabel(i) {
  return i?.appointmentTime || "—";
}

export default function Cashbox() {
  const { show } = useToast();

  const [date, setDate] = useState(todayISO());
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState("all"); // all | pending | unpaid | paid | void
  const [staffFilter, setStaffFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);

  const [services, setServices] = useState([]);
  const [incomesAll, setIncomesAll] = useState([]);

  const [newOpen, setNewOpen] = useState(false);
  const [newType, setNewType] = useState("service"); // service | other
  const [newServiceId, setNewServiceId] = useState("");
  const [newMethod, setNewMethod] = useState("cash");
  const [newAmount, setNewAmount] = useState(0);
  const [newDetail, setNewDetail] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCfg, setConfirmCfg] = useState({
    title: "Confirmar",
    message: "",
    confirmText: "Confirmar",
    tone: "danger",
    onConfirm: null,
  });

  function openConfirm({ title, message, confirmText, tone, onConfirm }) {
    setConfirmCfg({
      title: title || "Confirmar",
      message: message || "",
      confirmText: confirmText || "Confirmar",
      tone: tone || "danger",
      onConfirm: onConfirm || null,
    });
    setConfirmOpen(true);
  }

  useEffect(() => {
    let alive = true;

    async function loadServices() {
      setServicesLoading(true);
      try {
        const { data } = await api.get("/services");
        const list = Array.isArray(data?.services)
          ? data.services
          : Array.isArray(data)
            ? data
            : [];

        if (!alive) return;
        setServices(list);

        if (!newServiceId && list[0]?.id) {
          setNewServiceId(list[0].id);
        }
      } catch (err) {
        if (!alive) return;
        show({
          type: "error",
          title: "Error",
          message:
            err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            "No se pudieron cargar los servicios.",
        });
      } finally {
        if (alive) setServicesLoading(false);
      }
    }

    loadServices();

    return () => {
      alive = false;
    };
  }, [newServiceId, show]);

  useEffect(() => {
    let alive = true;

    async function loadIncomes() {
      setLoading(true);
      try {
        const { data } = await api.get("/incomes/by-date", {
          params: { dateStr: date },
        });

        const list = Array.isArray(data?.incomes)
          ? data.incomes
          : Array.isArray(data)
            ? data
            : [];

        if (!alive) return;
        setIncomesAll(list);
      } catch (err) {
        if (!alive) return;

        const msg =
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "No se pudieron cargar los ingresos.";

        show({ type: "error", title: "Error", message: msg });
        setIncomesAll([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadIncomes();

    return () => {
      alive = false;
    };
  }, [date, refreshKey, show]);

  const staffOptions = useMemo(() => {
    const map = new Map();

    for (const i of incomesAll) {
      const name = getStaffLabel(i);
      if (name && name !== "—") {
        map.set(name, name);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "es"));
  }, [incomesAll]);

  const incomes = useMemo(() => {
    let list = incomesAll;

    if (filter !== "all") {
      list = list.filter((i) => i.paidStatus === filter);
    }

    if (staffFilter !== "all") {
      list = list.filter((i) => getStaffLabel(i) === staffFilter);
    }

    return list;
  }, [incomesAll, filter, staffFilter]);

  const totalPaid = useMemo(() => {
    return incomesAll
      .filter((i) => i.paidStatus === "paid")
      .reduce((acc, i) => acc + getFinal(i), 0);
  }, [incomesAll]);

  const totalEstimatedPending = useMemo(() => {
    return incomesAll
      .filter((i) => i.paidStatus === "pending" || i.paidStatus === "unpaid")
      .reduce((acc, i) => acc + getEstimated(i), 0);
  }, [incomesAll]);

  const counts = useMemo(() => {
    const c = { all: incomesAll.length, pending: 0, unpaid: 0, paid: 0, void: 0 };

    for (const i of incomesAll) {
      if (i.paidStatus === "pending") c.pending++;
      else if (i.paidStatus === "unpaid") c.unpaid++;
      else if (i.paidStatus === "paid") c.paid++;
      else if (i.paidStatus === "void") c.void++;
    }

    return c;
  }, [incomesAll]);

  function exportPDF() {
    downloadPDF(`caja_${date}.pdf`, (doc) => {
      addTitle(doc, "Caja (por día)", `Fecha: ${formatDateDMY(date)}`);

      doc.setFontSize(11);
      doc.text(`Cobrado: ${money(totalPaid)}`, 14, 28);
      doc.text(`Pendiente (estimado): ${money(totalEstimatedPending)}`, 14, 34);

      const head = [
        "Fecha",
        "Hora",
        "Staff",
        "Cliente",
        "Servicio",
        "Estado",
        "Método",
        "Estimado",
        "Final",
      ];

      const body = incomes.map((i) => [
        formatDateDMY(getIncomeDateStr(i, date)),
        getTimeLabel(i),
        getStaffLabel(i),
        getClientLabel(i),
        getServiceLabel(i),
        labelStatusLocal(i.paidStatus),
        i.paymentMethod ? labelPaymentMethod(i.paymentMethod) : "-",
        money(getEstimated(i)),
        i.paidStatus === "paid" ? money(getFinal(i)) : "-",
      ]);

      addTable(doc, head, body, 42);
    });

    show({
      type: "success",
      title: "PDF generado",
      message: "Se descargó el reporte de caja.",
    });
  }

  function resetNewIncomeForm() {
    setNewType("service");
    setNewServiceId(services?.[0]?.id || "");
    setNewMethod("cash");
    setNewAmount(0);
    setNewDetail("");
  }

  function openNewIncome() {
    resetNewIncomeForm();
    setNewOpen(true);
  }

  async function createNewIncome() {
    const amt = Number(newAmount);

    if (!Number.isFinite(amt) || amt <= 0) {
      show({
        type: "warning",
        title: "Monto inválido",
        message: "Ingresá un monto mayor a 0.",
      });
      return;
    }

    const method = safeStr(newMethod);
    if (!method) {
      show({
        type: "warning",
        title: "Método inválido",
        message: "Elegí un método de pago.",
      });
      return;
    }

    let concept = "Otro";

    if (newType === "service") {
      const sv = services.find((s) => s.id === newServiceId);
      if (!sv) {
        show({
          type: "warning",
          title: "Motivo inválido",
          message: "Elegí un servicio o seleccioná 'Otro'.",
        });
        return;
      }
      concept = sv.name;
    }

    const detail = safeStr(newDetail);

    if (newType === "other" && !detail) {
      show({
        type: "warning",
        title: "Falta detalle",
        message:
          "Para 'Otro', escribí un detalle (ej: bebida, producto, etc.).",
      });
      return;
    }

    const conceptFinal =
      newType === "other"
        ? `Otro: ${detail}`
        : detail
          ? `${concept} - ${detail}`
          : concept;

    try {
      await api.post("/incomes/manual", {
        concept: conceptFinal,
        amountFinal: Math.trunc(amt),
        paidStatus: "paid",
        paymentMethod: method,
        paidDateStr: date,
      });

      show({
        type: "success",
        title: "Ingreso creado",
        message: `${conceptFinal} · ${money(amt)} · ${labelPaymentMethod(method)}`,
      });

      setNewOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      show({
        type: "error",
        title: "Error",
        message:
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "No se pudo crear el ingreso.",
      });
    }
  }

  return (
    <div className="cash">
      <div className="cashHeader">
        <div className="cashHeaderLeft">
          <h1>Caja</h1>
          <div className="cashSub muted">
            Control diario de cobros, pendientes y casos especiales.
          </div>
        </div>

        <div className="cashHeaderRight">
          <label className="cashCtrl">
            <span>Fecha</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <button
            className="cashBtn primary"
            type="button"
            onClick={openNewIncome}
            disabled={servicesLoading}
          >
            + Nuevo
          </button>

          <button
            className="cashBtn ghost"
            type="button"
            onClick={exportPDF}
            disabled={loading}
          >
            ⬇️ Descargar PDF
          </button>
        </div>
      </div>

      <div className="cashFilters">
        <button
          className={`cashFilter ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
          type="button"
        >
          Todos <span className="cashFilterCount">{counts.all}</span>
        </button>

        <button
          className={`cashFilter ${filter === "pending" ? "active" : ""}`}
          onClick={() => setFilter("pending")}
          type="button"
        >
          Pendientes <span className="cashFilterCount">{counts.pending}</span>
        </button>

        <button
          className={`cashFilter ${filter === "unpaid" ? "active" : ""}`}
          onClick={() => setFilter("unpaid")}
          type="button"
        >
          No cobrados <span className="cashFilterCount">{counts.unpaid}</span>
        </button>

        <button
          className={`cashFilter ${filter === "paid" ? "active" : ""}`}
          onClick={() => setFilter("paid")}
          type="button"
        >
          Cobrados <span className="cashFilterCount">{counts.paid}</span>
        </button>

        <button
          className={`cashFilter ${filter === "void" ? "active" : ""}`}
          onClick={() => setFilter("void")}
          type="button"
        >
          Anulados <span className="cashFilterCount">{counts.void}</span>
        </button>

        <label className="cashCtrl" style={{ minWidth: 220 }}>
          <span>Personal</span>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {staffOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cashSummary">
        <div className="card cashSumCard">
          <div className="cashSumTop">
            <div className="cashSumLabel">Cobrado</div>
            <div className="cashChip ok">
              {counts.paid}/{counts.all}
            </div>
          </div>
          <div className="cashSumValue">{money(totalPaid)}</div>
          <div className="cashSumHint muted">Ingresos confirmados</div>
        </div>

        <div className="card cashSumCard">
          <div className="cashSumTop">
            <div className="cashSumLabel">Pendiente</div>
            <div className="cashChip warn">{counts.pending + counts.unpaid}</div>
          </div>
          <div className="cashSumValue">{money(totalEstimatedPending)}</div>
          <div className="cashSumHint muted">
            No cobrado: {counts.unpaid} · Anulados: {counts.void}
          </div>
        </div>
      </div>

      <div className="cashList">
        {loading ? (
          <div className="card cashEmpty">Cargando ingresos...</div>
        ) : incomes.length === 0 ? (
          <div className="card cashEmpty">No hay ingresos con ese filtro.</div>
        ) : (
          incomes.map((i) => (
            <IncomeRow
              key={i.id}
              income={i}
              dateFallback={date}
              onChanged={() => setRefreshKey((k) => k + 1)}
              onToast={show}
              onConfirm={openConfirm}
            />
          ))
        )}
      </div>

      <Modal
        open={newOpen}
        title="Nuevo ingreso"
        onClose={() => setNewOpen(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div className="muted">
            Se registrará como <strong>cobrado</strong> en la fecha seleccionada (
            {formatDateDMY(date)}).
          </div>

          <div className="payGrid">
            <label className="selectField">
              <div className="label">Motivo</div>
              <select
                value={newType === "service" ? `service:${newServiceId}` : "other"}
                onChange={(e) => {
                  const v = e.target.value;

                  if (v === "other") {
                    setNewType("other");
                  } else if (v.startsWith("service:")) {
                    setNewType("service");
                    setNewServiceId(v.replace("service:", ""));
                  }
                }}
              >
                {services.map((s) => (
                  <option key={s.id} value={`service:${s.id}`}>
                    {s.name}
                  </option>
                ))}
                <option value="other">Otro</option>
              </select>
            </label>

            <label className="selectField">
              <div className="label">Método</div>
              <select
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value)}
              >
                {PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {labelPaymentMethod(opt.code)}
                  </option>
                ))}
              </select>
            </label>

            <label className="selectField">
              <div className="label">Monto</div>
              <input
                type="number"
                min="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </label>

            <label className="selectField" style={{ gridColumn: "1 / -1" }}>
              <div className="label">Detalle / Observación (opcional)</div>
              <textarea
                value={newDetail}
                onChange={(e) => setNewDetail(e.target.value)}
                placeholder={
                  newType === "other"
                    ? "Ej: venta bebida / producto / propina..."
                    : "Opcional"
                }
              />
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <button
              className="cashBtn ghost"
              type="button"
              onClick={() => setNewOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="cashBtn primary"
              type="button"
              onClick={createNewIncome}
            >
              Guardar ingreso
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmOpen}
        title={confirmCfg.title}
        onClose={() => setConfirmOpen(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div className="muted" style={{ lineHeight: 1.5 }}>
            {confirmCfg.message}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="cashBtn ghost"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </button>

            <button
              type="button"
              className={`cashBtn ${
                confirmCfg.tone === "danger" ? "danger" : "primary"
              }`}
              onClick={() => {
                const fn = confirmCfg.onConfirm;
                setConfirmOpen(false);
                if (typeof fn === "function") fn();
              }}
            >
              {confirmCfg.confirmText}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function IncomeRow({ income, dateFallback, onChanged, onToast, onConfirm }) {
  const [method, setMethod] = useState(income.paymentMethod ?? "cash");
  const [amount, setAmount] = useState(
    income.amountFinal ?? income.amountEstimated ?? income.amount ?? 0
  );

  const isPaid = income.paidStatus === "paid";
  const isVoid = income.paidStatus === "void";
  const isUnpaid = income.paidStatus === "unpaid";

  const clientLabel = getClientLabel(income);
  const serviceLabel = getServiceLabel(income);
  const dateStr = getIncomeDateStr(income, dateFallback);
  const timeLabel = getTimeLabel(income);
  const staffLabel = getStaffLabel(income);

  async function handlePay() {
    try {
      await api.post("/incomes/mark-paid", {
        incomeId: income.id,
        paymentMethod: method,
        amountFinal: Number(amount),
      });

      onToast?.({
        type: "success",
        title: "Cobro registrado",
        message: `${clientLabel} · ${serviceLabel} · ${money(amount)}`,
      });

      onChanged();
    } catch (err) {
      onToast?.({
        type: "error",
        title: "No se pudo cobrar",
        message:
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "Error al marcar como cobrado.",
      });
    }
  }

  function handleSetNoCobrado() {
    onConfirm?.({
      title: "Marcar como “No cobrado”",
      message:
        "Esto queda registrado como caso especial. Desde Caja no vas a poder cobrarlo hasta volverlo a “Pendiente”. ¿Querés continuar?",
      confirmText: "Sí, marcar",
      tone: "danger",
      onConfirm: async () => {
        try {
          await api.patch(`/incomes/${income.id}/status`, {
            paidStatus: "unpaid",
          });
          onToast?.({
            type: "success",
            title: "Actualizado",
            message: "Marcado como “No cobrado”.",
          });
          onChanged();
        } catch (err) {
          onToast?.({
            type: "error",
            title: "Error",
            message:
              err?.response?.data?.error?.message ||
              err?.response?.data?.message ||
              "No se pudo actualizar el estado.",
          });
        }
      },
    });
  }

  async function handleSetPendiente() {
    try {
      await api.patch(`/incomes/${income.id}/status`, { paidStatus: "pending" });
      onToast?.({
        type: "success",
        title: "Actualizado",
        message: "Volvió a estado “Pendiente”.",
      });
      onChanged();
    } catch (err) {
      onToast?.({
        type: "error",
        title: "Error",
        message:
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "No se pudo actualizar el estado.",
      });
    }
  }

  return (
    <div className="card cashItem">
      <div className="cashTop">
        <div className="cashTitle">
          <span className="cashService">{serviceLabel}</span>
          <span className="cashDot">•</span>
          <span className="cashClient">{clientLabel}</span>
        </div>

        <div className={`cashStatus ${income.paidStatus}`}>
          {labelStatusLocal(income.paidStatus)}
        </div>
      </div>

      <div className="cashMeta muted">
        {formatDateDMY(dateStr)} · {timeLabel}
      </div>

      <div className="cashMeta muted">Staff: {staffLabel}</div>

      <div className="cashRow">
        <div className="cashCol">
          <div className="cashLabel">Estimado</div>
          <div className="cashAmount">{money(getEstimated(income))}</div>
        </div>

        <div className="cashCol">
          <div className="cashLabel">Método</div>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={isPaid || isVoid || isUnpaid}
          >
            {PAYMENT_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {labelPaymentMethod(opt.code)}
              </option>
            ))}
          </select>
        </div>

        <div className="cashCol">
          <div className="cashLabel">Monto final</div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isPaid || isVoid || isUnpaid}
            min="0"
          />
        </div>

        <div className="cashCol cashActionCol">
          <div className="cashLabel">&nbsp;</div>

          <div className="cashActionsStack">
            <button
              className="cashBtn primary"
              type="button"
              onClick={handlePay}
              disabled={isPaid || isVoid || isUnpaid}
            >
              {isVoid ? "Anulado" : isPaid ? "Cobrado ✅" : "Cobrar"}
            </button>

            {income.paidStatus === "pending" ? (
              <button
                className="cashBtn danger"
                type="button"
                onClick={handleSetNoCobrado}
              >
                No cobrado
              </button>
            ) : null}

            {income.paidStatus === "unpaid" ? (
              <button
                className="cashBtn ghost"
                type="button"
                onClick={handleSetPendiente}
              >
                Volver a “Pendiente”
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}