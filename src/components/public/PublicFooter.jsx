import "./PublicFooter.css";
import { Link } from "react-router-dom";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

const WHATSAPP_NUMBER = "543585737060"; // +54 358 573 7060
const WHATSAPP_TEXT = encodeURIComponent(
  "Hola! Mi nombre es (TU NOMBRE). Quería saber si tenés turno disponible para el día de hoy. Gracias!"
);
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`;

const INSTAGRAM_HREF = "https://www.instagram.com/nico.galicia/";
const NEXO_HREF = "https://nexo-digital.tech/";

export default function PublicFooter() {
  return (
    <footer className="pubFooter">
      <div className="pubFooterInner">
        {/* Columna Izquierda */}
        <div className="pubFooterCol">
          <div className="pubFooterHeading">Navegación</div>

          <nav className="pubFooterNav" aria-label="Navegación del sitio">
            <button
              type="button"
              onClick={() => scrollToId("inicio")}
              className="pubFooterLink"
            >
              Inicio
            </button>

            <button
              type="button"
              onClick={() => scrollToId("servicios")}
              className="pubFooterLink"
            >
              Servicios
            </button>

            <button
              type="button"
              onClick={() => scrollToId("equipo")}
              className="pubFooterLink"
            >
              Equipo
            </button>

            <button
              type="button"
              onClick={() => scrollToId("contacto")}
              className="pubFooterLink"
            >
              Contacto
            </button>
          </nav>
        </div>

        {/* Columna Centro */}
        <div className="pubFooterCol pubFooterCenter">
          <div className="pubFooterHeading">Seguinos</div>

          <div className="pubSocial">
            <a
              href={WHATSAPP_HREF}
              aria-label="WhatsApp"
              className="pubSocialBtn"
              target="_blank"
              rel="noreferrer"
              title="Escribinos por WhatsApp"
            >
              <FaWhatsapp />
            </a>

            <a
              href={INSTAGRAM_HREF}
              aria-label="Instagram"
              className="pubSocialBtn"
              target="_blank"
              rel="noreferrer"
              title="Ver Instagram"
            >
              <FaInstagram />
            </a>
          </div>
        </div>

        {/* Columna Derecha */}
        <div className="pubFooterCol pubFooterRight">
          <div className="pubFooterHeading">Sistema</div>

          <Link to="/admin/login" className="pubFooterLink asLink">
            Ingresar
          </Link>
        </div>
      </div>

      {/* Barra inferior */}
      <div className="pubFooterBottom">
        <div className="pubFooterBottomInner">
          <div className="pubFooterCopy">
            © 2026{" "}
            <span className="pubFooterBrand">NG – hair stylist men</span> · Todos
            los derechos reservados
          </div>

          <div className="pubFooterMade">
            Creado por{" "}
            <a
              href={NEXO_HREF}
              className="pubLink"
              target="_blank"
              rel="noreferrer"
            >
              NexoDigital
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}