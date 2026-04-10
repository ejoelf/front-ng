import "./Login.css";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { useMemo, useState } from "react";
import { login } from "../../store/authStore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();

  const [username, setUsername] = useState("nico");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      String(username || "").trim().length > 0 &&
      String(password || "").trim().length > 0
    );
  }, [username, password]);

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;

    const u = String(username || "").trim();
    const p = String(password || "").trim();

    if (!u || !p) {
      setError("Completá usuario y contraseña.");
      return;
    }

    setLoading(true);
    setError("");

    const res = await login({ username: u, password: p });

    if (!res.ok) {
      setError(res.message || "Credenciales inválidas.");
      setLoading(false);
      return;
    }

    setLoading(false);
    nav("/admin/dashboard", { replace: true });
  }

  return (
    <div className="loginWrap">
      <div className="loginBgGlow loginBgGlowOne" />
      <div className="loginBgGlow loginBgGlowTwo" />

      <form className="loginCard card" onSubmit={onSubmit}>
        <div className="loginTop">
          <div className="loginBadge">Panel interno</div>

          <div className="loginBrand">
            <div className="loginLogo">NG</div>

            <div className="loginHeadText">
              <h2>Bienvenido</h2>
              <p className="muted loginSub">
                Ingresá al panel de administración de Peluquería NG.
              </p>
            </div>
          </div>
        </div>

        <div className="loginFields">
          <Input
            label="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="usuario"
          />

          <div className="inputIconWrap">
            <Input
              label="Contraseña"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <button
              type="button"
              className="eyeBtn"
              onClick={() => setShowPass((x) => !x)}
              aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPass ? "Ocultar" : "Mostrar"}
            >
              {showPass ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6.61 6.61C4.2 8.17 2.7 10.2 2 12c1.3 3.4 5 7 10 7 1.5 0 2.9-.3 4.1-.8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M17.4 17.4C19.4 15.9 20.7 14 21.1 12c-1.3-3.4-5-7-10-7-1.2 0-2.4.2-3.4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M3 3l18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error ? (
          <div className="loginError" role="alert" aria-live="polite">
            <div className="loginErrorDot" />
            <div>{error}</div>
          </div>
        ) : null}

        <div className="loginActions">
          <Button type="submit" disabled={!canSubmit || loading}>
            {loading ? "Entrando..." : "Entrar al panel"}
          </Button>

          <div className="loginFoot muted">
            Las credenciales del panel se administran desde{" "}
            <b>Ajustes → Usuario</b>.
          </div>
        </div>
      </form>
    </div>
  );
}