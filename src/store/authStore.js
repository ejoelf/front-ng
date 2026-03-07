// src/store/authStore.js
import api, { setTokens, clearTokens } from "../services/http";

const SESSION_KEY = "nd_session";

function safeTrim(v) {
  return String(v ?? "").trim();
}

export async function login({ username, password, businessId }) {
  const u = safeTrim(username);
  const p = safeTrim(password);

  if (!u || !p) return { ok: false, message: "Completá usuario y contraseña." };

  try {
    // ✅ Login real al backend
    const { data } = await api.post("/auth/login", {
      username: u,
      password: p,
      // businessId es opcional (si tu backend lo pide, lo mandamos)
      ...(businessId ? { businessId } : {}),
    });

    // ✅ Guarda tokens
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });

    // ✅ Trae info del usuario actual (para mostrar/usar después)
    const me = await api.get("/me");

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        user: me.data?.user || null,
        business: me.data?.business || null,
      })
    );

    return { ok: true };
  } catch (err) {
    const msg =
      err?.response?.data?.error?.message ||
      err?.response?.data?.message ||
      "Credenciales inválidas.";
    return { ok: false, message: msg };
  }
}

export function logout() {
  clearTokens();
  localStorage.removeItem(SESSION_KEY);
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem("nd_access_token"));
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}