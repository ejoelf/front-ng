import "./Calendar.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { PAYMENT_OPTIONS } from "../../utils/paymentMethods";
import {
  labelPaymentMethod,
  labelApptStatus,
  labelIncomeStatus,
} from "../../utils/labels";

import api from "../../services/http";
import { combineDateAndTime } from "../../utils/time";
import { formatDateDMY } from "../../utils/format";
import { toast } from "../../utils/toast";

/* ===================== HELPERS (LOCAL SAFE) ===================== */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function minutesBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function timeHHMMLocal(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${hh}:${mm}`;
}

function hmToMin(hm) {
  const [h, m] = String(hm || "00:00")
    .split(":")
    .map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function minToHM(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function firstNameOnly(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0];
}

function isPastAppointment(appt) {
  const now = new Date();
  const end = new Date(appt.endAt);
  return now > end;
}

function splitName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return { firstName: "", lastName: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeBusiness(data) {
  const b = data?.business || data || null;
  if (!b) return null;

  const schedule = b.schedule || b.businessSchedule || null;

  const fallback = {
    intervals: [
      { start: "09:00", end: "13:00" },
      { start: "15:00", end: "20:00" },
    ],
  };

  return {
    ...b,
    schedule: schedule?.intervals ? schedule : fallback,
  };
}

function normalizeList(data, key) {
  const v = key ? data?.[key] : data;
  if (Array.isArray(v)) return v;
  if (Array.isArray(data)) return data;
  return [];
}

function mapApptStatusFromBack(status) {
  const s = String(status || "").trim();

  if (s === "done") return "completed";
  if (s === "completed") return "completed";
  if (s === "no_show") return "no-show";
  if (s === "pending") return "confirmed";

  return s || "confirmed";
}

function normalizeAppointment(a) {
  return {
    ...a,
    status: mapApptStatusFromBack(a.status),
    clientName: a.clientName || a.client?.name || "—",
    clientPhone: a.clientPhone || a.client?.phone || "",
    clientEmail: a.clientEmail || a.client?.email || "",
    serviceName: a.serviceName || a.service?.name || "—",
    staffName: a.staffName || a.staff?.name || "—",
    price: Number(a.price ?? 0) || 0,
  };
}

function isHalfHourHM(hm) {
  const m = hmToMin(hm) % 60;
  return m === 0 || m === 30;
}

function isHalfHourISO(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const m = d.getMinutes();
  return m === 0 || m === 30;
}

/* ===================== UI SETTINGS ===================== */

const PX_PER_MIN = 2.4;
const STEP_OPTIONS = [5, 10, 15, 20, 30, 60];
const APPOINTMENT_STEP_MIN = 30;

/* ===================== TOOLTIP (hover) ===================== */

function Tooltip({ data }) {
  if (!data) return null;

  const TOOLTIP_WIDTH = 320;
  const MARGIN = 16;
  const GAP = 14;
  const APPROX_HEIGHT = 190;

  let left = data.x + GAP;
  let top = data.y + GAP;

  if (left + TOOLTIP_WIDTH > window.innerWidth - MARGIN) {
    left = data.x - TOOLTIP_WIDTH - GAP;
  }

  if (left < MARGIN) {
    left = MARGIN;
  }

  if (top + APPROX_HEIGHT > window.innerHeight - MARGIN) {
    top = Math.max(MARGIN, window.innerHeight - APPROX_HEIGHT - MARGIN);
  }

  const style = {
    left,
    top,
  };

  return (
    <div className="calTip" style={style} role="tooltip">
      <div className="calTipTitle">
        {data.clientName} · {data.serviceName}
      </div>
      <div className="calTipRow">
        <span>Hora:</span> {data.timeRange}
      </div>
      <div className="calTipRow">
        <span>Staff:</span> {data.staffName}
      </div>
      <div className="calTipRow">
        <span>Estado:</span> {labelApptStatus(data.status)}
      </div>
      <div className="calTipRow">
        <span>Cobro:</span>{" "}
        {data.income ? labelIncomeStatus(data.income.paidStatus) : "—"}
      </div>
      <div className="calTipRow">
        <span>WhatsApp:</span> {data.clientPhone || "—"}
      </div>
      <div className="calTipRow">
        <span>Email:</span> {data.clientEmail || "—"}
      </div>
    </div>
  );
}

/* ===================== MAIN ===================== */

export default function Calendar() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const highlightId = searchParams.get("highlight");
  const dateFromURL = searchParams.get("date");

  useEffect(() => {
    if (dateFromURL) {
      setDate(dateFromURL);
    }
  }, [dateFromURL]);

  const [highlightDone, setHighlightDone] = useState(false);

  const playSound = () => {
    const audio = new Audio(
      "https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3"
    );
    audio.volume = 0.25;
    audio.play().catch(() => {});
  };

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingAppts, setLoadingAppts] = useState(false);

  const [business, setBusiness] = useState(null);
  const [staff, setStaff] = useState([]);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);

  const [date, setDate] = useState(todayLocalISO());
  const [staffId, setStaffId] = useState("");
  const [refresh, setRefresh] = useState(0);

  const [viewStepMin, setViewStepMin] = useState(30);

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const [open, setOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);

  const [newOpen, setNewOpen] = useState(false);
  const [newPrefill, setNewPrefill] = useState(null);

  const [tip, setTip] = useState(null);
  const tipLockRef = useRef(false);

  const [appts, setAppts] = useState([]);
  const [incomeByApptId, setIncomeByApptId] = useState(new Map());

  useEffect(() => {
    if (!highlightId) return;
    if (!appts.length) return;
    if (highlightDone) return;

    const target = appts.find((a) => String(a.id) === String(highlightId));
    if (!target) return;

    const el = document.getElementById(`appt-${target.id}`);

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        setSelectedAppt(target);
        setOpen(true);
        playSound();
      }, 500);

      setTimeout(() => {
        navigate("/admin/calendar", { replace: true });
      }, 1500);

      setHighlightDone(true);
    }
  }, [highlightId, appts, highlightDone, navigate]);

  useEffect(() => {
    let alive = true;

    async function loadBase() {
      setLoadingBase(true);
      try {
        const [bRes, stRes, svRes, clRes] = await Promise.all([
          api.get("/business").catch(() => ({ data: null })),
          api.get("/staff").catch(() => ({ data: null })),
          api.get("/services").catch(() => ({ data: null })),
          api
            .get("/clients", { params: { limit: 500 } })
            .catch(() => ({ data: null })),
        ]);

        if (!alive) return;

        setBusiness(normalizeBusiness(bRes.data));
        setStaff(normalizeList(stRes.data, "staff"));
        setServices(normalizeList(svRes.data, "services"));
        setClients(normalizeList(clRes.data, "clients"));
      } catch (err) {
        if (!alive) return;
        toast.error(
          err?.response?.data?.error?.message ||
            "No se pudieron cargar datos base (business/staff/services/clients)."
        );
      } finally {
        if (alive) setLoadingBase(false);
      }
    }

    loadBase();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadAppts() {
      if (!date) return;

      setLoadingAppts(true);
      try {
        const { data } = await api.get("/appointments/by-date", {
          params: { dateStr: date, staffId: staffId || undefined },
        });

        const list = normalizeList(data, "appointments")
          .map(normalizeAppointment)
          .slice()
          .sort((a, b) =>
            String(a.startAt || "").localeCompare(String(b.startAt || ""))
          );

        if (!alive) return;
        setAppts(list);
      } catch (err) {
        if (!alive) return;
        toast.error(
          err?.response?.data?.error?.message ||
            "No se pudieron cargar los turnos."
        );
        setAppts([]);
      } finally {
        if (alive) setLoadingAppts(false);
      }
    }

    loadAppts();
    return () => {
      alive = false;
    };
  }, [date, staffId, refresh]);

  useEffect(() => {
    let alive = true;

    async function loadIncomesForAppts() {
      const m = new Map();
      const needsFetch = [];

      for (const a of appts) {
        if (a?.income) {
          m.set(a.id, a.income);
        } else {
          needsFetch.push(a.id);
        }
      }

      if (alive) setIncomeByApptId(m);

      if (needsFetch.length === 0) return;

      try {
        const results = await Promise.all(
          needsFetch.map((id) =>
            api
              .get(`/incomes/by-appointment/${id}`)
              .then((r) => ({ ok: true, id, data: r.data }))
              .catch(() => ({ ok: false, id, data: null }))
          )
        );

        if (!alive) return;

        const next = new Map(m);
        for (const r of results) {
          if (!r.ok) continue;
          const inc = r.data?.income || r.data;
          if (inc) next.set(r.id, inc);
        }
        setIncomeByApptId(next);
      } catch {
        // no rompemos la UI si falla
      }
    }

    loadIncomesForAppts();
    return () => {
      alive = false;
    };
  }, [appts]);

  const viewingAllStaff = !staffId;

  const activeSchedule = useMemo(() => {
    const fallbackSchedule = {
      intervals: [
        { start: "09:00", end: "13:00" },
        { start: "15:00", end: "20:00" },
      ],
    };

    if (!staffId) return business?.schedule || fallbackSchedule;

    const st = staff.find((s) => s.id === staffId);
    return st?.scheduleOverride?.intervals
      ? st.scheduleOverride
      : business?.schedule || fallbackSchedule;
  }, [business, staff, staffId]);

  const sections = useMemo(() => {
    const intervals = activeSchedule?.intervals || [];
    return intervals.map((intv, idx) => ({
      key: idx,
      title: idx === 0 ? "Mañana" : "Tarde",
      start: intv.start,
      end: intv.end,
    }));
  }, [activeSchedule]);

  function openNewAppt(prefill) {
    setNewPrefill(prefill || null);
    setNewOpen(true);
  }

  function isSlotFree({ slotMin, staffIdCheck }) {
    const slotISO = combineDateAndTime(date, minToHM(slotMin)).toISOString();

    for (const a of appts) {
      if (staffIdCheck && a.staffId !== staffIdCheck) continue;
      if (a.status === "cancelled") continue;

      const aStart = new Date(a.startAt).getTime();
      const aEnd = new Date(a.endAt).getTime();
      const t = new Date(slotISO).getTime();

      if (t >= aStart && t < aEnd) return false;
    }

    return true;
  }

  if (loadingBase) {
    return (
      <div className="cal">
        <div className="card" style={{ padding: 16 }}>
          Cargando agenda...
        </div>
      </div>
    );
  }

  return (
    <div className="cal">
      <div
        className={highlightId ? "calHighlightActive" : ""}
        onClick={() => {
          if (highlightId) {
            navigate("/admin/calendar", { replace: true });
            setHighlightDone(false);
          }
        }}
      >
        <div className="calHeader">
          <div>
            <h1>Agenda</h1>
            <div className="muted">
              Click en un turno para acciones (cobro / estado / reprogramar).
              Click en un espacio libre para “Nuevo turno”.
            </div>
          </div>

          <div className="calControls">
            <label className="calCtrl">
              <span>Fecha</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label className="calCtrl">
              <span>Staff</span>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">Todos</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="calCtrl">
              <span>Vista</span>
              <select
                value={viewStepMin}
                onChange={(e) => setViewStepMin(Number(e.target.value))}
              >
                {STEP_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    Cada {m} min
                  </option>
                ))}
              </select>
            </label>

            <div className="calNewWrap">
              <Button
                type="button"
                onClick={() => {
                  openNewAppt({
                    mode: "button",
                    dateStr: date,
                    staffId: staffId || "",
                    startHM: "",
                  });
                }}
              >
                Nuevo
              </Button>
            </div>
          </div>
        </div>

        <Tooltip data={tip} />

        {loadingAppts ? (
          <div className="card" style={{ padding: 12, marginBottom: 10 }}>
            Cargando turnos…
          </div>
        ) : null}

        <div
          className="calSections"
          onMouseMove={(e) => {
            if (!tip) return;
            if (tipLockRef.current) return;
            setTip((prev) =>
              prev ? { ...prev, x: e.clientX, y: e.clientY } : prev
            );
          }}
        >
          {sections.map((sec) => {
            const secStart = combineDateAndTime(date, sec.start);
            const secEnd = combineDateAndTime(date, sec.end);

            const totalMin = minutesBetween(secStart, secEnd);
            const laneHeightPx = totalMin * PX_PER_MIN;

            const secStartMin = hmToMin(sec.start);
            const secEndMin = hmToMin(sec.end);

            const apptsInSection = appts.filter((a) => {
              const startMin = hmToMin(timeHHMMLocal(a.startAt));
              return startMin >= secStartMin && startMin < secEndMin;
            });

            const tickPx = viewStepMin * PX_PER_MIN;

            const nowLine = (() => {
              void nowTick;

              const now = new Date();
              const todayStr = todayLocalISO();
              if (todayStr !== date) return null;

              const nowMin = now.getHours() * 60 + now.getMinutes();
              if (nowMin < secStartMin || nowMin > secEndMin) return null;

              const topMin = nowMin - secStartMin;
              return {
                topPx: topMin * PX_PER_MIN,
                label: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
              };
            })();

            const slotMins = Array.from(
              { length: Math.floor(totalMin / APPOINTMENT_STEP_MIN) },
              (_, i) => secStartMin + i * APPOINTMENT_STEP_MIN
            ).filter((m) => m < secEndMin);

            return (
              <div
                key={sec.key}
                className="calSection card"
                style={{
                  "--tickPx": `${tickPx}px`,
                }}
              >
                <div className="calSectionTitleRow">
                  <div className="calSectionTitle">
                    {sec.title} ({sec.start}–{sec.end})
                  </div>
                </div>

                <div className="calTimeline">
                  <div className="calTimes">
                    {viewingAllStaff ? <div className="calLaneHeaderSpacer" /> : null}

                    {Array.from({
                      length: Math.floor(totalMin / viewStepMin) + 1,
                    }).map((_, i) => {
                      const labelMin = secStartMin + i * viewStepMin;
                      const label = minToHM(labelMin);

                      return (
                        <div
                          key={`${sec.key}-${label}`}
                          className="calTimeTick"
                          style={{ height: `${tickPx}px` }}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  {!viewingAllStaff ? (
                    <div
                      className="calBlocks calGridBg"
                      style={{ height: `${laneHeightPx}px` }}
                    >
                      {nowLine ? (
                        <div className="calNowLine" style={{ top: `${nowLine.topPx}px` }}>
                          <div className="calNowDot" aria-hidden="true" />
                          <div className="calNowBubble">{nowLine.label}</div>
                        </div>
                      ) : null}

                      {staffId ? (
                        <div className="calSlotsLayer">
                          {slotMins.map((slotMin) => {
                            const topPx = (slotMin - secStartMin) * PX_PER_MIN;
                            const free = isSlotFree({
                              slotMin,
                              staffIdCheck: staffId,
                            });

                            return (
                              <button
                                key={`slot-${sec.key}-${staffId}-${slotMin}`}
                                type="button"
                                className={`calSlot ${free ? "free" : "busy"}`}
                                style={{
                                  top: `${topPx}px`,
                                  height: `${APPOINTMENT_STEP_MIN * PX_PER_MIN}px`,
                                }}
                                onClick={() => {
                                  if (!free) return;
                                  openNewAppt({
                                    mode: "slot",
                                    dateStr: date,
                                    staffId,
                                    startHM: minToHM(slotMin),
                                  });
                                }}
                                title={free ? "Nuevo turno" : "Ocupado"}
                              />
                            );
                          })}
                        </div>
                      ) : null}

                      {apptsInSection.map((a) => {
                        const startLabel = timeHHMMLocal(a.startAt);
                        const startMin = hmToMin(startLabel);

                        const aStart = new Date(a.startAt);
                        const aEnd = new Date(a.endAt);

                        const topMin = startMin - secStartMin;
                        const heightMin = Math.max(10, minutesBetween(aStart, aEnd));

                        const topPx = topMin * PX_PER_MIN;
                        const heightPx = heightMin * PX_PER_MIN;

                        const who = firstNameOnly(a.clientName);

                        return (
                          <button
                            key={a.id}
                            id={`appt-${a.id}`}
                            type="button"
                            className={`calBlock status-${a.status} ${
                              String(a.id) === String(highlightId)
                                ? "highlight focusMode"
                                : "fade"
                            }`}
                            style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                            onClick={() => {
                              setSelectedAppt(a);
                              setOpen(true);
                            }}
                            onMouseEnter={(e) => {
                              const inc = incomeByApptId.get(a.id) || null;
                              setTip({
                                x: e.clientX,
                                y: e.clientY,
                                clientName: a.clientName || "—",
                                clientPhone: a.clientPhone || "",
                                clientEmail: a.clientEmail || "",
                                serviceName: a.serviceName || "—",
                                staffName: a.staffName || "—",
                                status: a.status,
                                timeRange: `${timeHHMMLocal(a.startAt)}–${timeHHMMLocal(
                                  a.endAt
                                )}`,
                                income: inc,
                              });
                            }}
                            onMouseLeave={() => setTip(null)}
                          >
                            <div className="calBlockLine">
                              <span className="calBlockSvc">
                                {String(a.serviceName || "").toUpperCase()}
                              </span>
                              <span className="calBlockSep">—</span>
                              <span className="calBlockClient">{who}</span>
                              <span className="calBlockSep">—</span>
                              <span className="calBlockTime">{startLabel}hs</span>
                            </div>
                          </button>
                        );
                      })}

                      {apptsInSection.length === 0 ? (
                        <div className="calEmpty">Sin turnos en este tramo.</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="calBlocksMulti" style={{ "--cols": staff.length }}>
                      {staff.map((st) => {
                        const items = apptsInSection.filter((a) => a.staffId === st.id);

                        return (
                          <div key={st.id} className="calLane">
                            <div className="calLaneHeader">{st.name}</div>

                            <div
                              className="calLaneBody calGridBg"
                              style={{ height: `${laneHeightPx}px` }}
                            >
                              {nowLine ? (
                                <div
                                  className="calNowLine"
                                  style={{ top: `${nowLine.topPx}px` }}
                                >
                                  <div className="calNowDot" aria-hidden="true" />
                                  <div className="calNowBubble">{nowLine.label}</div>
                                </div>
                              ) : null}

                              <div className="calSlotsLayer">
                                {slotMins.map((slotMin) => {
                                  const topPx = (slotMin - secStartMin) * PX_PER_MIN;
                                  const free = isSlotFree({
                                    slotMin,
                                    staffIdCheck: st.id,
                                  });

                                  return (
                                    <button
                                      key={`slot-${sec.key}-${st.id}-${slotMin}`}
                                      type="button"
                                      className={`calSlot ${free ? "free" : "busy"}`}
                                      style={{
                                        top: `${topPx}px`,
                                        height: `${APPOINTMENT_STEP_MIN * PX_PER_MIN}px`,
                                        left: 10,
                                        right: 10,
                                      }}
                                      onClick={() => {
                                        if (!free) return;
                                        openNewAppt({
                                          mode: "slot",
                                          dateStr: date,
                                          staffId: st.id,
                                          startHM: minToHM(slotMin),
                                        });
                                      }}
                                      title={free ? "Nuevo turno" : "Ocupado"}
                                    />
                                  );
                                })}
                              </div>

                              {items.map((a) => {
                                const startLabel = timeHHMMLocal(a.startAt);
                                const startMin = hmToMin(startLabel);

                                const aStart = new Date(a.startAt);
                                const aEnd = new Date(a.endAt);

                                const topMin = startMin - secStartMin;
                                const heightMin = Math.max(
                                  10,
                                  minutesBetween(aStart, aEnd)
                                );

                                const topPx = topMin * PX_PER_MIN;
                                const heightPx = heightMin * PX_PER_MIN;

                                const who = firstNameOnly(a.clientName);

                                return (
                                  <button
                                    key={a.id}
                                    id={`appt-${a.id}`}
                                    type="button"
                                    className={`calBlock status-${a.status} ${
                                      String(a.id) === String(highlightId)
                                        ? "highlight focusMode"
                                        : "fade"
                                    }`}
                                    style={{
                                      top: `${topPx}px`,
                                      height: `${heightPx}px`,
                                      left: 10,
                                      right: 10,
                                    }}
                                    onClick={() => {
                                      setSelectedAppt(a);
                                      setOpen(true);
                                    }}
                                    onMouseEnter={(e) => {
                                      const inc = incomeByApptId.get(a.id) || null;
                                      setTip({
                                        x: e.clientX,
                                        y: e.clientY,
                                        clientName: a.clientName || "—",
                                        clientPhone: a.clientPhone || "",
                                        clientEmail: a.clientEmail || "",
                                        serviceName: a.serviceName || "—",
                                        staffName: a.staffName || "—",
                                        status: a.status,
                                        timeRange: `${timeHHMMLocal(
                                          a.startAt
                                        )}–${timeHHMMLocal(a.endAt)}`,
                                        income: inc,
                                      });
                                    }}
                                    onMouseLeave={() => setTip(null)}
                                  >
                                    <div className="calBlockLine">
                                      <span className="calBlockSvc">
                                        {String(a.serviceName || "").toUpperCase()}
                                      </span>
                                      <span className="calBlockSep">—</span>
                                      <span className="calBlockClient">{who}</span>
                                      <span className="calBlockSep">—</span>
                                      <span className="calBlockTime">{startLabel}hs</span>
                                    </div>
                                  </button>
                                );
                              })}

                              {items.length === 0 ? (
                                <div className="calLaneEmpty">—</div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={open}
        title="Turno"
        onClose={() => {
          setOpen(false);
          setSelectedAppt(null);
        }}
      >
        {selectedAppt ? (
          <AppointmentModal
            appointment={selectedAppt}
            services={services}
            staffList={staff}
            income={incomeByApptId.get(selectedAppt.id) || null}
            onChanged={() => {
              setOpen(false);
              setSelectedAppt(null);
              setRefresh((x) => x + 1);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={newOpen}
        title="Nuevo turno"
        onClose={() => {
          setNewOpen(false);
          setNewPrefill(null);
        }}
      >
        <NewAppointmentModal
          prefill={newPrefill}
          dateStr={date}
          staffList={staff}
          services={services}
          clients={clients}
          onCreated={() => {
            setNewOpen(false);
            setNewPrefill(null);
            setRefresh((x) => x + 1);
          }}
        />
      </Modal>
    </div>
  );
}

/* ===================== MODAL NUEVO TURNO (manual) ===================== */

function NewAppointmentModal({
  prefill,
  dateStr,
  staffList,
  services,
  clients,
  onCreated,
}) {
  const initialStaffId = prefill?.staffId || "";
  const initialDate = prefill?.dateStr || dateStr || todayLocalISO();
  const initialHM = prefill?.startHM || "";

  const [staffId, setStaffId] = useState(initialStaffId);
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [date, setDate] = useState(initialDate);
  const [timeHM, setTimeHM] = useState(initialHM);

  const [overbook, setOverbook] = useState(prefill?.mode === "button");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [q, setQ] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const timeOptions = useMemo(() => {
    const list = [];
    for (let m = 0; m < 24 * 60; m += APPOINTMENT_STEP_MIN) {
      list.push(minToHM(m));
    }
    return list;
  }, []);

  const suggestions = useMemo(() => {
    const needle = String(q || "").trim().toLowerCase();
    if (!needle) return [];

    return clients
      .filter((c) => {
        const name = String(c.name || "").toLowerCase();
        const ph = String(c.phone || "").toLowerCase();
        const em = String(c.email || "").toLowerCase();
        return name.includes(needle) || ph.includes(needle) || em.includes(needle);
      })
      .slice(0, 6);
  }, [clients, q]);

  function applyClient(c) {
    const { firstName: fn, lastName: ln } = splitName(c.name);
    setFirstName(fn);
    setLastName(ln);
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setShowSuggest(false);
    setQ("");
    toast.success("Cliente cargado desde historial ✅");
  }

  function validate() {
    if (!staffId) return toast.error("Elegí un staff."), false;
    if (!serviceId) return toast.error("Elegí un servicio."), false;
    if (!date) return toast.error("Elegí una fecha."), false;
    if (!timeHM) return toast.error("Elegí un horario."), false;
    if (!isHalfHourHM(timeHM)) {
      toast.error("El horario debe ser en punto o y media.");
      return false;
    }
    if (!String(firstName || "").trim()) return toast.error("Poné el nombre."), false;
    if (!String(lastName || "").trim()) return toast.error("Poné el apellido."), false;
    if (!String(phone || "").trim()) return toast.error("Poné el WhatsApp/teléfono."), false;
    return true;
  }

  async function submitCreate(sendEmailNotification) {
    if (creating) return;

    const service = services.find((s) => s.id === serviceId);
    const st = staffList.find((s) => s.id === staffId);

    const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
    const startAtISO = combineDateAndTime(date, timeHM).toISOString();
    const trimmedEmail = String(email || "").trim();

    try {
      setCreating(true);

      await api.post("/appointments", {
        serviceId,
        staffId,
        startAt: startAtISO,
        notes: String(notes || "").trim(),
        allowOverlap: Boolean(overbook),
        channel: "manual",
        sendEmailNotification: Boolean(sendEmailNotification),
        client: {
          name: fullName,
          phone: String(phone).trim(),
          email: trimmedEmail,
        },
        clientName: fullName,
        clientPhone: String(phone).trim(),
        clientEmail: trimmedEmail,
        serviceName: service?.name,
        staffName: st?.name,
      });

      setEmailModalOpen(false);
      toast.success("Turno creado ✅");
      onCreated();
    } catch (err) {
      toast.error(
        err?.response?.data?.error?.message || "No se pudo crear el turno."
      );
    } finally {
      setCreating(false);
    }
  }

  async function create() {
    if (!validate()) return;

    const trimmedEmail = String(email || "").trim();

    if (trimmedEmail) {
      setEmailModalOpen(true);
      return;
    }

    await submitCreate(false);
  }

  return (
    <>
      <div className="newAppt">
        <div className="newApptGrid">
          <label className="selectField">
            <div className="label">Staff</div>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Elegí…</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="selectField">
            <div className="label">Servicio</div>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {services.map((s) => (
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
            onChange={(e) => setDate(e.target.value)}
          />

          <label className="selectField">
            <div className="label">Hora</div>
            <select value={timeHM} onChange={(e) => setTimeHM(e.target.value)}>
              <option value="">Elegí…</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div className="newApptWide">
            <div className="newApptSuggestLabel">
              Buscar cliente existente (opcional)
            </div>

            <div className="newApptSuggestWrap">
              <input
                className="newApptSuggestInput"
                value={q}
                placeholder="Escribí nombre, teléfono o email…"
                onChange={(e) => {
                  setQ(e.target.value);
                  setShowSuggest(true);
                }}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
              />

              {showSuggest && suggestions.length > 0 ? (
                <div className="newApptSuggestList">
                  {suggestions.map((c) => (
                    <button
                      type="button"
                      className="newApptSuggestItem"
                      key={c.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyClient(c);
                      }}
                    >
                      <div className="sugName">{c.name}</div>
                      <div className="sugMeta">
                        {c.phone || "—"} · {c.email || "—"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

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

          <label className="selectField newApptWide">
            <div className="label">Observaciones (opcional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: llega 10 min tarde..."
            />
          </label>

          <label className="newApptOver">
            <input
              type="checkbox"
              checked={overbook}
              onChange={(e) => setOverbook(e.target.checked)}
            />
            <span>Sobreturno (permitir aunque esté ocupado)</span>
          </label>
        </div>

        <div className="apptActions" style={{ marginTop: 12 }}>
          <Button type="button" onClick={create} disabled={creating}>
            {creating ? "Creando..." : "Crear turno"}
          </Button>
        </div>
      </div>

      <Modal
        open={emailModalOpen}
        title="Enviar notificación por email"
        onClose={() => {
          if (!creating) setEmailModalOpen(false);
        }}
      >
        <div className="apptPay">
          <div className="muted">
            Este cliente tiene email cargado.
            <br />
            ¿Querés enviarle la notificación de confirmación del turno?
          </div>

          <div className="apptActions" style={{ marginTop: 12 }}>
            <Button
              type="button"
              onClick={() => submitCreate(false)}
              disabled={creating}
            >
              {creating ? "Creando..." : "No enviar"}
            </Button>

            <Button
              type="button"
              onClick={() => submitCreate(true)}
              disabled={creating}
            >
              {creating ? "Creando..." : "Sí, enviar email"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ===================== MODAL DE TURNO EXISTENTE ===================== */

function AppointmentModal({
  appointment,
  services,
  staffList,
  income,
  onChanged,
}) {
  const service = services.find((s) => s.id === appointment.serviceId);
  const duration = service?.durationMin ?? 30;

  const [mode, setMode] = useState("view");
  const [newDate, setNewDate] = useState(
    String(appointment.startAt || "").slice(0, 10)
  );
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [newStaffId, setNewStaffId] = useState(appointment.staffId);

  const [method, setMethod] = useState(income?.paymentMethod ?? "cash");
  const [amount, setAmount] = useState(
    income?.amountFinal ?? income?.amountEstimated ?? appointment.price ?? 0
  );

  const [slotsState, setSlotsState] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadSlots() {
      if (mode !== "reschedule") return;
      if (!newDate || !newStaffId) return;

      setSlotsLoading(true);
      try {
        const { data } = await api.get("/appointments/available", {
          params: {
            dateStr: newDate,
            staffId: newStaffId,
            serviceId: appointment.serviceId,
          },
        });

        const list = normalizeList(data, "slots").filter((sl) =>
          isHalfHourISO(sl?.startAt)
        );
        if (!alive) return;
        setSlotsState(list);
      } catch (err) {
        if (!alive) return;
        toast.error(
          err?.response?.data?.error?.message ||
            "No se pudieron cargar horarios disponibles."
        );
        setSlotsState([]);
      } finally {
        if (alive) setSlotsLoading(false);
      }
    }

    loadSlots();
    return () => {
      alive = false;
    };
  }, [mode, newDate, newStaffId, appointment.serviceId]);

  const isCancelled = appointment.status === "cancelled";
  const isNoShow = appointment.status === "no-show";
  const isCompleted = appointment.status === "completed";

  const isPaid = income?.paidStatus === "paid";
  const isUnpaid = income?.paidStatus === "unpaid";
  const isPast = isPastAppointment(appointment);

  const canCancel = !isCancelled && !isPaid && !isPast && !isCompleted;
  const canReschedule = !isCancelled && !isPaid && !isPast && !isCompleted;
  const canMarkCompleted = !isCancelled && !isCompleted;
  const canNoShow = !isCancelled && !isCompleted;
  const canPay = !isCancelled && !isNoShow && !isPaid && !isUnpaid && !paying;
  const canSetUnpaid =
    Boolean(income) &&
    income?.paidStatus === "pending" &&
    !isCancelled &&
    !isNoShow &&
    !paying;
  const canBackToPending =
    Boolean(income) && income?.paidStatus === "unpaid" && !isCancelled && !paying;

  async function updateStatus(status) {
    if (paying) return;

    try {
      await api.patch(`/appointments/${appointment.id}/status`, { status });
      toast.success("Estado actualizado.");
      onChanged();
    } catch (err) {
      toast.error(
        err?.response?.data?.error?.message ||
          "No se pudo actualizar el estado."
      );
    }
  }

  async function cancel() {
    if (paying) return;

    try {
      await api.post(`/appointments/${appointment.id}/cancel`);
      toast.success("Turno cancelado.");
      onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "No se pudo cancelar.");
    }
  }

  async function reschedule() {
    if (paying) return;

    if (!selectedSlot?.startAt) {
      toast.error("Elegí un horario.");
      return;
    }

    if (!isHalfHourISO(selectedSlot.startAt)) {
      toast.error("Solo se permiten horarios en punto o y media.");
      return;
    }

    try {
      await api.post(`/appointments/${appointment.id}/reschedule`, {
        newStartAtISO: selectedSlot.startAt,
        newStaffId,
      });

      await api
        .patch(`/appointments/${appointment.id}/status`, {
          status: "rescheduled",
        })
        .catch(() => {});

      toast.success("Turno reprogramado.");
      onChanged();
    } catch (err) {
      toast.error(
        err?.response?.data?.error?.message || "No se pudo reprogramar."
      );
    }
  }

  async function markIncomePaid() {
    if (paying) return;

    if (!income?.id) {
      toast.error("No se encontró el ingreso para este turno.");
      return;
    }

    try {
      setPaying(true);

      await api.post("/incomes/mark-paid", {
        incomeId: income.id,
        paymentMethod: method,
        amountFinal: Number(amount),
      });

      await api
        .patch(`/appointments/${appointment.id}/status`, {
          status: "completed",
        })
        .catch(() => {});

      toast.success("Cobro registrado.");
      onChanged();
    } catch (err) {
      toast.error(
        err?.response?.data?.error?.message ||
          "No se pudo registrar el pago."
      );
    } finally {
      setPaying(false);
    }
  }

  async function setIncomeStatus(paidStatus) {
    if (paying) return;

    if (!income?.id) {
      toast.error("No se encontró el ingreso para este turno.");
      return;
    }

    try {
      await api.patch(`/incomes/${income.id}/status`, { paidStatus });
      toast.success("Estado de cobro actualizado.");
      onChanged();
    } catch (err) {
      toast.error(
        err?.response?.data?.error?.message ||
          "No se pudo actualizar el estado de cobro."
      );
    }
  }

  return (
    <div className={`apptModal ${paying ? "apptModalLoading" : ""}`}>
      {paying ? (
        <div className="apptLoadingOverlay">
          <div className="apptLoadingBox">
            <div className="apptLoadingSpinner" />
            <div className="apptLoadingText">Procesando cobro...</div>
          </div>
        </div>
      ) : null}

      <div className="apptLine">
        <strong>Cliente:</strong> {appointment.clientName || "—"} ·{" "}
        {appointment.clientPhone || "—"}
      </div>

      <div className="apptLine">
        <strong>Servicio:</strong> {appointment.serviceName || "—"} ({duration} min)
      </div>

      <div className="apptLine">
        <strong>Staff:</strong> {appointment.staffName || "—"}
      </div>

      <div className="apptLine">
        <strong>Horario:</strong> {formatDateDMY(appointment.startAt)}{" "}
        {timeHHMMLocal(appointment.startAt)}–{timeHHMMLocal(appointment.endAt)}
      </div>

      <div className="apptLine">
        <strong>Estado:</strong> {labelApptStatus(appointment.status)}
        {isPast ? <span className="apptFlag"> · Finalizado</span> : null}
      </div>

      {income ? (
        <div className="apptLine">
          <strong>Cobro:</strong> {labelIncomeStatus(income.paidStatus)}
        </div>
      ) : null}

      <hr className="hr" />

      {mode === "view" ? (
        <div className="apptActions">
          <Button
            variant="danger"
            type="button"
            onClick={() => {
              if (paying) return;

              if (!canCancel) {
                toast.error(
                  "No podés cancelar este turno (ya pasó / está pagado / completado)."
                );
                return;
              }
              setMode("cancelConfirm");
            }}
            disabled={!canCancel}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={() => {
              if (paying) return;

              if (!canReschedule) {
                toast.error(
                  "No podés reprogramar este turno (ya pasó / está pagado / completado)."
                );
                return;
              }
              setMode("reschedule");
            }}
            disabled={!canReschedule}
          >
            Reprogramar
          </Button>

          <Button
            type="button"
            onClick={() => canMarkCompleted && updateStatus("completed")}
            disabled={!canMarkCompleted || paying}
          >
            Marcar realizado
          </Button>

          <Button
            type="button"
            onClick={() => canNoShow && updateStatus("no-show")}
            disabled={!canNoShow || paying}
          >
            No vino
          </Button>

          {canSetUnpaid ? (
            <Button
              variant="danger"
              type="button"
              onClick={() => setMode("unpaidConfirm")}
              disabled={paying}
            >
              No cobrado
            </Button>
          ) : null}

          {canBackToPending ? (
            <Button
              type="button"
              onClick={() => setIncomeStatus("pending")}
              disabled={paying}
            >
              Volver a “Pendiente”
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={() => setMode("pay")}
            disabled={!canPay}
          >
            Cobrar
          </Button>
        </div>
      ) : null}

      {mode === "cancelConfirm" ? (
        <div className="apptPay">
          <div className="muted">
            Vas a <b>cancelar</b> este turno.
            <br />
            Si el turno todavía no está cobrado, se anula el ingreso.
          </div>

          <div className="apptActions" style={{ marginTop: 12 }}>
            <Button type="button" onClick={() => setMode("view")} disabled={paying}>
              Volver
            </Button>

            <Button
              variant="danger"
              type="button"
              onClick={cancel}
              disabled={paying}
            >
              Confirmar cancelación
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "unpaidConfirm" ? (
        <div className="apptPay">
          <div className="muted">
            Vas a marcar este turno como <b>“No cobrado”</b>.
            <br />
            Queda como caso especial. Para cobrarlo después, volvelo a{" "}
            <b>“Pendiente”</b>.
          </div>

          <div className="apptActions" style={{ marginTop: 12 }}>
            <Button type="button" onClick={() => setMode("view")} disabled={paying}>
              Volver
            </Button>

            <Button
              variant="danger"
              type="button"
              onClick={() => setIncomeStatus("unpaid")}
              disabled={paying}
            >
              Confirmar “No cobrado”
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "reschedule" ? (
        <div className="apptReschedule">
          <div className="muted">
            Elegí staff, fecha y un nuevo horario disponible.
          </div>

          <label className="calCtrl" style={{ marginTop: 10 }}>
            <span>Nuevo staff</span>
            <select
              value={newStaffId}
              onChange={(e) => {
                setNewStaffId(e.target.value);
                setSelectedSlot(null);
              }}
              disabled={paying}
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="calCtrl" style={{ marginTop: 10 }}>
            <span>Nueva fecha</span>
            <input
              type="date"
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setSelectedSlot(null);
              }}
              disabled={paying}
            />
          </label>

          <div className="slotGrid" style={{ marginTop: 10 }}>
            {slotsLoading ? (
              <div className="slotEmpty">Cargando horarios…</div>
            ) : slotsState.length === 0 ? (
              <div className="slotEmpty">No hay horarios disponibles ese día.</div>
            ) : (
              slotsState.map((sl) => (
                <button
                  key={sl.startAt}
                  type="button"
                  className={`slotBtn ${
                    selectedSlot?.startAt === sl.startAt ? "active" : ""
                  }`}
                  onClick={() => setSelectedSlot(sl)}
                  disabled={paying}
                >
                  {sl.label || timeHHMMLocal(sl.startAt)}
                </button>
              ))
            )}
          </div>

          <div className="apptActions" style={{ marginTop: 12 }}>
            <Button type="button" onClick={() => setMode("view")} disabled={paying}>
              Volver
            </Button>

            <Button type="button" onClick={reschedule} disabled={paying}>
              Confirmar reprogramación
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "pay" ? (
        <div className="apptPay">
          <div className="muted">Registrar cobro (impacta en Caja).</div>

          <div className="payGrid">
            <label className="selectField">
              <div className="label">Método</div>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={paying}
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                disabled={paying}
              />
            </label>
          </div>

          <div className="apptActions" style={{ marginTop: 12 }}>
            <Button type="button" onClick={() => setMode("view")} disabled={paying}>
              Volver
            </Button>

            <Button type="button" onClick={markIncomePaid} disabled={!canPay}>
              {paying ? "Procesando..." : "Confirmar cobro"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="apptHint">
        <div className="muted">
          * Por seguridad: si el turno ya finalizó o está pagado, no se permite
          cancelar ni reprogramar.
        </div>
      </div>
    </div>
  );
}