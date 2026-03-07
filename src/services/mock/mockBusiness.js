// src/services/mock/mockBusiness.js
import { loadDB, saveDB, migrateDB } from "./mockDb";

export function getBusiness() {
  const db = migrateDB(loadDB());
  saveDB(db);
  return db.business;
}

export function updateBusiness(patch) {
  const db = migrateDB(loadDB());
  db.business = { ...db.business, ...patch };
  saveDB(db);
  return { ok: true };
}
