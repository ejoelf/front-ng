import "./NotFound.css";
import { NavLink } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="nfWrap">
      <div className="nf card">
        <div className="nfCode">404</div>
        <h2 className="nfTitle">Página no encontrada</h2>
        <p className="muted nfText">
          No encontramos esa página. Capaz el link está mal o la sección ya no existe.
        </p>

        <div className="nfActions">
          <NavLink className="nfBtn" to="/">
            Volver al inicio
          </NavLink>
        </div>
      </div>
    </div>
  );
}
