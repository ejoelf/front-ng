import { Routes, Route, Navigate } from "react-router-dom";

import PublicLayout from "../layouts/PublicLayout";
import AdminLayout from "../layouts/AdminLayout";

import ProtectedRoute from "./ProtectedRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";

import Home from "../pages/public/Home";
import Booking from "../pages/public/Booking";
import ManageAppointment from "../pages/public/ManageAppointment"; // 🔥 NUEVO

import Login from "../pages/admin/Login";
import Dashboard from "../pages/admin/Dashboard";
import Calendar from "../pages/admin/Calendar";
import Clients from "../pages/admin/Clients";
import Cashbox from "../pages/admin/Cashbox";
import Settings from "../pages/admin/Settings";
import Exports from "../pages/admin/Exports";
import MonthlyReport from "../pages/admin/MonthlyReport";

import NotFound from "../pages/NotFound";

export default function AppRouter() {
  return (
    <Routes>
      {/* ================= PUBLIC ================= */}
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="reservar" element={<Booking />} />

        {/* 🔥 NUEVA RUTA */}
        <Route path="turno" element={<ManageAppointment />} />
      </Route>

      {/* ================= ADMIN LOGIN ================= */}
      <Route
        path="/admin/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />

      {/* ================= ADMIN PANEL ================= */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="clients" element={<Clients />} />
        <Route path="cashbox" element={<Cashbox />} />
        <Route path="settings" element={<Settings />} />
        <Route path="exports" element={<Exports />} />
        <Route path="monthly" element={<MonthlyReport />} />
      </Route>

      {/* ================= 404 ================= */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}