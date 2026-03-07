import { Outlet, NavLink, useNavigate } from "react-router-dom";
import "./AdminLayout.css";
import { logout } from "../store/authStore";
import { useEffect, useState } from "react";

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

  return (
    <div
      className={`adminShell ${collapsed ? "isCollapsed" : ""} ${
        mobileOpen ? "isMobileOpen" : ""
      }`}
    >
      <button
        type="button"
        className="adminOverlay"
        onClick={closeMobile}
        aria-label="Cerrar menú"
      />

      <aside className="adminSidebar">
        <div className="adminBrand">
          <div className="adminBrandTop">
            <div className="adminBrandLeft">
              <div className="adminLogo"></div>
              <div className="adminBrandText">
                <div className="adminBrandTitle">Panel</div>
              </div>
            </div>

            <button
              type="button"
              className="adminCollapseBtn"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir panel" : "Ocultar panel"}
              title={collapsed ? "Expandir" : "Ocultar"}
            >
              {collapsed ? "»" : "«"}
            </button>
          </div>
        </div>

        <nav className="adminNav" onClick={closeMobile}>
          {NAV_ITEMS.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) => (isActive ? "active" : "")}
              title={it.label}
              aria-label={it.label}
            >
              <span className="navIcon" aria-hidden="true">
                {it.icon}
              </span>
              <span className="navLabel">{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="adminLogout"
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <span className="navIcon" aria-hidden="true">
            🚫
          </span>
          <span className="navLabel">Cerrar sesión</span>
        </button>
      </aside>

      <main className="adminMain">
        <div className="adminTopbar">
          <button
            type="button"
            className="adminMobileMenuBtn"
            onClick={openMobile}
            aria-label="Abrir menú"
          >
            ☰
          </button>
        </div>

        <Outlet />
      </main>
    </div>
  );
}