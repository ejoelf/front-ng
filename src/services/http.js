import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL,
  timeout: 20000,
});

// dónde guardamos tokens
const ACCESS_KEY = "nd_access_token";
const REFRESH_KEY = "nd_refresh_token";

// helpers (los vamos a usar desde authStore también)
export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

// ✅ interceptor REQUEST: agrega Authorization automáticamente
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ interceptor RESPONSE: si el access token venció (401), lo renueva
// automáticamente con el refresh token y reintenta la request original.
// Si el refresh también venció, limpia la sesión y redirige al login.

let isRefreshing = false;
let pendingQueue = []; // requests que esperan el nuevo token

function processQueue(error, token = null) {
  pendingQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token);
    }
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Solo actuamos en 401 y si no es el endpoint de refresh/login
    // y si no reintentamos ya esta request antes
    const is401 = error.response?.status === 401;
    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/refresh");

    if (!is401 || isAuthEndpoint || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Si ya hay un refresh en curso, encolar esta request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    // Arrancar el proceso de refresh
    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      // No hay refresh token → limpiar sesión y mandar al login
      clearTokens();
      window.location.href = "/admin/login";
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${baseURL}/auth/refresh`, {
        refreshToken,
      });

      const newAccessToken = data?.data?.accessToken || data?.accessToken;

      if (!newAccessToken) throw new Error("No se recibió nuevo access token");

      // Guardar el nuevo access token
      setTokens({ accessToken: newAccessToken });

      // Procesar la cola de requests pendientes
      processQueue(null, newAccessToken);

      // Reintentar la request original con el nuevo token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      // El refresh también falló → sesión expirada definitivamente
      processQueue(refreshError, null);
      clearTokens();
      window.location.href = "/admin/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;