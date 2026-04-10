import { useNotifications } from "../../../store/notificationsStore";

export default function NotificationsModal({ onClose, onNavigate }) {
  const { notifications, markAllAsRead } = useNotifications();

  function handleOpen() {
    markAllAsRead();
  }

  // marcar como leídas al abrir
  handleOpen();

  return (
    <div className="notifModalOverlay" onClick={onClose}>
      <div
        className="notifModal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Notificaciones</h2>

        <div className="notifModalList">
          {notifications.length === 0 ? (
            <p>Sin notificaciones</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`notifItem notif-${n.type}`}
                onClick={() => {
                  onClose();       // 🔥 FIX
                  setTimeout(() => {
    onNavigate(n);
  }, 100);   // 🔥 navegar
                }}
              >
                <strong>{n.title}</strong>
                <p>{n.message}</p>
              </div>
            ))
          )}
        </div>

        <button className="notifCloseBtn" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}