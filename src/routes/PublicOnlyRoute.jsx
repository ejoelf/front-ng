import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../store/authStore";

export default function PublicOnlyRoute({ children }) {
  if (isAuthenticated()) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
}