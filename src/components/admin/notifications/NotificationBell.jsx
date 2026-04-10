import { useState } from "react";
import { useNotifications } from "../../../store/notificationsStore";
import NotificationsDropdown from "./NotificationsDropdown";
import NotificationsModal from "./NotificationsModal";

export default function NotificationBell({ onNavigate }) {
  const { unread } = useNotifications();

  const [hoverOpen, setHoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        className="adminNotificationWrapper"
        onMouseEnter={() => setHoverOpen(true)}
        onMouseLeave={() => setHoverOpen(false)}
      >
        <button
          className="adminNotificationBell"
          onClick={() => setModalOpen(true)}
        >
          🔔
          {unread > 0 && <span className="notifBadge">{unread}</span>}
        </button>

        {hoverOpen && (
          <NotificationsDropdown onNavigate={onNavigate} />
        )}
      </div>

      {modalOpen && (
        <NotificationsModal
          onClose={() => setModalOpen(false)}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}