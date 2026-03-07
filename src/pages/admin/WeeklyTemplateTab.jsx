// src/pages/admin/WeeklyTemplateTab.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import Button from "../../components/common/Button.jsx";
import Input from "../../components/common/Input.jsx";
import Modal from "../../components/common/Modal.jsx";
import "./WeeklyTemplateTab.css";

import api from "../../services/http"; // ✅ axios con token
import { toast } from "../../utils/toast";

function pad2(n) {
  return String(n).padStart(2, "0");
}

// ✅ fecha local YYYY-MM-DD (NO UTC)
function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeTrim(v) {
  return String(v ?? "").trim();
}

function normalizeList(data, key) {
  const v = key ? data?.[key] : data;
  if (Array.isArray(v)) return v;
  if (Array.isArray(data)) return data;
  return [];
}

function normalizeSummary(data) {
  // soporta: {created, skipped, ...} o {result:{...}} o payload directo
  const x = data?.result ?? data ?? {};
  return {
    created: Number(x.created ?? 0),
    skipped: Number(x.skipped ?? 0),
    sourceStart: x.sourceStart ?? x.source_week_start ?? "",
    targetStart: x.targetStart ?? x.target_week_start ?? "",
    weekStart: x.weekStart ?? x.week_start ?? "",
  };
}

