// src/services/mock/mockServices.js
import { loadDB, saveDB, migrateDB } from "./mockDb";

export function listServices() {
  const db = migrateDB(loadDB());
  saveDB(db);
  return db.services;
}

export function createService(service) {
  const db = migrateDB(loadDB());
  db.services.push(service);
  saveDB(db);
  return { ok: true };
}

export function deleteService(serviceId) {
  const db = migrateDB(loadDB());
  db.services = db.services.filter((s) => s.id !== serviceId);
  saveDB(db);
  return { ok: true };
}

export function updateService(serviceId, patch) {
  const db = migrateDB(loadDB());
  const s = db.services.find((x) => x.id === serviceId);
  if (!s) return { ok: false, message: "Servicio no encontrado" };
  Object.assign(s, patch);
  saveDB(db);
  return { ok: true };
}
