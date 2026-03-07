// src/pages/admin/MonthlyReport.jsx
import "./MonthlyReport.css";
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/common/Button";
import api from "../../services/http"; // ✅ axios con token
import { toast } from "../../utils/toast";

import { formatDateDMY } from "../../utils/format";
import { labelIncomeStatus, labelPaymentMethod } from "../../utils/labels";
import { downloadPDF, addTitle, addTable } from "../../utils/pdf";
import { groupPaymentMethod } from "../../utils/paymentMethods";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${pad2(m)}`; // yyyy-mm
}

function monthRange(monthKey) {
  const [yStr, mStr] = String(monthKey || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr); // 1-12

  if (!y || !m) {
    const now = new Date();
    const mk = monthKeyFromDate(now);
    return monthRange(mk);
  }

  const from = `${y}-${pad2(m)}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${pad2(m)}-${pad2(last)}`;
  return { from, to };
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeList(data, key) {
  const v = key ? data?.[key] : data;
  if (Array.isArray(v)) return v;
  if (Array.isArray(data)) return data;
  return [];
}

export default function MonthlyReport() {
  const [monthKey, setMonthKey] = useState(monthKeyFromDate(new Date()));

  const range = useMemo(() => monthRange(monthKey), [monthKey]);

  const [loading, setLoading] = useState(false);
  const [incomes, setIncomes] = useState([]);

  // ✅ fetch real
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const res = await api.get("/incomes/range", {
          params: { from: range.from, to: range.to },
        });

        if (!alive) return;
        setIncomes(normalizeList(res.data, "incomes"));
      } catch (err) {
        if (!alive) return;
        setIncomes([]);
        toast.error(err?.response?.data?.error?.message || "No se pudo cargar el resumen mensual.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [range.from, range.to]);

  const summary = useMemo(() => {
    const cobrado = incomes
      .filter((i) => i.paidStatus === "paid")
      .reduce((acc, i) => acc + toNumber(i.amountFinal), 0);

    const pendiente = incomes
      .filter((i) => i.paidStatus === "pending" || i.paidStatus === "unpaid")
      .reduce((acc, i) => acc + toNumber(i.amountEstimated), 0);

    const anulados = incomes.filter((i) => i.paidStatus === "void").length;

    // Totales por método de pago (solo cobrados)
    const byMethodMap = new Map();
    for (const i of incomes) {
      if (i.paidStatus !== "paid") continue;
      const key = groupPaymentMethod(i.paymentMethod);
      byMethodMap.set(key, (byMethodMap.get(key) ?? 0) + toNumber(i.amountFinal));
    }
    const byMethod = Array.from(byMethodMap.entries())
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total);

    // Totales por servicio (cobrados)
    const byServiceMap = new Map();
    for (const i of incomes) {
      if (i.paidStatus !== "paid") continue;
      const key = i.serviceName ?? "Servicio";
      byServiceMap.set(key, (byServiceMap.get(key) ?? 0) + toNumber(i.amountFinal));
    }
    const byService = Array.from(byServiceMap.entries())
      .map(([serviceName, total]) => ({ serviceName, total }))
      .sort((a, b) => b.total - a.total);

    return { cobrado, pendiente, anulados, byMethod, byService };
  }, [incomes]);

  function exportPDF() {
    const title = `Resumen mensual`;
    const subtitle = `Mes: ${monthKey} · Rango: ${formatDateDMY(range.from)} a ${formatDateDMY(range.to)} · Registros: ${
      incomes.length
    }`;

    downloadPDF(`resumen_mensual_${monthKey}.pdf`, (doc) => {
      addTitle(doc, title, subtitle);

      doc.setFontSize(11);
      doc.text(`Cobrado: $${summary.cobrado.toLocaleString("es-AR")}`, 14, 28);
      doc.text(`Pendiente (estimado): $${summary.pendiente.toLocaleString("es-AR")}`, 14, 34);
      doc.text(`Anulados: ${summary.anulados}`, 14, 40);

      // Tabla por método
      addTable(
        doc,
        ["Método", "Total cobrado"],
        summary.byMethod.map((x) => [labelPaymentMethod(x.method), `$${toNumber(x.total).toLocaleString("es-AR")}`]),
        48
      );

      const afterMethodY = doc.lastAutoTable?.finalY ?? 48;
      let nextY = afterMethodY + 8;

      if (nextY > 260) {
        doc.addPage();
        nextY = 20;
      }

      // Tabla por servicio
      addTable(
        doc,
        ["Servicio", "Total cobrado"],
        summary.byService.map((x) => [x.serviceName, `$${toNumber(x.total).toLocaleString("es-AR")}`]),
        nextY
      );

      const afterServiceY = doc.lastAutoTable?.finalY ?? nextY;
      let detailY = afterServiceY + 8;

      if (detailY > 240) {
        doc.addPage();
        detailY = 20;
      }

      // Tabla detalle
      addTable(
        doc,
        ["Fecha", "Cliente", "Servicio", "Estado", "Método", "Monto"],
        incomes.map((i) => {
          const monto = i.paidStatus === "paid" ? toNumber(i.amountFinal) : toNumber(i.amountEstimated);
          const metodoLabel = i.paidStatus === "paid" ? labelPaymentMethod(i.paymentMethod) : "-";

          return [
            formatDateDMY(i.date),
            i.clientName || "-",
            i.serviceName || "-",
            labelIncomeStatus(i.paidStatus),
            metodoLabel,
            `$${monto.toLocaleString("es-AR")}`,
          ];
        }),
        detailY
      );
    });

    toast.success("PDF mensual generado ✅");
  }

  return (
    <div className="monthly">
      <div className="monthlyHeader">
        <div>
          <h1>Resumen mensual</h1>
          <div className="muted">
            Mes: <strong>{monthKey}</strong> · {formatDateDMY(range.from)} a {formatDateDMY(range.to)} · Registros:{" "}
            {incomes.length}
          </div>
        </div>

        <div className="monthlyControls">
          <label className="monthlyCtrl">
            <span>Mes</span>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
            />
          </label>

          <Button type="button" onClick={exportPDF} disabled={loading}>
            Descargar PDF
          </Button>
        </div>
      </div>

      {loading ? <div className="muted small" style={{ marginBottom: 10 }}>Cargando…</div> : null}

      <div className="monthlyGrid">
        <div className="card monthlyCard">
          <div className="monthlyLabel">Cobrado</div>
          <div className="monthlyValue">${summary.cobrado.toLocaleString("es-AR")}</div>
        </div>

        <div className="card monthlyCard">
          <div className="monthlyLabel">Pendiente (estimado)</div>
          <div className="monthlyValue">${summary.pendiente.toLocaleString("es-AR")}</div>
        </div>

        <div className="card monthlyCard">
          <div className="monthlyLabel">Anulados</div>
          <div className="monthlyValue">{summary.anulados}</div>
        </div>
      </div>

      <div className="card monthlyTableCard">
        <div className="monthlySectionTitle">Totales por método (cobrados)</div>

        {summary.byMethod.length === 0 ? (
          <div className="muted">No hay cobros registrados en este mes.</div>
        ) : (
          <table className="monthlyTable">
            <thead>
              <tr>
                <th>Método</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.byMethod.map((x) => (
                <tr key={x.method}>
                  <td>{labelPaymentMethod(x.method)}</td>
                  <td>${toNumber(x.total).toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card monthlyTableCard">
        <div className="monthlySectionTitle">Totales por servicio (cobrados)</div>

        {summary.byService.length === 0 ? (
          <div className="muted">No hay cobros registrados en este mes.</div>
        ) : (
          <table className="monthlyTable">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.byService.map((x) => (
                <tr key={x.serviceName}>
                  <td>{x.serviceName}</td>
                  <td>${toNumber(x.total).toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}