export default function WeeklyTemplateTab({ onChanged = () => {} }) {
  const [loading, setLoading] = useState(true);

  // ✅ refresh local para que si cambian staff/bloqueos desde Ajustes, se vea acá
  const [refresh, setRefresh] = useState(0);
  const bump = useCallback(() => setRefresh((x) => x + 1), []);

  const [staff, setStaff] = useState([]);

  const [weekDateStr, setWeekDateStr] = useState(todayLocalISO());
  const [staffId, setStaffId] = useState("");
  const [includeFullDay, setIncludeFullDay] = useState(true);

  // ✅ modal confirmación
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCfg, setConfirmCfg] = useState({
    title: "Confirmar",
    message: "",
    confirmText: "Confirmar",
    tone: "primary", // primary | danger | ghost
    onConfirm: null,
  });

  // ✅ modal resultado
  const [resultOpen, setResultOpen] = useState(false);
  const [resultCfg, setResultCfg] = useState({ title: "Listo", message: "" });

  function openConfirm({ title, message, confirmText, tone, onConfirm }) {
    setConfirmCfg({
      title: title || "Confirmar",
      message: message || "",
      confirmText: confirmText || "Confirmar",
      tone: tone || "primary",
      onConfirm: typeof onConfirm === "function" ? onConfirm : null,
    });
    setConfirmOpen(true);
  }

  function openResult({ title, message }) {
    setResultCfg({ title: title || "Listo", message: message || "" });
    setResultOpen(true);
  }

  // ✅ Load staff
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const res = await api.get("/staff");
        if (!alive) return;

        const list = normalizeList(res.data, "staff");
        setStaff(list);
      } catch (err) {
        if (!alive) return;
        toast.error(err?.response?.data?.error?.message || "No se pudo cargar el staff.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [refresh]);

  // ✅ si el staff seleccionado ya no existe (lo borraron), reset
  useEffect(() => {
    if (!staffId) return;
    const exists = staff.some((s) => s.id === staffId);
    if (!exists) setStaffId("");
  }, [staff, staffId]);

  const staffName = useMemo(() => {
    if (!staffId) return "Todos";
    return staff.find((s) => s.id === staffId)?.name || "Staff";
  }, [staff, staffId]);

  async function doCopyBlocks() {
    const targetWeekDateStr = safeTrim(weekDateStr);
    if (!targetWeekDateStr) return toast.error("Elegí una fecha de semana destino.");

    try {
      const res = await api.post("/blocks/copy-week", {
        targetWeekDateStr,
        staffId: staffId || null,
        includeFullDay,
      });

      const s = normalizeSummary(res.data);

      onChanged();
      bump();

      toast.success("Bloqueos copiados ✅");
      openResult({
        title: "Listo ✅",
        message:
          `Bloqueos copiados: ${s.created}\n` +
          `Duplicados salteados: ${s.skipped}\n\n` +
          `Staff: ${staffName}\n` +
          `Incluye día completo: ${includeFullDay ? "Sí" : "No"}\n\n` +
          (s.sourceStart && s.targetStart
            ? `Semana origen: ${s.sourceStart}\nSemana destino: ${s.targetStart}`
            : "Operación completada."),
      });
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "No se pudo copiar la semana.");
    }
  }

  async function doCopySpecialDays() {
    const targetWeekDateStr = safeTrim(weekDateStr);
    if (!targetWeekDateStr) return toast.error("Elegí una fecha de semana destino.");

    try {
      const res = await api.post("/special-days/copy-week", {
        targetWeekDateStr,
      });

      const s = normalizeSummary(res.data);

      onChanged();
      bump();

      toast.success("Excepciones copiadas ✅");
      openResult({
        title: "Listo ✅",
        message:
          `Excepciones copiadas: ${s.created}\n` +
          `Duplicados salteados: ${s.skipped}\n\n` +
          (s.sourceStart && s.targetStart
            ? `Semana origen: ${s.sourceStart}\nSemana destino: ${s.targetStart}`
            : "Operación completada."),
      });
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "No se pudo copiar las excepciones.");
    }
  }

  function doConvertToRecurring() {
    const wd = safeTrim(weekDateStr);
    if (!wd) return toast.error("Elegí una fecha dentro de la semana.");

    openConfirm({
      title: "Convertir a recurrentes",
      tone: "danger",
      confirmText: "Sí, convertir",
      message:
        `Esto va a crear BLOQUEOS RECURRENTES a partir de los bloqueos de esa semana.\n\n` +
        `Semana (por fecha): ${wd}\n` +
        `Staff: ${staffName}\n` +
        `Incluye día completo: ${includeFullDay ? "Sí" : "No"}\n\n` +
        `¿Confirmás?`,
      onConfirm: async () => {
        try {
          const res = await api.post("/recurring-blocks/from-week", {
            weekDateStr: wd,
            staffId: staffId || null,
            includeFullDay,
          });

          const s = normalizeSummary(res.data);

          onChanged();
          bump();

          toast.success("Recurrencias creadas ✅");
          openResult({
            title: "Listo ✅",
            message:
              `Recurrencias creadas: ${s.created}\n` +
              `Duplicados salteados: ${s.skipped}\n\n` +
              `Staff: ${staffName}\n` +
              `Incluye día completo: ${includeFullDay ? "Sí" : "No"}\n\n` +
              (s.weekStart ? `Semana: ${s.weekStart}` : "Operación completada."),
          });
        } catch (err) {
          toast.error(err?.response?.data?.error?.message || "No se pudo convertir a recurrentes.");
        }
      },
    });
  }

  return (
    <div className="wt">
      <div className="wtHeader">
        <div>
          <h2 style={{ margin: 0 }}>Plantilla semanal</h2>
          <div className="muted small wtHint">
            - “Copiar semana pasada” duplica bloqueos por fecha (+7 días). <br />
            - “Convertir a recurrentes” transforma los bloqueos de esa semana en reglas semanales.
          </div>
        </div>
      </div>

      <div className="panel card wtCard">
        <div className="form wtGrid">
          <div className="wide">
            <Input
              label="Semana destino (elegí cualquier día dentro de esa semana)"
              type="date"
              value={weekDateStr}
              onChange={(e) => setWeekDateStr(e.target.value)}
            />
          </div>

          <label className="selectField wide">
            <div className="label">Staff (opcional)</div>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} disabled={loading}>
              <option value="">Todos</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="chips wide">
            <button
              type="button"
              className={`chip ${includeFullDay ? "active" : ""}`}
              onClick={() => setIncludeFullDay(true)}
            >
              Incluir bloqueos día completo
            </button>
            <button
              type="button"
              className={`chip ${!includeFullDay ? "active" : ""}`}
              onClick={() => setIncludeFullDay(false)}
            >
              Excluir bloqueos día completo
            </button>
          </div>

          <div className="wtActions wide">
            <Button type="button" onClick={doCopyBlocks} disabled={loading}>
              Copiar bloqueos de la semana pasada
            </Button>

            <Button type="button" onClick={doCopySpecialDays} disabled={loading}>
              Copiar excepciones (calendario) de la semana pasada
            </Button>

            <Button type="button" onClick={doConvertToRecurring} disabled={loading}>
              Convertir bloqueos de esta semana a recurrentes
            </Button>
          </div>
        </div>
      </div>

      {/* ✅ Confirm modal */}
      <Modal open={confirmOpen} title={confirmCfg.title} onClose={() => setConfirmOpen(false)}>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="muted" style={{ lineHeight: 1.5, whiteSpace: "pre-line" }}>
            {confirmCfg.message}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" className="cashBtn ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </button>

            <button
              type="button"
              className={`cashBtn ${confirmCfg.tone === "danger" ? "danger" : "primary"}`}
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

      {/* ✅ Result modal */}
      <Modal open={resultOpen} title={resultCfg.title} onClose={() => setResultOpen(false)}>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="muted" style={{ lineHeight: 1.5, whiteSpace: "pre-line" }}>
            {resultCfg.message}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="cashBtn primary" onClick={() => setResultOpen(false)}>
              Ok
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}