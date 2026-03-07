import { Outlet } from "react-router-dom";
import "./PublicLayout.css";
import PublicFooter from "../components/public/PublicFooter";

export default function PublicLayout() {
  return (
    <div className="pubShell">
      <main className="pubMain">
        <Outlet />
      </main>

      <PublicFooter />
    </div>
  );
}