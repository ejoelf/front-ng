import { Outlet, NavLink, useNavigate } from "react-router-dom";
import "./AdminLayout.css";
import { logout } from "../store/authStore";
import { useNotifications } from "../store/notificationsStore";
import { useEffect, useState, useRef } from "react";

const LS_KEY = "tp_admin_sidebar_collapsed";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/admin/calendar", label: "Agenda", icon: "📅" },
  { to: "/admin/clients", label: "Clientes", icon: "👥" },
  { to: "/admin/cashbox", label: "Caja", icon: "💳" },
  { to: "/admin/settings", label: "Ajustes", icon: "⚙️" },
  { to: "/admin/exports", label: "Exportaciones", icon: "⬇️" },
  { to: "/admin/monthly", label: "Resumen mensual", icon: "🗓️" },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { notifications, unread, markAllAsRead } = useNotifications();

  const [hoverOpen, setHoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const hoverRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(LS_KEY, next ? "1" : "0");
      return next;
    });
  }

  function openMobile() {
    setMobileOpen(true);
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  function handleNotificationClick(notification) {
    if (!notification) return;

    if (notification.type === "contact") {
      window.open("https://mail.hostinger.com/v2/mailboxes/INBOX", "_blank");
      return;
    }

    const appointmentId = notification.data?.appointmentId;
    const dateStr = notification.data?.dateStr;

    if (appointmentId && dateStr) {
      setModalOpen(false);
      setHoverOpen(false);
      navigate(`/admin/calendar?highlight=${appointmentId}&date=${dateStr}`);
      return;
    }

    if (appointmentId) {
      setModalOpen(false);
      setHoverOpen(false);
      navigate(`/admin/calendar?highlight=${appointmentId}`);
      return;
    }

    setModalOpen(false);
    setHoverOpen(false);
    navigate("/admin/calendar");
  }

  function handleBellClick() {
    setModalOpen(true);
    markAllAsRead();
  }

  return (
    <div
      className={`adminShell ${collapsed ? "isCollapsed" : ""} ${
        mobileOpen ? "isMobileOpen" : ""
      }`}
    >
      <button className="adminOverlay" onClick={closeMobile} />

      <aside className="adminSidebar">
        <div className="adminBrand">
          <div className="adminBrandTop">
            <div className="adminBrandLeft">
              <div className="adminLogo"></div>

              <div className="adminBrandText">
                <div className="adminBrandTitle">Panel</div>
              </div>
            </div>

            <div className="adminBrandActions">
              <div
                className="adminNotificationWrapper"
                ref={hoverRef}
                onMouseEnter={() => setHoverOpen(true)}
                onMouseLeave={() => setHoverOpen(false)}
              >
                <button
                  className="adminNotificationBell"
                  onClick={handleBellClick}
                >
                  🔔
                  {unread > 0 && <span className="notifBadge">{unread}</span>}
                </button>

                {hoverOpen && (
                  <div className="notifDropdown">
                    {notifications.length === 0 ? (
                      <p className="notifEmpty">Sin notificaciones</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`notifItem notif-${n.type} ${n.read ? "read" : ""}`}
                          onClick={() => handleNotificationClick(n)}
                        >
                          <strong>{n.title}</strong>
                          <p>{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button
                className="adminCollapseBtn"
                onClick={toggleCollapsed}
              >
                {collapsed ? "»" : "«"}
              </button>
            </div>
          </div>
        </div>

        <nav className="adminNav" onClick={closeMobile}>
          {NAV_ITEMS.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <span className="navIcon">{it.icon}</span>
              <span className="navLabel">{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="adminLogout" onClick={handleLogout}>
          <span className="navIcon">🚫</span>
          <span className="navLabel">Cerrar sesión</span>
        </button>
      </aside>

      <main className="adminMain">
        <div className="adminTopbar">
          <button className="adminMobileMenuBtn" onClick={openMobile}>
            ☰
          </button>
        </div>

        <Outlet />
      </main>

      {modalOpen && (
        <div
          className="notifModalOverlay"
          onClick={() => setModalOpen(false)}
        >
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
                    onClick={() => handleNotificationClick(n)}
                  >
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                  </div>
                ))
              )}
            </div>

            <button
              className="notifCloseBtn"
              onClick={() => setModalOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}