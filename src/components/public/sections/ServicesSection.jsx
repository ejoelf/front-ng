import "./ServicesSection.css";
import { NavLink } from "react-router-dom";

function formatARS(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR");
}

function clampServices(arr) {
  return (Array.isArray(arr) ? arr : []).slice(0, 10);
}

export default function ServicesSection({ services }) {
  const list = clampServices(services);
  const useCarousel = list.length > 3;

  return (
    <section className="svc" id="servicios">
      <div className="svcInner">
        <header className="svcHeader">
          <div className="svcHeadLeft">
            <h2>Nuestros servicios</h2>
            <p className="svcSubtitle">
              Conocé nuestras opciones y valores actualizados. Elegí tu servicio
              y reservá tu turno en pocos pasos.
            </p>
          </div>
        </header>

        <div className={useCarousel ? "svcCarousel" : "svcGrid"}>
          {list.length === 0 ? (
            <div className="svcEmpty">No hay servicios cargados por el momento.</div>
          ) : (
            list.map((s) => (
              <article key={s.id} className="svcCard">
                <div
                  className="svcImg"
                  style={{
                    backgroundImage: s.imageUrl ? `url(${s.imageUrl})` : "none",
                  }}
                >
                  {!s.imageUrl ? <div className="svcImgFallback">NG</div> : null}

                  <div className="svcPriceTag">${formatARS(s.price)}</div>
                </div>

                <div className="svcBody">
                  <div className="svcTitle">
                    {(s.name || "Servicio").toUpperCase()}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="svcActions">
          <NavLink className="svcBtn" to="/reservar">
            Reservar turno
          </NavLink>
        </div>
      </div>
    </section>
  );
}