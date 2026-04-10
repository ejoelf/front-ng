import "./ServicesSection.css";
import { NavLink } from "react-router-dom";

function formatARS(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR");
}

function normalizeServicesOrder(services) {
  const arr = Array.isArray(services) ? services.slice() : [];

  arr.sort((a, b) => {
    const aOrder = Number(a?.displayOrder ?? 0) || 0;
    const bOrder = Number(b?.displayOrder ?? 0) || 0;

    if (aOrder !== bOrder) return aOrder - bOrder;

    const aName = String(a?.name || "").trim();
    const bName = String(b?.name || "").trim();

    return aName.localeCompare(bName, "es");
  });

  return arr.slice(0, 10);
}

export default function ServicesSection({ services }) {
  const list = normalizeServicesOrder(services);
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
          <div className="svcActionsCard">
            <div className="svcActionsIntro">
              <p className="svcActionsEyebrow">Turnos online</p>
              <h3>Reservá o gestioná tu turno</h3>
              <p className="svcActionsText">
                Sacá un nuevo turno o administrá una reserva existente de forma
                rápida y simple.
              </p>
            </div>

            <div className="svcActionsButtons">
              <NavLink className="svcBtn svcBtnPrimary" to="/reservar">
                Reservar nuevo turno
              </NavLink>

              <NavLink to="/turno" className="svcBtn svcBtnSecondary">
                Gestionar mi turno
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}