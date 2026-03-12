import "./Settings.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../components/common/Button.jsx";
import Input from "../../components/common/Input.jsx";
import Modal from "../../components/common/Modal.jsx";
import { useToast } from "../../components/common/Toast";

import RecurringBlocksTab from "../../pages/admin/RecurringBlocksTab.jsx";
import WeeklyTemplateTab from "../../pages/admin/WeeklyTemplateTab.jsx";

import { fileToDataUrl } from "../../utils/image";
import api from "../../services/http";

const MAX_SERVICES = 10;
const MAX_STAFF = 10;
const NEXO_URL = "https://nexo-digital.tech/";
const MAX_IMG_BYTES = 2_000_000; // 2MB

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeTrim(v) {
  return String(v ?? "").trim();
}

function normalizeCommaList(v) {
  return safeTrim(v)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeDisplayOrder(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function nextDisplayOrder(list) {
  if (!Array.isArray(list) || list.length === 0) return 1;
  return (
    Math.max(
      ...list.map((item, index) => normalizeDisplayOrder(item?.displayOrder, index + 1))
    ) + 1
  );
}

function moneyARS(n) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

export default function Settings() {
  const { show } = useToast();

  const [tab, setTab] = useState("services");

  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [specialDays, setSpecialDays] = useState([]);

  const [refresh, setRefresh] = useState(0);
  const onChanged = useCallback(() => setRefresh((x) => x + 1), []);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCfg, setConfirmCfg] = useState({
    title: "Confirmar",
    message: "",
    confirmText: "Confirmar",
    tone: "danger",
    onConfirm: null,
  });

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoCfg, setInfoCfg] = useState({ title: "Aviso", message: "" });

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

  function openInfo({ title, message }) {
    setInfoCfg({ title: title || "Aviso", message: message || "" });
    setInfoOpen(true);
  }

  function openLimitInfo(kind) {
    const msg =
      kind === "services"
        ? `Llegaste al máximo de ${MAX_SERVICES} servicios.\n\nPara agregar más, editá uno existente o contactate con NexoDigital.`
        : `Llegaste al máximo de ${MAX_STAFF} miembros de staff.\n\nPara agregar más, editá uno existente o contactate con NexoDigital.`;

    openInfo({
      title: "Límite alcanzado",
      message: msg,
    });
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [sv, st, bl, sd] = await Promise.all([
          api.get("/services"),
          api.get("/staff"),
          api.get("/blocks"),
          api.get("/special-days"),
        ]);

        if (!alive) return;

        setServices(Array.isArray(sv?.data?.services) ? sv.data.services : []);
        setStaff(Array.isArray(st?.data?.staff) ? st.data.staff : []);
        setBlocks(Array.isArray(bl?.data?.blocks) ? bl.data.blocks : []);
        setSpecialDays(
          Array.isArray(sd?.data?.specialDays) ? sd.data.specialDays : []
        );
      } catch (e) {
        if (!alive) return;
        show?.({
          type: "error",
          title: "Error",
          message:
            e?.response?.data?.error?.message ||
            "No se pudo cargar la data de ajustes.",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [refresh, show]);

  const sortedBlocks = useMemo(() => {
    return (blocks || [])
      .slice()
      .sort((a, b) => (b.dateStr + b.start).localeCompare(a.dateStr + a.start));
  }, [blocks]);

  const sortedSpecialDays = useMemo(() => {
    return (specialDays || [])
      .slice()
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [specialDays]);

  async function apiCreateService(payload) {
    const { data } = await api.post("/services", {
      code: payload.code || null,
      name: payload.name,
      durationMin: Number(payload.durationMin || 30),
      price: Number(payload.price || 0),
      imageUrl: payload.imageUrl || "",
      displayOrder: Number(payload.displayOrder || 0),
      allowedStaffIds: Array.isArray(payload.allowedStaffIds)
        ? payload.allowedStaffIds
        : [],
    });
    return data;
  }

  async function apiUpdateService(id, payload) {
    await api.patch(`/services/${id}`, {
      code: payload.code ?? null,
      name: payload.name,
      durationMin: Number(payload.durationMin),
      price: Number(payload.price),
      imageUrl: payload.imageUrl ?? "",
      displayOrder: Number(payload.displayOrder || 0),
      allowedStaffIds: Array.isArray(payload.allowedStaffIds)
        ? payload.allowedStaffIds
        : [],
    });
  }

  async function apiDeleteService(id) {
    await api.delete(`/services/${id}`);
  }

  async function apiCreateStaff(payload) {
    const { data } = await api.post("/staff", {
      name: payload.name,
      firstName: payload.firstName || null,
      lastName: payload.lastName || null,
      age:
        payload.age !== "" && payload.age !== null && payload.age !== undefined
          ? Number(payload.age)
          : null,
      birthday: payload.birthday || null,
      phone: payload.phone || null,
      dni: payload.dni || null,
      address: payload.address || null,
      bio: payload.bio || "",
      photoUrl: payload.photoUrl || "",
      displayOrder: Number(payload.displayOrder || 0),
      skills: Array.isArray(payload.skills) ? payload.skills : [],
      scheduleOverride: payload.scheduleOverride ?? null,
    });
    return data;
  }

  async function apiUpdateStaff(id, payload) {
    await api.patch(`/staff/${id}`, {
      name: payload.name,
      firstName: payload.firstName || null,
      lastName: payload.lastName || null,
      age:
        payload.age !== "" && payload.age !== null && payload.age !== undefined
          ? Number(payload.age)
          : null,
      birthday: payload.birthday || null,
      phone: payload.phone || null,
      dni: payload.dni || null,
      address: payload.address || null,
      bio: payload.bio || "",
      photoUrl: payload.photoUrl || "",
      displayOrder: Number(payload.displayOrder || 0),
      skills: Array.isArray(payload.skills) ? payload.skills : [],
      scheduleOverride: payload.scheduleOverride ?? null,
    });
  }

  async function apiDeleteStaff(id) {
    await api.delete(`/staff/${id}`);
  }

  async function apiCreateBlock(payload) {
    const { data } = await api.post("/blocks", {
      dateStr: payload.dateStr,
      staffId: payload.staffId || null,
      start: payload.start,
      end: payload.end,
      reason: payload.reason || "",
    });
    return data;
  }

  async function apiDeleteBlock(id) {
    await api.delete(`/blocks/${id}`);
  }

  async function apiBlockFullDay({ dateStr, staffId, reason }) {
    await apiCreateBlock({
      dateStr,
      staffId: staffId || null,
      start: "00:00",
      end: "23:59",
      reason: reason || "Cerrado (día completo)",
    });
  }

  async function apiUpsertSpecialDay(payload) {
    const { data } = await api.post("/special-days", {
      dateStr: payload.dateStr,
      open: Boolean(payload.open),
      intervals: Array.isArray(payload.intervals) ? payload.intervals : [],
    });
    return data;
  }

  async function apiDeleteSpecialDay(dateStr) {
    await api.delete(`/special-days/${dateStr}`);
  }

  return (
    <div className="settings">
      <h1>Ajustes</h1>
      <p className="muted">
        Configuración de servicios, staff, bloqueos y calendario
        (feriados/excepciones).
      </p>

      <div className="tabs">
        <button
          className={`tabBtn ${tab === "services" ? "active" : ""}`}
          onClick={() => setTab("services")}
        >
          Servicios
        </button>

        <button
          className={`tabBtn ${tab === "staff" ? "active" : ""}`}
          onClick={() => setTab("staff")}
        >
          Staff
        </button>

        <button
          className={`tabBtn ${tab === "blocks" ? "active" : ""}`}
          onClick={() => setTab("blocks")}
        >
          Bloqueos
        </button>

        <button
          className={`tabBtn ${tab === "recurringBlocks" ? "active" : ""}`}
          onClick={() => setTab("recurringBlocks")}
        >
          Bloqueos recurrentes
        </button>

        <button
          className={`tabBtn ${tab === "weeklyTemplate" ? "active" : ""}`}
          onClick={() => setTab("weeklyTemplate")}
        >
          Plantilla semanal
        </button>

        <button
          className={`tabBtn ${tab === "calendar" ? "active" : ""}`}
          onClick={() => setTab("calendar")}
        >
          Calendario
        </button>

        <button
          className={`tabBtn ${tab === "user" ? "active" : ""}`}
          onClick={() => setTab("user")}
        >
          Usuario
        </button>
      </div>

      {tab === "services" ? (
        <ServicesTab
          services={services}
          staff={staff}
          onRefresh={onChanged}
          onToast={show}
          onConfirm={openConfirm}
          onLimit={() => openLimitInfo("services")}
          apiCreateService={apiCreateService}
          apiUpdateService={apiUpdateService}
          apiDeleteService={apiDeleteService}
        />
      ) : null}

      {tab === "staff" ? (
        <StaffTab
          staff={staff}
          onRefresh={onChanged}
          onToast={show}
          onConfirm={openConfirm}
          onLimit={() => openLimitInfo("staff")}
          apiCreateStaff={apiCreateStaff}
          apiUpdateStaff={apiUpdateStaff}
          apiDeleteStaff={apiDeleteStaff}
        />
      ) : null}

      {tab === "blocks" ? (
        <BlocksTab
          staff={staff}
          blocks={sortedBlocks}
          onRefresh={onChanged}
          onToast={show}
          onConfirm={openConfirm}
          apiCreateBlock={apiCreateBlock}
          apiDeleteBlock={apiDeleteBlock}
          apiBlockFullDay={apiBlockFullDay}
        />
      ) : null}

      {tab === "recurringBlocks" ? (
        <RecurringBlocksTab onChanged={onChanged} />
      ) : null}

      {tab === "weeklyTemplate" ? (
        <WeeklyTemplateTab onChanged={onChanged} />
      ) : null}

      {tab === "calendar" ? (
        <CalendarTab
          specialDays={sortedSpecialDays}
          onRefresh={onChanged}
          onToast={show}
          onConfirm={openConfirm}
          apiUpsertSpecialDay={apiUpsertSpecialDay}
          apiDeleteSpecialDay={apiDeleteSpecialDay}
        />
      ) : null}

      {tab === "user" ? <UserTab onToast={show} onConfirm={openConfirm} /> : null}

      <Modal
        open={confirmOpen}
        title={confirmCfg.title}
        onClose={() => setConfirmOpen(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div
            className="muted"
            style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}
          >
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
              className="setBtn ghost"
              type="button"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </button>

            <button
              className={`setBtn ${
                confirmCfg.tone === "danger" ? "danger" : "primary"
              }`}
              type="button"
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

      <Modal open={infoOpen} title={infoCfg.title} onClose={() => setInfoOpen(false)}>
        <div style={{ display: "grid", gap: 12 }}>
          <div
            className="muted"
            style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}
          >
            {infoCfg.message}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <a
              className="setBtn ghost"
              href={NEXO_URL}
              target="_blank"
              rel="noreferrer"
            >
              Contactar NexoDigital
            </a>

            <button
              className="setBtn primary"
              type="button"
              onClick={() => setInfoOpen(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ===================== SERVICES ===================== */

function ServicesTab({
  services,
  staff,
  onRefresh,
  onToast,
  onConfirm,
  onLimit,
  apiCreateService,
  apiUpdateService,
  apiDeleteService,
}) {
  const [open, setOpen] = useState(false);

  const canAdd = services.length < MAX_SERVICES;

  return (
    <div className="panel card">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Servicios</div>
          <div className="muted small">
            Máximo {MAX_SERVICES}. Estos servicios se muestran en la web (sección
            Servicios).
          </div>
        </div>

        <Button
          onClick={() => {
            if (!canAdd) return onLimit?.();
            setOpen(true);
          }}
          type="button"
        >
          Agregar
        </Button>
      </div>

      <div className="list">
        {services.length === 0 ? <div className="muted">No hay servicios.</div> : null}

        {services.map((s, index) => (
          <ServiceRow
            key={s.id}
            service={s}
            staff={staff}
            rowIndex={index}
            onRefresh={onRefresh}
            onToast={onToast}
            onConfirm={onConfirm}
            apiUpdateService={apiUpdateService}
            apiDeleteService={apiDeleteService}
          />
        ))}
      </div>

      <Modal open={open} title="Nuevo servicio" onClose={() => setOpen(false)}>
        <ServiceForm
          staff={staff}
          onToast={onToast}
          initial={{
            displayOrder: nextDisplayOrder(services),
          }}
          onSubmit={async (payload) => {
            if (services.length >= MAX_SERVICES) {
              setOpen(false);
              return onLimit?.();
            }

            try {
              await apiCreateService(payload);
              onToast?.({
                type: "success",
                title: "Guardado",
                message: "Servicio creado correctamente.",
              });
              onRefresh();
              setOpen(false);
            } catch (e) {
              onToast?.({
                type: "error",
                title: "Error",
                message:
                  e?.response?.data?.error?.message ||
                  "No se pudo crear el servicio.",
              });
            }
          }}
        />
      </Modal>
    </div>
  );
}

function ServiceRow({
  service,
  staff,
  rowIndex,
  onRefresh,
  onToast,
  onConfirm,
  apiUpdateService,
  apiDeleteService,
}) {
  const [openEdit, setOpenEdit] = useState(false);

  const currentOrder = normalizeDisplayOrder(service.displayOrder, rowIndex + 1);

  return (
    <div className="row card rowInner">
      <div className="rowMain">
        <div className="rowTitle">{service.name}</div>

        <div className="muted">
          {service.durationMin} min · {moneyARS(service.price)}
        </div>

        <div className="muted small">Orden visual: {currentOrder}</div>

        <div className="muted small">
          Staff habilitado:{" "}
          {service.allowedStaffIds?.length
            ? service.allowedStaffIds
                .map((id) => staff.find((x) => x.id === id)?.name)
                .filter(Boolean)
                .join(", ")
            : "Todos"}
        </div>

        <div className="muted small">
          Imagen: {service.imageUrl ? "Cargada ✅" : "—"}
        </div>
      </div>

      <div className="rowActions">
        <Button type="button" onClick={() => setOpenEdit(true)}>
          Editar
        </Button>

        <Button
          variant="danger"
          type="button"
          onClick={() => {
            onConfirm?.({
              title: "Eliminar servicio",
              message:
                "¿Seguro que querés eliminar este servicio? Esta acción no se puede deshacer.",
              confirmText: "Sí, eliminar",
              tone: "danger",
              onConfirm: async () => {
                try {
                  await apiDeleteService(service.id);
                  onToast?.({
                    type: "success",
                    title: "Eliminado",
                    message: "Servicio eliminado.",
                  });
                  onRefresh();
                } catch (e) {
                  onToast?.({
                    type: "error",
                    title: "Error",
                    message:
                      e?.response?.data?.error?.message ||
                      "No se pudo eliminar el servicio.",
                  });
                }
              },
            });
          }}
        >
          Eliminar
        </Button>
      </div>

      <Modal
        open={openEdit}
        title="Editar servicio"
        onClose={() => setOpenEdit(false)}
      >
        <ServiceForm
          staff={staff}
          onToast={onToast}
          initial={{
            code: service.code ?? "",
            name: service.name ?? "",
            durationMin: service.durationMin ?? 30,
            price: service.price ?? 0,
            displayOrder: currentOrder,
            allowedStaffIds: service.allowedStaffIds ?? [],
            imageUrl: service.imageUrl ?? "",
          }}
          onSubmit={async (payload) => {
            try {
              await apiUpdateService(service.id, payload);
              onToast?.({
                type: "success",
                title: "Actualizado",
                message: "Servicio actualizado.",
              });
              onRefresh();
              setOpenEdit(false);
            } catch (e) {
              onToast?.({
                type: "error",
                title: "Error",
                message:
                  e?.response?.data?.error?.message ||
                  "No se pudo actualizar el servicio.",
              });
            }
          }}
        />
      </Modal>
    </div>
  );
}

function ServiceForm({ staff, onSubmit, initial, onToast }) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? 30);
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [displayOrder, setDisplayOrder] = useState(initial?.displayOrder ?? 1);

  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [allowedStaffIds, setAllowedStaffIds] = useState(
    initial?.allowedStaffIds ?? []
  );

  function toggleStaff(id) {
    setAllowedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onPickImage(file) {
    if (!file) return;

    if (file.size > MAX_IMG_BYTES) {
      onToast?.({
        type: "error",
        title: "Imagen pesada",
        message:
          "La imagen supera 2MB. Elegí una más liviana (o después comprimimos automático).",
      });
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setImageUrl(dataUrl);
      onToast?.({ type: "success", title: "Listo", message: "Imagen cargada." });
    } catch {
      onToast?.({
        type: "error",
        title: "Error",
        message: "No se pudo leer la imagen.",
      });
    }
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();

        const nm = safeTrim(name);
        if (!nm) {
          onToast?.({
            type: "error",
            title: "Falta dato",
            message: "Poné el nombre del servicio.",
          });
          return;
        }

        onSubmit({
          code: safeTrim(code),
          name: nm,
          durationMin,
          price,
          displayOrder: normalizeDisplayOrder(displayOrder, 1),
          allowedStaffIds,
          imageUrl: safeTrim(imageUrl),
        });
      }}
    >
      <Input
        label="Código (opcional, ej: corte)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        label="Duración (min)"
        type="number"
        value={durationMin}
        onChange={(e) => setDurationMin(e.target.value)}
      />
      <Input
        label="Precio"
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <Input
        label="Orden visual"
        type="number"
        min="0"
        value={displayOrder}
        onChange={(e) => setDisplayOrder(e.target.value)}
      />

      <div className="selectField">
        <div className="label">Imagen del servicio</div>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            await onPickImage(file);
            e.target.value = "";
          }}
        />

        {imageUrl ? (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <div className="muted small">Vista previa</div>
            <img
              src={imageUrl}
              alt="preview servicio"
              style={{
                width: "100%",
                maxWidth: 520,
                height: 190,
                objectFit: "cover",
                borderRadius: 14,
                border: "1px solid var(--border)",
              }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="setBtn ghost"
                onClick={() => setImageUrl("")}
              >
                Quitar imagen
              </button>
            </div>
          </div>
        ) : (
          <div className="muted small">
            Subí una foto desde el celu o elegí un archivo.
          </div>
        )}
      </div>

      <div className="miniTitle">¿Qué staff puede hacerlo?</div>
      <div className="chips">
        {staff.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip ${allowedStaffIds.includes(s.id) ? "active" : ""}`}
            onClick={() => toggleStaff(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="muted small">
        Si no seleccionás ninguno, interpretamos “todos”.
      </div>

      <div className="formActions">
        <Button type="submit">Guardar</Button>
      </div>
    </form>
  );
}

/* ===================== STAFF ===================== */

function StaffTab({
  staff,
  onRefresh,
  onToast,
  onConfirm,
  onLimit,
  apiCreateStaff,
  apiUpdateStaff,
  apiDeleteStaff,
}) {
  const [open, setOpen] = useState(false);
  const canAdd = staff.length < MAX_STAFF;

  return (
    <div className="panel card">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Staff</div>
          <div className="muted small">
            Máximo {MAX_STAFF}. En la web se muestra foto, nombre, skills y bio.
          </div>
        </div>

        <Button
          onClick={() => {
            if (!canAdd) return onLimit?.();
            setOpen(true);
          }}
          type="button"
        >
          Agregar
        </Button>
      </div>

      <div className="list">
        {staff.length === 0 ? <div className="muted">No hay staff.</div> : null}

        {staff.map((s, index) => (
          <StaffRow
            key={s.id}
            staffMember={s}
            rowIndex={index}
            onRefresh={onRefresh}
            onToast={onToast}
            onConfirm={onConfirm}
            apiUpdateStaff={apiUpdateStaff}
            apiDeleteStaff={apiDeleteStaff}
          />
        ))}
      </div>

      <Modal open={open} title="Nuevo staff" onClose={() => setOpen(false)}>
        <StaffForm
          onToast={onToast}
          initial={{
            displayOrder: nextDisplayOrder(staff),
          }}
          onSubmit={async (payload) => {
            if (staff.length >= MAX_STAFF) {
              setOpen(false);
              return onLimit?.();
            }

            try {
              await apiCreateStaff(payload);
              onToast?.({
                type: "success",
                title: "Guardado",
                message: "Staff creado correctamente.",
              });
              onRefresh();
              setOpen(false);
            } catch (e) {
              onToast?.({
                type: "error",
                title: "Error",
                message:
                  e?.response?.data?.error?.message || "No se pudo crear el staff.",
              });
            }
          }}
        />
      </Modal>
    </div>
  );
}

function StaffRow({
  staffMember,
  rowIndex,
  onRefresh,
  onToast,
  onConfirm,
  apiUpdateStaff,
  apiDeleteStaff,
}) {
  const [openEdit, setOpenEdit] = useState(false);

  const displayName =
    safeTrim(staffMember.firstName) || safeTrim(staffMember.lastName)
      ? `${safeTrim(staffMember.firstName)} ${safeTrim(
          staffMember.lastName
        )}`.trim()
      : staffMember.name;

  const currentOrder = normalizeDisplayOrder(
    staffMember.displayOrder,
    rowIndex + 1
  );

  return (
    <div className="row card rowInner">
      <div className="rowMain">
        <div className="rowTitle">{displayName || staffMember.name}</div>

        <div className="muted small">Orden visual: {currentOrder}</div>
        <div className="muted small">
          Skills: {(staffMember.skills || []).join(", ") || "-"}
        </div>
        <div className="muted small">
          Horario: {staffMember.scheduleOverride ? "Propio" : "Global"}
        </div>
        <div className="muted small">
          Foto: {staffMember.photoUrl ? "Cargada ✅" : "—"}
        </div>
      </div>

      <div className="rowActions">
        <Button type="button" onClick={() => setOpenEdit(true)}>
          Editar
        </Button>

        <Button
          variant="danger"
          type="button"
          onClick={() => {
            onConfirm?.({
              title: "Eliminar staff",
              message:
                "¿Seguro que querés eliminar este miembro del staff? Esta acción no se puede deshacer.",
              confirmText: "Sí, eliminar",
              tone: "danger",
              onConfirm: async () => {
                try {
                  await apiDeleteStaff(staffMember.id);
                  onToast?.({
                    type: "success",
                    title: "Eliminado",
                    message: "Staff eliminado.",
                  });
                  onRefresh();
                } catch (e) {
                  onToast?.({
                    type: "error",
                    title: "Error",
                    message:
                      e?.response?.data?.error?.message ||
                      "No se pudo eliminar el staff.",
                  });
                }
              },
            });
          }}
        >
          Eliminar
        </Button>
      </div>

      <Modal open={openEdit} title="Editar staff" onClose={() => setOpenEdit(false)}>
        <StaffForm
          onToast={onToast}
          initial={{
            firstName: staffMember.firstName ?? "",
            lastName: staffMember.lastName ?? "",
            name: staffMember.name ?? "",
            age: staffMember.age ?? "",
            birthday: staffMember.birthday ?? "",
            phone: staffMember.phone ?? "",
            dni: staffMember.dni ?? "",
            address: staffMember.address ?? "",
            bio: staffMember.bio ?? "",
            photoUrl: staffMember.photoUrl ?? "",
            displayOrder: currentOrder,
            skillsText: (staffMember.skills || []).join(", "),
            scheduleOverride: staffMember.scheduleOverride ?? null,
          }}
          onSubmit={async (payload) => {
            try {
              await apiUpdateStaff(staffMember.id, payload);
              onToast?.({
                type: "success",
                title: "Actualizado",
                message: "Staff actualizado.",
              });
              onRefresh();
              setOpenEdit(false);
            } catch (e) {
              onToast?.({
                type: "error",
                title: "Error",
                message:
                  e?.response?.data?.error?.message ||
                  "No se pudo actualizar el staff.",
              });
            }
          }}
        />
      </Modal>
    </div>
  );
}

function StaffForm({ onSubmit, initial, onToast }) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [age, setAge] = useState(initial?.age ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [dni, setDni] = useState(initial?.dni ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");

  const [bio, setBio] = useState(initial?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [displayOrder, setDisplayOrder] = useState(initial?.displayOrder ?? 1);
  const [skillsText, setSkillsText] = useState(initial?.skillsText ?? "");

  const [useOverride, setUseOverride] = useState(
    Boolean(initial?.scheduleOverride)
  );
  const [openDaysText, setOpenDaysText] = useState(
    initial?.scheduleOverride?.openDays?.join(",") ?? "2,3,4,5,6"
  );

  const [start1, setStart1] = useState(
    initial?.scheduleOverride?.intervals?.[0]?.start ?? "09:00"
  );
  const [end1, setEnd1] = useState(
    initial?.scheduleOverride?.intervals?.[0]?.end ?? "12:30"
  );
  const [start2, setStart2] = useState(
    initial?.scheduleOverride?.intervals?.[1]?.start ?? "16:00"
  );
  const [end2, setEnd2] = useState(
    initial?.scheduleOverride?.intervals?.[1]?.end ?? "20:30"
  );

  async function onPickPhoto(file) {
    if (!file) return;

    if (file.size > MAX_IMG_BYTES) {
      onToast?.({
        type: "error",
        title: "Imagen pesada",
        message:
          "La foto supera 2MB. Elegí una más liviana (o después comprimimos automático).",
      });
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotoUrl(dataUrl);
      onToast?.({ type: "success", title: "Listo", message: "Foto cargada." });
    } catch {
      onToast?.({
        type: "error",
        title: "Error",
        message: "No se pudo leer la foto.",
      });
    }
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();

        const fn = safeTrim(firstName);
        const ln = safeTrim(lastName);
        const fullName = `${fn} ${ln}`.trim() || safeTrim(initial?.name) || "";

        if (!fn && !safeTrim(initial?.name)) {
          onToast?.({
            type: "error",
            title: "Falta dato",
            message: "Poné al menos el nombre.",
          });
          return;
        }

        const skills = normalizeCommaList(skillsText);

        let scheduleOverride = null;
        if (useOverride) {
          const openDays = safeTrim(openDaysText)
            .split(",")
            .map((x) => Number(x.trim()))
            .filter((n) => !Number.isNaN(n));

          if (openDays.length === 0) {
            onToast?.({
              type: "error",
              title: "Días inválidos",
              message: "Ej: 2,3,4,5,6",
            });
            return;
          }

          if (end1 < start1) {
            onToast?.({
              type: "error",
              title: "Horario inválido",
              message: "Franja 1 inválida.",
            });
            return;
          }

          if (end2 < start2) {
            onToast?.({
              type: "error",
              title: "Horario inválido",
              message: "Franja 2 inválida.",
            });
            return;
          }

          scheduleOverride = {
            openDays,
            intervals: [
              { start: start1, end: end1 },
              { start: start2, end: end2 },
            ],
            stepMinutes: 30,
            bufferMin: 0,
          };
        }

        onSubmit({
          name: fullName || safeTrim(initial?.name) || fn,
          firstName: fn,
          lastName: ln,
          age: safeTrim(age),
          birthday: safeTrim(birthday),
          phone: safeTrim(phone),
          dni: safeTrim(dni),
          address: safeTrim(address),
          bio: safeTrim(bio),
          photoUrl: safeTrim(photoUrl),
          displayOrder: normalizeDisplayOrder(displayOrder, 1),
          skills,
          scheduleOverride,
        });
      }}
    >
      <div className="miniTitle">Datos del staff</div>

      <div className="twoCols">
        <Input
          label="Nombre"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Nicolás"
        />
        <Input
          label="Apellido"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Gómez"
        />
      </div>

      <div className="twoCols">
        <Input
          label="Edad (opcional)"
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="25"
        />
        <Input
          label="Fecha de nacimiento (opcional)"
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
        />
      </div>

      <div className="twoCols">
        <Input
          label="Teléfono (opcional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="351 1234567"
        />
        <Input
          label="DNI (opcional)"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          placeholder="12345678"
        />
      </div>

      <Input
        label="Dirección (opcional)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Barrio / Calle..."
      />

      <Input
        label="Orden visual"
        type="number"
        min="0"
        value={displayOrder}
        onChange={(e) => setDisplayOrder(e.target.value)}
      />

      <hr className="hr" />

      <div className="miniTitle">Lo que se ve en la web</div>

      <div className="selectField">
        <div className="label">Foto del staff</div>

        <input
          type="file"
          accept="image/*"
          capture="user"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            await onPickPhoto(file);
            e.target.value = "";
          }}
        />

        {photoUrl ? (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <div className="muted small">Vista previa</div>
            <img
              src={photoUrl}
              alt="preview staff"
              style={{
                width: "100%",
                maxWidth: 520,
                height: 240,
                objectFit: "cover",
                borderRadius: 14,
                border: "1px solid var(--border)",
              }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="setBtn ghost"
                onClick={() => setPhotoUrl("")}
              >
                Quitar foto
              </button>
            </div>
          </div>
        ) : (
          <div className="muted small">
            Subí una foto desde el celu o elegí un archivo.
          </div>
        )}
      </div>

      <Input
        label="Skills (separadas por coma)"
        value={skillsText}
        onChange={(e) => setSkillsText(e.target.value)}
        placeholder="Fade, Barba, Color, Perfilado..."
      />

      <label className="selectField">
        <div className="label">Bio</div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Breve descripción profesional (se muestra en la web)."
          rows={5}
        />
      </label>

      <hr className="hr" />

      <div className="miniTitle">Horario del staff</div>
      <div className="chips">
        <button
          type="button"
          className={`chip ${!useOverride ? "active" : ""}`}
          onClick={() => setUseOverride(false)}
        >
          Usa horario global
        </button>
        <button
          type="button"
          className={`chip ${useOverride ? "active" : ""}`}
          onClick={() => setUseOverride(true)}
        >
          Horario propio
        </button>
      </div>

      {useOverride ? (
        <>
          <Input
            label="Días abiertos (0=Dom,1=Lun,...6=Sáb) ej: 2,3,4,5,6"
            value={openDaysText}
            onChange={(e) => setOpenDaysText(e.target.value)}
          />

          <div className="twoCols">
            <Input
              label="Franja 1 - Desde"
              type="time"
              value={start1}
              onChange={(e) => setStart1(e.target.value)}
            />
            <Input
              label="Franja 1 - Hasta"
              type="time"
              value={end1}
              onChange={(e) => setEnd1(e.target.value)}
            />
            <Input
              label="Franja 2 - Desde"
              type="time"
              value={start2}
              onChange={(e) => setStart2(e.target.value)}
            />
            <Input
              label="Franja 2 - Hasta"
              type="time"
              value={end2}
              onChange={(e) => setEnd2(e.target.value)}
            />
          </div>

          <div className="muted small">
            Tip: si ese staff no trabaja tarde, dejá la franja 2 igual a
            16:00–16:00.
          </div>
        </>
      ) : null}

      <div className="formActions">
        <Button type="submit">Guardar</Button>
      </div>
    </form>
  );
}

/* ===================== BLOCKS ===================== */

function BlocksTab({
  staff,
  blocks,
  onRefresh,
  onToast,
  onConfirm,
  apiCreateBlock,
  apiDeleteBlock,
  apiBlockFullDay,
}) {
  const [open, setOpen] = useState(false);

  const [openFullDay, setOpenFullDay] = useState(false);
  const [fullDayDate, setFullDayDate] = useState(todayISO());
  const [fullDayReason, setFullDayReason] = useState("Cerrado (día completo)");

  return (
    <div className="panel card">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Bloqueos</div>
          <div className="muted small">
            Vacaciones, médicos, reuniones. Los slots no ofrecen esos horarios.
          </div>
        </div>

        <div className="panelHeaderActions">
          <Button type="button" onClick={() => setOpenFullDay(true)}>
            Bloquear día completo
          </Button>

          <Button onClick={() => setOpen(true)} type="button">
            Nuevo bloqueo
          </Button>
        </div>
      </div>

      <div className="list">
        {blocks.length === 0 ? <div className="muted">No hay bloqueos.</div> : null}

        {blocks.map((b) => (
          <div key={b.id} className="row card rowInner">
            <div className="rowMain">
              <div className="rowTitle">
                {b.dateStr} · {b.start}–{b.end}
              </div>
              <div className="muted small">
                {b.staffId
                  ? `Staff: ${staff.find((s) => s.id === b.staffId)?.name ?? "?"}`
                  : "Staff: TODOS"}
                {b.reason ? ` · ${b.reason}` : ""}
              </div>
            </div>

            <div className="rowActions">
              <Button
                variant="danger"
                type="button"
                onClick={() => {
                  onConfirm?.({
                    title: "Eliminar bloqueo",
                    message: "¿Seguro que querés eliminar este bloqueo?",
                    confirmText: "Sí, eliminar",
                    tone: "danger",
                    onConfirm: async () => {
                      try {
                        await apiDeleteBlock(b.id);
                        onToast?.({
                          type: "success",
                          title: "Eliminado",
                          message: "Bloqueo eliminado.",
                        });
                        onRefresh();
                      } catch (e) {
                        onToast?.({
                          type: "error",
                          title: "Error",
                          message:
                            e?.response?.data?.error?.message ||
                            "No se pudo eliminar el bloqueo.",
                        });
                      }
                    },
                  });
                }}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} title="Nuevo bloqueo" onClose={() => setOpen(false)}>
        <BlockForm
          staff={staff}
          onToast={onToast}
          onSubmit={async (payload) => {
            try {
              await apiCreateBlock({
                dateStr: payload.dateStr,
                staffId: payload.staffId || null,
                start: payload.start,
                end: payload.end,
                reason: payload.reason,
              });

              onToast?.({
                type: "success",
                title: "Guardado",
                message: "Bloqueo creado correctamente.",
              });
              onRefresh();
              setOpen(false);
            } catch (e) {
              onToast?.({
                type: "error",
                title: "Error",
                message:
                  e?.response?.data?.error?.message ||
                  "No se pudo crear el bloqueo.",
              });
            }
          }}
        />
      </Modal>

      <Modal
        open={openFullDay}
        title="Bloquear día completo"
        onClose={() => setOpenFullDay(false)}
      >
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();

            const dateStr = safeTrim(fullDayDate);
            if (!dateStr) {
              onToast?.({
                type: "error",
                title: "Falta dato",
                message: "Elegí una fecha.",
              });
              return;
            }

            try {
              await apiBlockFullDay({
                dateStr,
                staffId: null,
                reason: safeTrim(fullDayReason) || "Cerrado (día completo)",
              });

              onToast?.({
                type: "success",
                title: "Listo",
                message: `Día bloqueado: ${dateStr}`,
              });
              onRefresh();
              setOpenFullDay(false);
            } catch (e2) {
              onToast?.({
                type: "error",
                title: "Error",
                message:
                  e2?.response?.data?.error?.message ||
                  "No se pudo bloquear el día completo.",
              });
            }
          }}
        >
          <Input
            label="Fecha"
            type="date"
            value={fullDayDate}
            onChange={(e) => setFullDayDate(e.target.value)}
          />
          <Input
            label="Motivo (opcional)"
            value={fullDayReason}
            onChange={(e) => setFullDayReason(e.target.value)}
          />
          <div className="formActions">
            <Button type="submit">Bloquear</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function BlockForm({ staff, onSubmit, onToast }) {
  const [dateStr, setDateStr] = useState(todayISO());
  const [staffId, setStaffId] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [reason, setReason] = useState("");

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();

        if (!dateStr) {
          onToast?.({
            type: "error",
            title: "Falta dato",
            message: "Elegí fecha.",
          });
          return;
        }
        if (!start || !end) {
          onToast?.({
            type: "error",
            title: "Falta dato",
            message: "Elegí desde/hasta.",
          });
          return;
        }
        if (end <= start) {
          onToast?.({
            type: "error",
            title: "Horario inválido",
            message: "Hasta debe ser mayor que Desde.",
          });
          return;
        }

        onSubmit({ dateStr, staffId, start, end, reason: safeTrim(reason) });
      }}
    >
      <Input
        label="Fecha"
        type="date"
        value={dateStr}
        onChange={(e) => setDateStr(e.target.value)}
      />

      <label className="selectField">
        <div className="label">Staff (opcional)</div>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">Todos</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="twoCols">
        <Input
          label="Desde"
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <Input
          label="Hasta"
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>

      <Input
        label="Motivo (opcional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      <div className="formActions">
        <Button type="submit">Guardar bloqueo</Button>
      </div>
    </form>
  );
}

/* ===================== CALENDAR (SPECIAL DAYS) ===================== */

function CalendarTab({
  specialDays,
  onRefresh,
  onToast,
  onConfirm,
  apiUpsertSpecialDay,
  apiDeleteSpecialDay,
}) {
  const [dateStr, setDateStr] = useState(todayISO());
  const [open, setOpen] = useState(false);

  const [start1, setStart1] = useState("09:00");
  const [end1, setEnd1] = useState("12:30");
  const [start2, setStart2] = useState("16:00");
  const [end2, setEnd2] = useState("20:30");

  async function addException() {
    if (!dateStr) {
      onToast?.({
        type: "error",
        title: "Falta dato",
        message: "Elegí fecha.",
      });
      return;
    }

    try {
      await apiUpsertSpecialDay({
        dateStr,
        open,
        intervals: open
          ? [
              { start: start1, end: end1 },
              { start: start2, end: end2 },
            ]
          : [],
      });

      onToast?.({
        type: "success",
        title: "Guardado",
        message: "Excepción guardada.",
      });
      onRefresh();
    } catch (e) {
      onToast?.({
        type: "error",
        title: "Error",
        message:
          e?.response?.data?.error?.message ||
          "No se pudo guardar la excepción.",
      });
    }
  }

  return (
    <div className="panel card">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Calendario (feriados / excepciones)</div>
          <div className="muted small">
            Define días especiales: abierto/cerrado y horarios distintos.
          </div>
        </div>
      </div>

      <div className="form" style={{ marginTop: 12 }}>
        <Input
          label="Fecha"
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
        />

        <div className="chips">
          <button
            type="button"
            className={`chip ${open ? "active" : ""}`}
            onClick={() => setOpen(true)}
          >
            Abierto
          </button>
          <button
            type="button"
            className={`chip ${!open ? "active" : ""}`}
            onClick={() => setOpen(false)}
          >
            Cerrado
          </button>
        </div>

        {open ? (
          <div className="twoCols">
            <Input
              label="Franja 1 - Desde"
              type="time"
              value={start1}
              onChange={(e) => setStart1(e.target.value)}
            />
            <Input
              label="Franja 1 - Hasta"
              type="time"
              value={end1}
              onChange={(e) => setEnd1(e.target.value)}
            />

            <Input
              label="Franja 2 - Desde"
              type="time"
              value={start2}
              onChange={(e) => setStart2(e.target.value)}
            />
            <Input
              label="Franja 2 - Hasta"
              type="time"
              value={end2}
              onChange={(e) => setEnd2(e.target.value)}
            />
          </div>
        ) : null}

        <div className="formActions">
          <Button type="button" onClick={addException}>
            Guardar excepción
          </Button>
        </div>
      </div>

      <hr className="hr" />

      <div className="list">
        {specialDays.length === 0 ? (
          <div className="muted">Sin excepciones todavía.</div>
        ) : null}

        {specialDays.map((d) => (
          <div key={d.dateStr} className="row card rowInner">
            <div className="rowMain">
              <div className="rowTitle">{d.dateStr}</div>
              <div className="muted small">
                {d.open
                  ? `Abierto (${(d.intervals || [])
                      .map((i) => `${i.start}-${i.end}`)
                      .join(" | ")})`
                  : "Cerrado"}
              </div>
            </div>

            <div className="rowActions">
              <Button
                variant="danger"
                type="button"
                onClick={() => {
                  onConfirm?.({
                    title: "Eliminar excepción",
                    message:
                      "¿Seguro que querés eliminar esta excepción del calendario?",
                    confirmText: "Sí, eliminar",
                    tone: "danger",
                    onConfirm: async () => {
                      try {
                        await apiDeleteSpecialDay(d.dateStr);
                        onToast?.({
                          type: "success",
                          title: "Eliminado",
                          message: "Excepción eliminada.",
                        });
                        onRefresh();
                      } catch (e) {
                        onToast?.({
                          type: "error",
                          title: "Error",
                          message:
                            e?.response?.data?.error?.message ||
                            "No se pudo eliminar la excepción.",
                        });
                      }
                    },
                  });
                }}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== USUARIO (REAL) ===================== */

function UserTab({ onToast, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/me");
        const u = data?.user?.username || "";
        if (alive) setUsername(u);
      } catch (e) {
        onToast?.({
          type: "error",
          title: "Error",
          message:
            e?.response?.data?.error?.message ||
            "No se pudo cargar el usuario.",
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [onToast]);

  async function save() {
    const u = safeTrim(username);
    if (!u) {
      onToast?.({
        type: "error",
        title: "Usuario inválido",
        message: "El usuario no puede estar vacío.",
      });
      return;
    }

    if (pass1 || pass2) {
      if (String(pass1).length < 6) {
        onToast?.({
          type: "error",
          title: "Contraseña débil",
          message: "Usá mínimo 6 caracteres.",
        });
        return;
      }
      if (pass1 !== pass2) {
        onToast?.({
          type: "error",
          title: "No coincide",
          message: "Las contraseñas no coinciden.",
        });
        return;
      }
    }

    try {
      setLoading(true);

      await api.patch("/account/credentials", {
        username: u,
        password: pass1 ? String(pass1) : "",
      });

      onToast?.({
        type: "success",
        title: "Guardado",
        message: "Credenciales actualizadas.",
      });
      setPass1("");
      setPass2("");
    } catch (e) {
      onToast?.({
        type: "error",
        title: "Error",
        message: e?.response?.data?.error?.message || "No se pudo guardar.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    onConfirm?.({
      title: "Restablecer credenciales",
      message:
        "Esto vuelve el usuario/contraseña a nico / nico789.\n\n¿Seguro que querés continuar?",
      confirmText: "Sí, restablecer",
      tone: "danger",
      onConfirm: async () => {
        try {
          setLoading(true);

          await api.patch("/account/credentials", {
            username: "nico",
            password: "nico789",
          });

          setUsername("nico");
          setPass1("");
          setPass2("");

          onToast?.({
            type: "success",
            title: "Listo",
            message: "Se restableció a nico/nico789.",
          });
        } catch (e) {
          onToast?.({
            type: "error",
            title: "Error",
            message: e?.response?.data?.error?.message || "No se pudo restablecer.",
          });
        } finally {
          setLoading(false);
        }
      },
    });
  }

  return (
    <div className="panel card">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Usuario</div>
          <div className="muted small">
            Modo real: se guarda en el servidor (backend).
          </div>
        </div>

        <Button variant="danger" type="button" onClick={reset} disabled={loading}>
          Restablecer
        </Button>
      </div>

      <div className="form">
        <Input
          label="Nombre de usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="nico"
          disabled={loading}
        />

        <div className="twoCols">
          <Input
            label="Nueva contraseña (opcional)"
            type="password"
            value={pass1}
            onChange={(e) => setPass1(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
          />
          <Input
            label="Repetir contraseña"
            type="password"
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
          />
        </div>

        <div className="formActions">
          <Button type="button" onClick={save} disabled={loading}>
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        </div>

        <div className="muted small">
          Tip: si dejás contraseña vacía, solo cambia el usuario.
        </div>
      </div>
    </div>
  );
}
