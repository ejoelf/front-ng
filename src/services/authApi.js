import api from "./http";

// POST /api/auth/login
export async function apiLogin({ username, password }) {
  const { data } = await api.post("/auth/login", { username, password });
  return data; // { accessToken, refreshToken? }
}
