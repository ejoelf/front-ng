import "./Exports.css";
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";

import api from "../../services/http";
import { toast } from "../../utils/toast";

import { formatDateDMY } from "../../utils/format";
import {
  labelApptStatus,
  labelIncomeStatus,
  labelPaymentMethod,
} from "../../utils/labels";
import { downloadPDF, addTitle, addTable } from "../../utils/pdf";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function minusDaysLocalISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeTrim(v) {
  return String(v ?? "").trim();
}

function isValidRange(fromDateStr, toDateStr) {
  if (!fromDateStr || !toDateStr) return false;
  return fromDateStr <= toDateStr;
}

function normalizeList(data, key) {
  const v = key ? data?.[key] : data;
  if (Array.isArray(v)) return v;
  if (Array.isArray(data)) return data;
  return [];
}

function labelChannel(channel) {
  const c = safeTrim(channel).toLowerCase();

  if (c === "web") return "Web";
  if (c === "manual") return "Manual";
  if (c === "whatsapp" || c === "wsp") return "WhatsApp";
  if (!c) return "—";

  return channel;
}

export default function Exports() {
  const [fromDate, setFromDate] = useState(minusDaysLocalISO(7));
  const [toDate, setToDate] = useState(todayLocalISO());
  const [error, setError] = useState("");

  const [loadingAppts, setLoadingAppts] = useState(false);
  const [loadingIncomes, setLoadingIncomes] = useState(false);

  const [apptRows, setApptRows] = useState([]);
  const [incomeRows, setIncomeRows] = useState([]);

  useEffect(() => {
    const f = safeTrim(fromDate);
    const t = safeTrim(toDate);

    if (!f || !t) {
      setError("Completá Desde y Hasta.");
      return;
    }

    if (t < f) {
      setError("El rango es inválido: 'Hasta' no puede ser menor que 'Desde'.");
      return;
    }

    setError("");
  }, [fromDate, toDate]);

  const canUse = useMemo(
    () => isValidRange(fromDate, toDate) && !error,
    [fromDate, toDate, error]
  );

  useEffect(() => {
    let alive = true;

    async function loadAll() {
      if (!canUse) {
        setApptRows([]);
        setIncomeRows([]);
        return;
      }

      const f = safeTrim(fromDate);
      const t = safeTrim(toDate);

      setLoadingAppts(true);
      setLoadingIncomes(true);

      try {
        const [apptsRes, incomesRes] = await Promise.all([
          api.get("/exports/appointments", { params: { from: f, to: t } }),
          api.get("/exports/incomes", { params: { from: f, to: t } }),
        ]);

        if (!alive) return;

        setApptRows(normalizeList(apptsRes.data, "appointments"));
        setIncomeRows(normalizeList(incomesRes.data, "incomes"));
      } catch (err) {
        if (!alive) return;
        toast.error(
          err?.response?.data?.error?.message ||
            "No se pudieron cargar las exportaciones."
        );
        setApptRows([]);
        setIncomeRows([]);
      } finally {
        if (alive) {
          setLoadingAppts(false);
          setLoadingIncomes(false);
        }
      }
    }

    loadAll();

    return () => {
      alive = false;
    };
  }, [canUse, fromDate, toDate, error]);

  const apptPreview = useMemo(() => apptRows.slice(0, 10), [apptRows]);
  const incomePreview = useMemo(() => incomeRows.slice(0, 10), [incomeRows]);

  function exportAppointmentsPDF() {
    if (!canUse) {
      toast.error(error || "Rango inválido.");
      return;
    }

    downloadPDF(`turnos_${fromDate}_a_${toDate}.pdf`, (doc) => {
      addTitle(
        doc,
        "Turnos",
        `Rango: ${formatDateDMY(fromDate)} a ${formatDateDMY(toDate)}`
      );

      const head = [
        "Fecha",
        "Inicio",
        "Fin",
        "Servicio",
        "Cliente",
        "Staff",
        "Estado",
        "Canal",
        "Precio",
      ];

      const body = apptRows.map((r) => [
        formatDateDMY(r.date),
        r.start,
        r.end,
        r.service,
        r.client,
        r.staff,
        labelApptStatus(r.status),
        labelChannel(r.channel),
        `$${Number(r.price ?? 0).toLocaleString("es-AR")}`,
      ]);

      addTable(doc, head, body, 28);
    });

    toast.success("PDF de Turnos generado ✅");
  }

  const totals = useMemo(() => {
    const cobrado = incomeRows
      .filter((r) => r.paidStatus === "paid")
      .reduce((acc, r) => acc + Number(r.amountFinal ?? 0), 0);

    const pendiente = incomeRows
      .filter((r) => r.paidStatus === "pending" || r.paidStatus === "unpaid")
      .reduce((acc, r) => acc + Number(r.amountEstimated ?? 0), 0);

    const anulados = incomeRows.filter((r) => r.paidStatus === "void").length;

    return { cobrado, pendiente, anulados };
  }, [incomeRows]);

  function exportCashboxPDF() {
    if (!canUse) {
      toast.error(error || "Rango inválido.");
      return;
    }

    downloadPDF(`caja_${fromDate}_a_${toDate}.pdf`, (doc) => {
      addTitle(
        doc,
        "Caja",
        `Rango: ${formatDateDMY(fromDate)} a ${formatDateDMY(toDate)}`
      );

      doc.setFontSize(11);
      doc.text(`Cobrado: $${totals.cobrado.toLocaleString("es-AR")}`, 14, 28);
      doc.text(
        `Pendiente / no cobrado (estimado): $${totals.pendiente.toLocaleString("es-AR")}`,
        14,
        34
      );
      doc.text(`Anulados: ${totals.anulados}`, 14, 40);

      const head = ["Fecha", "Cliente", "Servicio", "Estado", "Método", "Monto"];

      const body = incomeRows.map((r) => {
        const monto =
          r.paidStatus === "paid"
            ? Number(r.amountFinal ?? 0)
            : Number(r.amountEstimated ?? 0);

        const metodoLabel = r.paymentMethod
          ? labelPaymentMethod(r.paymentMethod)
          : "—";

        return [
          formatDateDMY(r.date),
          r.clientName,
          r.serviceName,
          labelIncomeStatus(r.paidStatus),
          metodoLabel,
          `$${monto.toLocaleString("es-AR")}`,
        ];
      });

      addTable(doc, head, body, 46);
    });

    toast.success("PDF de Caja generado ✅");
  }

  const loading = loadingAppts || loadingIncomes;

  return (
    <div className="exports">
      <div className="exportsHeader">
        <div>
          <h1>Exportaciones</h1>
          <div className="muted">
            Descarga en PDF por rango de fechas (Turnos + Caja).
          </div>
        </div>
      </div>

      <div className="card exportsCard">
        <div className="exportsGrid">
          <Input
            label="Desde"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <Input
            label="Hasta"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {error ? <div className="exportsError">{error}</div> : null}
        {loading && canUse ? (
          <div className="muted small" style={{ marginTop: 10 }}>
            Cargando datos del rango…
          </div>
        ) : null}
      </div>

      <div className="card exportsCard">
        <div className="exportsSectionTitle">Turnos (PDF)</div>

        <div className="exportsActions">
          <Button
            type="button"
            onClick={exportAppointmentsPDF}
            disabled={!canUse || loadingAppts}
          >
            Descargar PDF de Turnos
          </Button>
        </div>

        <div className="muted small">Preview (máx 10 filas):</div>

        <div className="exportsPreview">
          {!canUse ? (
            <div className="muted">Elegí un rango válido para ver el preview.</div>
          ) : loadingAppts ? (
            <div className="muted">Cargando turnos…</div>
          ) : apptPreview.length === 0 ? (
            <div className="muted">No hay turnos en ese rango.</div>
          ) : (
            <table className="exportsTable">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Inicio</th>
                  <th>Servicio</th>
                  <th>Cliente</th>
                  <th>Staff</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {apptPreview.map((r, idx) => (
                  <tr key={idx}>
                    <td>{formatDateDMY(r.date)}</td>
                    <td>{r.start}</td>
                    <td>{r.service}</td>
                    <td>{r.client}</td>
                    <td>{r.staff}</td>
                    <td>{labelApptStatus(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card exportsCard">
        <div className="exportsSectionTitle">Caja (PDF)</div>

        <div className="exportsSummary">
          <div className="sumBox">
            <div className="sumLabel">Cobrado</div>
            <div className="sumValue">${totals.cobrado.toLocaleString("es-AR")}</div>
          </div>
          <div className="sumBox">
            <div className="sumLabel">Pendiente / no cobrado (estimado)</div>
            <div className="sumValue">${totals.pendiente.toLocaleString("es-AR")}</div>
          </div>
          <div className="sumBox">
            <div className="sumLabel">Anulados</div>
            <div className="sumValue">{totals.anulados}</div>
          </div>
        </div>

        <div className="exportsActions">
          <Button
            type="button"
            onClick={exportCashboxPDF}
            disabled={!canUse || loadingIncomes}
          >
            Descargar PDF de Caja
          </Button>
        </div>

        <div className="muted small">Preview (máx 10 filas):</div>

        <div className="exportsPreview">
          {!canUse ? (
            <div className="muted">Elegí un rango válido para ver el preview.</div>
          ) : loadingIncomes ? (
            <div className="muted">Cargando caja…</div>
          ) : incomePreview.length === 0 ? (
            <div className="muted">No hay movimientos de caja en ese rango.</div>
          ) : (
            <table className="exportsTable">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th>Estado</th>
                  <th>Método</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {incomePreview.map((r, idx) => {
                  const monto =
                    r.paidStatus === "paid"
                      ? Number(r.amountFinal ?? 0)
                      : Number(r.amountEstimated ?? 0);

                  return (
                    <tr key={idx}>
                      <td>{formatDateDMY(r.date)}</td>
                      <td>{r.clientName}</td>
                      <td>{r.serviceName}</td>
                      <td>{labelIncomeStatus(r.paidStatus)}</td>
                      <td>
                        {r.paymentMethod ? labelPaymentMethod(r.paymentMethod) : "—"}
                      </td>
                      <td>${monto.toLocaleString("es-AR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}