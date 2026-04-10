import "./Dashboard.css";
import { useEffect, useMemo, useState } from "react";
import api from "../../services/http";
import { formatDateDMY } from "../../utils/format";
import {
  labelApptStatus,
  labelIncomeStatus,
  labelPaymentMethod,
} from "../../utils/labels";

const BUSINESS_TZ = "America/Argentina/Cordoba";

function getBusinessNowParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function todayISO() {
  const now = getBusinessNowParts();
  const yyyy = String(now.year);
  const mm = String(now.month).padStart(2, "0");
  const dd = String(now.day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function timeHHMMBusiness(iso) {
  if (!iso) return "—";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function dateISOInBusinessTZ(iso) {
  if (!iso) return "";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function minutesInBusinessTZ(iso) {
  if (!iso) return -1;

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return -1;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hh = Number(map.hour || 0);
  const mm = Number(map.minute || 0);

  return hh * 60 + mm;
}

function sum(n) {
  return Number(n || 0);
}

function mapApptStatusFromBack(status) {
  const s = String(status || "").trim();

  if (s === "done") return "completed";
  if (s === "completed") return "completed";
  if (s === "no_show") return "no-show";
  if (s === "pending") return "confirmed";

  return s || "confirmed";
}

function labelChannel(channel) {
  const c = String(channel || "").trim().toLowerCase();

  if (c === "web") return "Web";
  if (c === "manual") return "Manual";
  if (c === "whatsapp" || c === "wsp") return "WhatsApp";
  if (!c) return "—";

  return channel;
}

function normalizeAppointment(a) {
  return {
    ...a,
    status: mapApptStatusFromBack(a.status),
    clientName: a.clientName || "—",
    clientPhone: a.clientPhone || "",
    clientEmail: a.clientEmail || "",
    serviceName: a.serviceName || "—",
    staffName: a.staffName || "—",
    price: Number(a.price ?? 0) || 0,
    channel: a.channel || "dashboard",
  };
}

function normalizeIncome(i) {
  return {
    ...i,
    clientName: i.clientName || "—",
    serviceName: i.serviceName || "—",
    amountEstimated: Number(i.amountEstimated ?? 0) || 0,
    amountFinal:
      i.amountFinal == null ? null : Number(i.amountFinal ?? 0) || 0,
    paidStatus: i.paidStatus || "pending",
    paymentMethod: i.paymentMethod || null,
  };
}

export default function Dashboard() {
  const [date, setDate] = useState(todayISO());

  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [appts, setAppts] = useState([]);
  const [incomes, setIncomes] = useState([]);

  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadBase() {
      try {
        setError("");

        const [stRes, svRes] = await Promise.all([
          api.get("/staff"),
          api.get("/services"),
        ]);

        if (!alive) return;

        setStaff(Array.isArray(stRes?.data?.staff) ? stRes.data.staff : []);
        setServices(
          Array.isArray(svRes?.data?.services) ? svRes.data.services : []
        );
      } catch (e) {
        if (!alive) return;
        setError(
          e?.response?.data?.error?.message ||
            e?.response?.data?.message ||
            "Error cargando datos base."
        );
        setStaff([]);
        setServices([]);
      }
    }

    loadBase();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadDay() {
      try {
        setError("");

        const [apRes, incRes] = await Promise.all([
          api.get("/appointments/by-date", {
            params: { dateStr: date },
          }),
          api.get("/incomes/by-date", {
            params: { dateStr: date },
          }),
        ]);

        if (!alive) return;

        const apptsNorm = (
          Array.isArray(apRes?.data?.appointments) ? apRes.data.appointments : []
        )
          .map(normalizeAppointment)
          .sort((a, b) =>
            String(a.startAt || "").localeCompare(String(b.startAt || ""))
          );

        const incomesNorm = (
          Array.isArray(incRes?.data?.incomes) ? incRes.data.incomes : []
        ).map(normalizeIncome);

        setAppts(apptsNorm);
        setIncomes(incomesNorm);
      } catch (e) {
        if (!alive) return;
        setError(
          e?.response?.data?.error?.message ||
            e?.response?.data?.message ||
            "Error cargando datos del día."
        );
        setAppts([]);
        setIncomes([]);
      }
    }

    loadDay();

    return () => {
      alive = false;
    };
  }, [date]);

  const apptCount = appts.length;

  const apptStats = useMemo(() => {
    const map = {
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      "no-show": 0,
      rescheduled: 0,
    };

    for (const a of appts) {
      const k = a.status || "confirmed";
      if (map[k] !== undefined) map[k] += 1;
    }

    return map;
  }, [appts]);

  const nextAppts = useMemo(() => {
    const todayStr = todayISO();
    const nowParts = getBusinessNowParts();
    const nowMinutes = nowParts.hour * 60 + nowParts.minute;

    const list = appts.filter((a) => a.status !== "cancelled");

    if (date !== todayStr) return list.slice(0, 6);

    return list
      .filter((a) => {
        const apptDate = a.dateStr || dateISOInBusinessTZ(a.startAt);
        if (apptDate !== todayStr) return false;

        const apptEndMinutes = minutesInBusinessTZ(a.endAt);
        return apptEndMinutes >= nowMinutes;
      })
      .slice(0, 6);
  }, [appts, date]);

  const cashPaid = useMemo(() => {
    return incomes
      .filter((i) => i.paidStatus === "paid")
      .reduce((acc, i) => acc + sum(i.amountFinal), 0);
  }, [incomes]);

  const cashPending = useMemo(() => {
    return incomes
      .filter((i) => i.paidStatus === "pending" || i.paidStatus === "unpaid")
      .reduce((acc, i) => acc + sum(i.amountEstimated), 0);
  }, [incomes]);

  const cashVoid = useMemo(() => {
    return incomes.filter((i) => i.paidStatus === "void").length;
  }, [incomes]);

  const pendingLikeCount = useMemo(() => {
    return incomes.filter(
      (i) => i.paidStatus === "pending" || i.paidStatus === "unpaid"
    ).length;
  }, [incomes]);

  const staffRanking = useMemo(() => {
    const counter = new Map();

    for (const a of appts) {
      if (a.status === "cancelled") continue;
      const id = a.staffId || "unknown";
      counter.set(id, (counter.get(id) || 0) + 1);
    }

    const list = Array.from(counter.entries())
      .map(([id, qty]) => ({
        id,
        qty,
        name: staff.find((s) => s.id === id)?.name || aSafeNameById(appts, id),
      }))
      .sort((a, b) => b.qty - a.qty);

    return list.slice(0, 4);
  }, [appts, staff]);

  const serviceRanking = useMemo(() => {
    const counter = new Map();

    for (const a of appts) {
      if (a.status === "cancelled") continue;
      const id = a.serviceId || "unknown";
      counter.set(id, (counter.get(id) || 0) + 1);
    }

    const list = Array.from(counter.entries())
      .map(([id, qty]) => ({
        id,
        qty,
        name:
          services.find((s) => s.id === id)?.name ||
          aSafeServiceNameById(appts, id),
      }))
      .sort((a, b) => b.qty - a.qty);

    return list.slice(0, 4);
  }, [appts, services]);

  return (
    <div className="dash">
      <div className="dashHeader">
        <div>
          <h1>Dashboard</h1>
          <div className="muted">Resumen general del negocio</div>
          {error ? (
            <div className="muted" style={{ marginTop: 6 }}>
              ⚠️ {error}
            </div>
          ) : null}
        </div>

        <label className="dashCtrl">
          <span>Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      <div className="dashKpis">
        <div className="card dashKpi">
          <div className="dashKpiLabel">Turnos</div>
          <div className="dashKpiValue">{apptCount}</div>
          <div className="dashKpiHint">Fecha: {formatDateDMY(date)}</div>
        </div>

        <div className="card dashKpi">
          <div className="dashKpiLabel">Cobrado</div>
          <div className="dashKpiValue">
            ${cashPaid.toLocaleString("es-AR")}
          </div>
          <div className="dashKpiHint">
            {incomes.filter((i) => i.paidStatus === "paid").length} pagos
          </div>
        </div>

        <div className="card dashKpi">
          <div className="dashKpiLabel">Pendiente</div>
          <div className="dashKpiValue">
            ${cashPending.toLocaleString("es-AR")}
          </div>
          <div className="dashKpiHint">{pendingLikeCount} ingresos</div>
        </div>

        <div className="card dashKpi">
          <div className="dashKpiLabel">Anulados</div>
          <div className="dashKpiValue">{cashVoid}</div>
          <div className="dashKpiHint">Ingresos anulados</div>
        </div>
      </div>

      <div className="dashGrid">
        <div className="card dashPanel">
          <div className="dashPanelHead">
            <div>
              <div className="dashPanelTitle">Próximos turnos</div>
              <div className="dashPanelSub muted">Listado del día</div>
            </div>

            <div className="dashPill">{nextAppts.length} items</div>
          </div>

          {nextAppts.length === 0 ? (
            <div className="dashEmpty">
              No hay turnos próximos para esta fecha.
            </div>
          ) : (
            <div className="dashList">
              {nextAppts.map((a) => (
                <div key={a.id} className="dashItem">
                  <div className="dashItemLeft">
                    <div className="dashTime">
                      {timeHHMMBusiness(a.startAt)} – {timeHHMMBusiness(a.endAt)}
                    </div>
                    <div className="dashMain">
                      <strong>{a.serviceName}</strong> · {a.clientName}
                    </div>
                    <div className="dashMeta muted">
                      Staff: {a.staffName} - Canal: {labelChannel(a.channel)}
                    </div>
                  </div>

                  <div className={`dashBadge status-${a.status}`}>
                    {labelApptStatus(a.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card dashPanel">
          <div className="dashPanelHead">
            <div>
              <div className="dashPanelTitle">Estado de turnos</div>
              <div className="dashPanelSub muted">Distribución del día</div>
            </div>
          </div>

          <div className="dashStats">
            <StatRow label="Confirmados" value={apptStats.confirmed} />
            <StatRow label="Realizados" value={apptStats.completed} />
            <StatRow label="Reprogramados" value={apptStats.rescheduled} />
            <StatRow label="Cancelados" value={apptStats.cancelled} />
            <StatRow label="No vino" value={apptStats["no-show"]} />
          </div>

          <div className="dashDivider" />

          <div className="dashMiniRanks">
            <div className="dashRank">
              <div className="dashRankTitle">Staff</div>
              {staffRanking.length === 0 ? (
                <div className="muted">—</div>
              ) : (
                staffRanking.map((x) => (
                  <div className="dashRankRow" key={x.id}>
                    <span>{x.name}</span>
                    <span className="dashRankPill">{x.qty}</span>
                  </div>
                ))
              )}
            </div>

            <div className="dashRank">
              <div className="dashRankTitle">Servicios</div>
              {serviceRanking.length === 0 ? (
                <div className="muted">—</div>
              ) : (
                serviceRanking.map((x) => (
                  <div className="dashRankRow" key={x.id}>
                    <span>{x.name}</span>
                    <span className="dashRankPill">{x.qty}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="card dashPanel dashPanelWide">
          <div className="dashPanelHead">
            <div>
              <div className="dashPanelTitle">Movimientos de caja</div>
              <div className="dashPanelSub muted">Pagos del día</div>
            </div>
          </div>

          {incomes.length === 0 ? (
            <div className="dashEmpty">No hay ingresos en esa fecha.</div>
          ) : (
            <div className="dashTableWrap">
              <table className="dashTable">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Servicio</th>
                    <th>Estado</th>
                    <th>Método</th>
                    <th>Estimado</th>
                    <th>Final</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.slice(0, 8).map((i) => (
                    <tr key={i.id}>
                      <td>{i.clientName}</td>
                      <td>{i.serviceName}</td>
                      <td>
                        <span className={`dashBadge cash-${i.paidStatus}`}>
                          {labelIncomeStatus(i.paidStatus)}
                        </span>
                      </td>
                      <td className="muted">
                        {labelPaymentMethod(i.paymentMethod)}
                      </td>
                      <td>
                        ${Number(i.amountEstimated ?? 0).toLocaleString("es-AR")}
                      </td>
                      <td>
                        {i.paidStatus === "paid"
                          ? `$${Number(i.amountFinal ?? 0).toLocaleString("es-AR")}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {incomes.length > 8 ? (
                <div className="dashNote muted">
                  Mostrando 8 de {incomes.length}. Para ver todo y editar, entrá
                  en <strong> Caja</strong>.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="dashStatRow">
      <div className="dashStatLabel">{label}</div>
      <div className="dashStatValue">{value}</div>
    </div>
  );
}

function aSafeNameById(appts, staffId) {
  const found = appts.find((a) => a.staffId === staffId);
  return found?.staffName || "—";
}

function aSafeServiceNameById(appts, serviceId) {
  const found = appts.find((a) => a.serviceId === serviceId);
  return found?.serviceName || "—";
}