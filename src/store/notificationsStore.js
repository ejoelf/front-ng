import { useCallback, useEffect, useState } from "react";
import api from "../services/http";
import { socket } from "../services/socket";

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      const list = Array.isArray(data?.notifications) ? data.notifications : [];

      setNotifications(list);
      setUnread(list.filter((n) => !n.read).length);
    } catch (e) {
      console.error("Error cargando notificaciones", e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleNewNotification(notif) {
      let shouldIncreaseUnread = false;

      setNotifications((prev) => {
        const exists = prev.some((n) => n.id === notif.id);
        if (exists) return prev;

        shouldIncreaseUnread = !notif?.read;
        return [notif, ...prev];
      });

      if (!notif?.read && shouldIncreaseUnread) {
        setUnread((prev) => prev + 1);
      }
    }

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, []);

  async function markAllAsRead() {
    try {
      await api.patch("/notifications/read-all");

      setUnread(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
    } catch (e) {
      console.error("Error marcando notificaciones", e);
    }
  }

  return {
    notifications,
    unread,
    markAllAsRead,
    reloadNotifications: load,
  };
}