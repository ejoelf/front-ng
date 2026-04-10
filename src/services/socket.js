import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_BASE_URL;

// limpia /api al final de forma segura
const SOCKET_URL = API_URL?.replace(/\/api\/?$/, "");

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  withCredentials: true,
});

socket.on("connect", () => {
  console.log("🟢 Socket conectado:", socket.id);
});

socket.on("disconnect", () => {
  console.log("🔴 Socket desconectado");
});