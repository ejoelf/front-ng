// src/services/mock/mockDb.js
import { seedData } from "../seed";
import { addMinutes } from "../../utils/time";
import { normalizePaymentMethod } from "../../utils/paymentMethods";
import { makeIncomeFromAppt, upsertClientInternal } from "./mockHelpers";

const KEY = "tp_db_v1";

/* =================== STORAGE =================== */

export function loadDB() {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    localStorage.setItem(KEY, JSON.stringify(seedData));
    return structuredClone(seedData);
  }
  return JSON.parse(raw);
}

export function saveDB(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

/* =================== MIGRATIONS =================== */

function normPhone(v) {
  return String(v || "").trim();
}

export function migrateDB(db) {
  // business
  if (!db.business) db.business = structuredClone(seedData.business);

  if (!db.business.schedule) db.business.schedule = structuredClone(seedData.business.schedule);
  if (!db.business.specialDays) db.business.specialDays = [];

  // ✅ landing brand
  if (!db.business.brand) db.business.brand = structuredClone(seedData.business.brand || {});
  if (!("logoUrl" in db.business.brand)) db.business.brand.logoUrl = seedData.business?.brand?.logoUrl ?? "";
  if (!("heroImageUrl" in db.business.brand)) db.business.brand.heroImageUrl = seedData.business?.brand?.heroImageUrl ?? "";

  // collections
  if (!db.staff) db.staff = [];
  if (!db.services) db.services = [];
  if (!db.blocks) db.blocks = [];
  if (!db.recurringBlocks) db.recurringBlocks = [];
  if (!db.appointments) db.appointments = [];
  if (!db.clients) db.clients = [];
  if (!db.incomes) db.incomes = [];

  // ✅ staff schedule override + landing fields + datos extra
  for (const st of db.staff) {
    if (!("scheduleOverride" in st)) st.scheduleOverride = null;

    // landing
    if (!("role" in st)) st.role = "";
    if (!("bio" in st)) st.bio = "";
    if (!("photoUrl" in st)) st.photoUrl = "";
    if (!("isOwner" in st)) st.isOwner = false;

    // Settings (datos internos)
    if (!("firstName" in st)) st.firstName = "";
    if (!("lastName" in st)) st.lastName = "";
    if (!("age" in st)) st.age = "";
    if (!("birthday" in st)) st.birthday = "";
    if (!("phone" in st)) st.phone = "";
    if (!("dni" in st)) st.dni = "";
    if (!("address" in st)) st.address = "";

    // ✅ compat: si no hay name, lo armamos
    const fullName = `${String(st.firstName || "").trim()} ${String(st.lastName || "").trim()}`.trim();
    if (!("name" in st) || !String(st.name || "").trim()) st.name = fullName || "Staff";
  }

  // ✅ services landing fields
  for (const sv of db.services) {
    if (!("imageUrl" in sv)) sv.imageUrl = "";
  }

  // ✅ clients extra fields (para Clients.jsx + Settings)
  for (const c of db.clients) {
    if (!("notes" in c)) c.notes = "";
    if (!("email" in c)) c.email = "";
    if (!("birthday" in c)) c.birthday = "";
    if (!("tags" in c)) c.tags = [];
    if (!("createdAt" in c)) c.createdAt = new Date().toISOString();
    if (!("updatedAt" in c)) c.updatedAt = new Date().toISOString();

    // ✅ soft delete flags
    if (!("isDeleted" in c)) c.isDeleted = false;
    if (!("deletedAt" in c)) c.deletedAt = "";
  }

  // backfill endAt + status
  for (const appt of db.appointments) {
    if (!appt.endAt || appt.endAt === appt.startAt) {
      const service = db.services.find((s) => s.id === appt.serviceId);
      const dur = service?.durationMin ?? 30;
      const start = new Date(appt.startAt);
      appt.endAt = addMinutes(start, dur).toISOString();
    }
    if (!appt.status) appt.status = "confirmed";
  }

  // backfill incomes
  for (const appt of db.appointments) {
    const hasIncome = db.incomes.some((i) => i.appointmentId === appt.id);
    if (!hasIncome) db.incomes.push(makeIncomeFromAppt(appt));
  }

  // normalize payment methods + status permitido
  for (const inc of db.incomes) {
    if (!inc) continue;

    // ✅ allow: pending | paid | void | unpaid
    if (!inc.paidStatus) inc.paidStatus = "pending";
    if (!["pending", "paid", "void", "unpaid"].includes(inc.paidStatus)) inc.paidStatus = "pending";

    inc.paymentMethod = normalizePaymentMethod(inc.paymentMethod);

    // si es pending/unpaid, no debe tener amountFinal/method
    if (inc.paidStatus === "pending" || inc.paidStatus === "unpaid") {
      if (!("amountFinal" in inc)) inc.amountFinal = null;
      inc.amountFinal = null;
      inc.paymentMethod = null;
    }
  }

  // ✅ backfill clients desde appointments (SIN revivir eliminados)
  // Regla: si existe un cliente con ese phone y está isDeleted=true => NO lo recreamos
  for (const appt of db.appointments) {
    const ph = normPhone(appt.clientPhone);
    if (!ph) continue;

    const existing = (db.clients || []).find((c) => normPhone(c.phone) === ph);

    // si existe y está eliminado => no lo tocamos (así no "revive" por migrate)
    if (existing && existing.isDeleted) continue;

    upsertClientInternal(db, {
      name: appt.clientName,
      phone: appt.clientPhone,
      email: appt.clientEmail || "",
      notes: appt.notes || "",
    });
  }

  return db;
}

/* =================== PUBLIC INIT =================== */

export function dbInit() {
  const db = migrateDB(loadDB());
  saveDB(db);
}
