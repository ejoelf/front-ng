import "./ContactSection.css";
import { useMemo, useState } from "react";
import api from "../../../services/http";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(email || "").trim());
}

export default function ContactSection({ business }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const [company, setCompany] = useState(""); // honeypot

  const [touched, setTouched] = useState({
    name: false,
    email: false,
    msg: false,
  });

  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({
    state: "idle",
    message: "",
  });

  const address =
    business?.address ||
    "General Paz 16, Las Higueras, Río Cuarto, Córdoba, Argentina";

  const mapQuery = encodeURIComponent(address);
  const mapSrc = `https://www.google.com/maps?q=${mapQuery}&output=embed`;

  const validation = useMemo(() => {
    const e = {};

    const n = name.trim();
    const em = email.trim();
    const m = msg.trim();

    if (!n) e.name = "Decinos tu nombre.";
    else if (n.length < 2) e.name = "Tu nombre se ve muy corto.";

    if (!em) e.email = "Necesitamos tu email para responderte.";
    else if (!isValidEmail(em)) e.email = "Ese email no parece válido.";

    if (!m) e.msg = "Contanos en qué te podemos ayudar.";
    else if (m.length < 10) e.msg = "Danos un poco más de detalle.";

    return e;
  }, [name, email, msg]);

  function markAllTouched() {
    setTouched({ name: true, email: true, msg: true });
  }

  async function submit(e) {
    e.preventDefault();

    // honeypot anti bots
    if (company.trim()) {
      setStatus({
        state: "success",
        message: "¡Gracias! Tu mensaje fue enviado.",
      });
      return;
    }

    const eObj = validation;
    setErrors(eObj);

    if (Object.keys(eObj).length > 0) {
      markAllTouched();
      setStatus({
        state: "error",
        message: "Revisá los campos marcados para poder enviar.",
      });
      return;
    }

    try {
      setStatus({ state: "sending", message: "Enviando…" });

      // 🔥 AHORA VA AL BACKEND
      const { data } = await api.post("/contact", {
        name: name.trim(),
        email: email.trim(),
        message: msg.trim(),
      });

      if (!data?.ok) {
        throw new Error(data?.message || "No se pudo enviar el mensaje.");
      }

      setStatus({
        state: "success",
        message: "¡Listo! Recibimos tu mensaje. Te respondemos pronto.",
      });

      setName("");
      setEmail("");
      setMsg("");
      setCompany("");
      setErrors({});
      setTouched({
        name: false,
        email: false,
        msg: false,
      });

    } catch (err) {
      setStatus({
        state: "error",
        message:
          err?.message ||
          "Ocurrió un error al enviar. Probá nuevamente en unos minutos.",
      });
    }
  }

  const showErr = (key) => touched[key] && errors[key];

  return (
    <section className="ctc" id="contacto">
      <div className="ctcInner">
        <header className="ctcHeader">
          <h2>Contactanos</h2>
          <p className="ctcSub">
            ¿Tenés una consulta? Escribinos y te respondemos a la brevedad.
          </p>
        </header>

        {status.state !== "idle" ? (
          <div className={`ctcNotice ${status.state}`}>
            {status.message}
          </div>
        ) : null}

        <div className="ctcGrid">
          <form className="ctcForm" onSubmit={submit} noValidate>

            {/* honeypot */}
            <div className="ctcHp">
              <label>
                <span>Company</span>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  autoComplete="off"
                />
              </label>
            </div>

            <label className={`ctcField ${showErr("name") ? "hasError" : ""}`}>
              <span>Nombre</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                placeholder="Juan Pérez"
              />
              {showErr("name") && (
                <small className="ctcErr">{errors.name}</small>
              )}
            </label>

            <label className={`ctcField ${showErr("email") ? "hasError" : ""}`}>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                placeholder="juan@gmail.com"
              />
              {showErr("email") && (
                <small className="ctcErr">{errors.email}</small>
              )}
            </label>

            <label className={`ctcField ${showErr("msg") ? "hasError" : ""}`}>
              <span>Mensaje</span>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, msg: true }))}
                placeholder="Hola! Quería consultar por turnos..."
              />
              {showErr("msg") && (
                <small className="ctcErr">{errors.msg}</small>
              )}
            </label>

            <button
              type="submit"
              className="ctcBtn"
              disabled={status.state === "sending"}
            >
              {status.state === "sending"
                ? "Enviando…"
                : "Enviar mensaje"}
            </button>
          </form>

          <div className="ctcMap">
            <div className="ctcLabelRight">📍 Encontranos en:</div>
            <div className="ctcAddr ctcAddrTop">{address}</div>

            <div className="ctcFrame">
              <iframe
                title="Mapa"
                src={mapSrc}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}