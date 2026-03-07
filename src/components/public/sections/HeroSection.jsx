import "./HeroSection.css";
import { NavLink } from "react-router-dom";

export default function HeroSection({ business }) {
  const hero = business?.brand?.heroImageUrl || "/Hero.jpeg";
  const logo = business?.brand?.logoUrl || "/LogoNG.png";
  const businessName = business?.name || "Nico Galicia";

  return (
    <section className="hero" id="inicio">
      <div
        className="heroBg"
        style={{ backgroundImage: `url(${hero})` }}
      />
      <div className="heroOverlay" />

      <div className="heroInner">
        <div className="heroText">
          <h1>{businessName}</h1>

          <p>
            En nuestro local, cada detalle está pensado para que vivas una
            experiencia de primer nivel. Confianza, estilo y pasión en cada
            corte.
          </p>

          <div className="heroActions">
            <NavLink className="heroBtn" to="/reservar">
              Reservar turno
            </NavLink>
          </div>
        </div>

        <div className="heroLogoCard">
          <img src={logo} alt={`Logo de ${businessName}`} />
        </div>
      </div>
    </section>
  );
}