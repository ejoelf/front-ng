// src/services/mock/mockUser.js

const KEY = "tp_auth_v1";

const DEFAULT = {
  username: "admin",
  password: "admin123",
};

export function getAuthConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      username: String(parsed?.username || DEFAULT.username),
      password: String(parsed?.password || DEFAULT.password),
    };
  } catch {
    return { ...DEFAULT };
  }
}

/**
 * password:
 * - si viene null/undefined => no pisa password (permite cambiar solo user)
 * - si viene string => pisa
 */
export function setAuthConfig({ username, password }) {
  const u = String(username || "").trim();
  if (!u) return { ok: false, message: "Usuario inválido" };

  const current = getAuthConfig();
  const next = {
    username: u,
    password: typeof password === "string" ? password : current.password,
  };

  localStorage.setItem(KEY, JSON.stringify(next));
  return { ok: true };
}

export function resetAuthConfig() {
  localStorage.setItem(KEY, JSON.stringify(DEFAULT));
  return { ok: true };
}
