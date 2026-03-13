import "./TeamSection.css";
import { useEffect, useMemo, useState } from "react";

function displayName(st) {
  const fn = String(st?.firstName ?? "").trim();
  const ln = String(st?.lastName ?? "").trim();
  const full = `${fn} ${ln}`.trim();

  return full || String(st?.name ?? "").trim() || "Miembro del equipo";
}

function normalizeStaffOrder(staff) {
  const arr = Array.isArray(staff) ? staff.slice() : [];

  arr.sort((a, b) => {
    const aOrder = Number(a?.displayOrder ?? 0) || 0;
    const bOrder = Number(b?.displayOrder ?? 0) || 0;

    if (aOrder !== bOrder) return aOrder - bOrder;

    const ao = a?.isOwner ? 0 : 1;
    const bo = b?.isOwner ? 0 : 1;

    if (ao !== bo) return ao - bo;

    return displayName(a).localeCompare(displayName(b), "es");
  });

  return arr.slice(0, 10);
}

export default function TeamSection({ staff }) {
  const items = useMemo(() => normalizeStaffOrder(staff), [staff]);

  const ownerIndex = useMemo(
    () => items.findIndex((x) => x?.isOwner),
    [items]
  );

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(ownerIndex >= 0 ? ownerIndex : 0);
  }, [ownerIndex]);

  const cur = items[idx] || null;
  const hasPrev = idx > 0;
  const hasNext = idx < items.length - 1;

  const name = cur ? displayName(cur) : "";
  const bio = String(cur?.bio || "—");
  const skills = Array.isArray(cur?.skills)
    ? cur.skills.filter(Boolean)
    : [];

  return (
    <section className="team" id="equipo">
      <div className="teamInner">
        <header className="teamHead">
          <h2>Conocé a nuestro equipo</h2>
          <p className="teamSub">
            Profesionales con experiencia y atención al detalle para que
            disfrutes una experiencia de primer nivel en cada visita.
          </p>
        </header>

        {!cur ? (
          <div className="teamEmpty">Todavía no hay staff cargado.</div>
        ) : (
          <div className="teamCard">
            <div className="teamPhoto">
              {cur.photoUrl ? (
                <img src={cur.photoUrl} alt={name} />
              ) : (
                <div className="teamPhotoFallback">Foto</div>
              )}
            </div>

            <div className="teamInfo">
              <div className="teamName">{name}</div>

              <div className="teamRole">
                {skills.length ? `Skills: ${skills.join(", ")}` : "Skills: —"}
              </div>

              <p className="teamBio">{bio}</p>

              <div className="teamArrows">
                <button
                  type="button"
                  className="teamArrow"
                  disabled={!hasPrev}
                  onClick={() => setIdx((x) => Math.max(0, x - 1))}
                  aria-label="Anterior"
                >
                  ←
                </button>

                <div className="teamCounter">
                  {items.length ? `${idx + 1} / ${items.length}` : ""}
                </div>

                <button
                  type="button"
                  className="teamArrow"
                  disabled={!hasNext}
                  onClick={() =>
                    setIdx((x) => Math.min(items.length - 1, x + 1))
                  }
                  aria-label="Siguiente"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}