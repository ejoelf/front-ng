import { useNotifications } from "../../../store/notificationsStore";

export default function NotificationsDropdown({ onNavigate }) {
  const { notifications } = useNotifications();

  if (!notifications.length) {
    return (
      <div className="notifDropdown">
        <p className="notifEmpty">Sin notificaciones</p>
      </div>
    );
  }

  return (
    <div className="notifDropdown">
      {notifications.slice(0, 10).map((n) => (
        <div
          key={n.id}
          className={`notifItem notif-${n.type}`}
          onClick={() => onNavigate(n)}
        >
          <strong>{n.title}</strong>
          <p>{n.message}</p>
        </div>
      ))}
    </div>
  );
}