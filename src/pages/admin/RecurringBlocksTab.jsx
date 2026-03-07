// src/pages/admin/RecurringBlocksTab.jsx
import "./RecurringBlocksTab.css";
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/common/Button.jsx";
import Modal from "../../components/common/Modal.jsx";

import api from "../../services/http"; // ✅ axios con token
import { toast } from "../../utils/toast";

function safeTrim(v) {
  return String(v ?? "").trim();
}

function dayLabel(d) {
  const map = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return map[d] ?? String(d);
}

// Orden visual: Lun..Dom (pero valores siguen siendo 1..6,0)
const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];
const dayRank = (dow) => DAYS_ORDER.indexOf(Number(dow)); // para ordenar Lun..Dom

function normalizeList(data, key) {
  const v = key ? data?.[key] : data;
  if (Array.isArray(v)) return v;
  if (Array.isArray(data)) return data;
  return [];
}

export default function RecurringBlocksTab({ onChanged = () => {} }) {
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);

  const [staff, setStaff] = useState([]);
  const [items, setItems] = useState([]);

  // Form
  const [dayOfWeek, setDayOfWeek] = useState(1); // lunes
  const [staffId, setStaffId] = useState(""); // todos
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("14:00");
  const [reason, setReason] = useState("Almuerzo");

  // Confirm delete modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // block

  function bump() {
    setRefresh((x) => x + 1);
  }

  // Load staff + recurring blocks
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const [stRes, rbRes] = await Promise.all([
          api.get("/staff").catch(() => ({ data: null })),
          api.get("/recurring-blocks").catch(() => ({ data: null })),
        ]);

        if (!alive) return;

        const staffList = normalizeList(stRes.data, "staff");
        const blocks = normalizeList(rbRes.data, "recurringBlocks");

        setStaff(staffList);

        const sorted = blocks
          .slice()
          .sort((a, b) => {
            const ra = dayRank(a.dayOfWeek);
            const rb = dayRank(b.dayOfWeek);
            if (ra !== rb) return ra - rb;
            return (a.start || "").localeCompare(b.start || "");
          });

        setItems(sorted);
      } catch (err) {
        if (!alive) return;
        toast.error(err?.response?.data?.error?.message || "No se pudieron cargar los bloqueos recurrentes.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [refresh]);

  // ✅ si el staff seleccionado ya no existe, resetea a "Todos"
  useEffect(() => {
    if (!staffId) return;
    const exists = staff.some((s) => s.id === staffId);
    if (!exists) setStaffId("");
  }, [staff, staffId]);

  const staffNameById = useMemo(() => {
    const m = new Map();
    for (const s of staff) m.set(s.id, s.name);
    return m;
  }, [staff]);

  async function add() {
    const st = safeTrim(start);
    const en = safeTrim(end);
    const rs = safeTrim(reason);

    if (!st || !en) return toast.error("Definí horario inicio y fin.");
    if (en <= st) return toast.error("El fin debe ser mayor al inicio.");

    try {
      await api.post("/recurring-blocks", {
        dayOfWeek: Number(dayOfWeek),
        staffId: staffId || null,
        start: st,
        end: en,
        reason: rs || "Bloqueo recurrente",
      });

      toast.success("Bloqueo recurrente agregado ✅");
      bump();
      onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "No se pudo crear el bloqueo recurrente.");
    }
  }

  function askRemove(block) {
    setDeleteTarget(block);
    setConfirmOpen(true);
  }

  async function doRemove() {
    if (!deleteTarget?.id) return;

    try {
      await api.delete(`/recurring-blocks/${deleteTarget.id}`);
      toast.success("Bloqueo eliminado ✅");
      setConfirmOpen(false);
      setDeleteTarget(null);
      bump();
      onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "No se pudo eliminar el bloqueo.");
      setConfirmOpen(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="rb">
      <div className="rbHeader">
        <div>
          <h2>Bloqueos recurrentes</h2>
          <div className="muted">Sirve para almuerzos, reuniones, días fijos sin turnos, etc.</div>
        </div>
      </div>

      <div className="card rbCard">
        <div className="rbGrid">
          <label className="selectField">
            <div className="label">Día</div>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAYS_ORDER.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
          </label>

          <label className="selectField">
            <div className="label">Staff</div>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Todos</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="selectField">
            <div className="label">Inicio</div>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>

          <label className="selectField">
            <div className="label">Fin</div>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>

          <label className="selectField wide">
            <div className="label">Motivo</div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: Almuerzo" />
          </label>
        </div>

        <div className="rbActions">
          <Button type="button" onClick={add} disabled={loading}>
            Agregar bloqueo recurrente
          </Button>
        </div>
      </div>

      <div className="rbList">
        {loading ? (
          <div className="card rbEmpty">Cargando bloqueos…</div>
        ) : items.length === 0 ? (
          <div className="card rbEmpty">No hay bloqueos recurrentes todavía.</div>
        ) : (
          items.map((x) => (
            <div key={x.id} className="card rbItem">
              <div className="rbItemMain">
                <div className="rbItemTitle">
                  <strong>{dayLabel(x.dayOfWeek)}</strong> · {x.start}–{x.end}
                </div>
                <div className="muted">
                  {x.staffId ? `Staff: ${staffNameById.get(x.staffId) ?? "Staff"}` : "Staff: Todos"} ·{" "}
                  {x.reason || "—"}
                </div>
              </div>

              <Button variant="danger" type="button" onClick={() => askRemove(x)}>
                Eliminar
              </Button>
            </div>
          ))
        )}
      </div>

      {/* ✅ Confirm delete modal */}
      <Modal
        open={confirmOpen}
        title="Eliminar bloqueo recurrente"
        onClose={() => {
          setConfirmOpen(false);
          setDeleteTarget(null);
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div className="muted">
            Vas a eliminar el bloqueo de{" "}
            <strong>
              {deleteTarget ? `${dayLabel(deleteTarget.dayOfWeek)} · ${deleteTarget.start}–${deleteTarget.end}` : "—"}
            </strong>
            .
            <br />
            <strong>Esta acción no se puede deshacer.</strong>
          </div>

          <div className="apptActions" style={{ marginTop: 6 }}>
            <Button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                setDeleteTarget(null);
              }}
            >
              Cancelar
            </Button>

            <Button type="button" variant="danger" onClick={doRemove}>
              Sí, eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}