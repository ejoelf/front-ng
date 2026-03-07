import "./Toast.css";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (opts) => {
      const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
      const toast = {
        id,
        title: opts?.title || "",
        message: opts?.message || "",
        type: opts?.type || "info", // info | success | error | warning
        duration: Number.isFinite(opts?.duration) ? opts.duration : 3000,
      };

      setItems((prev) => [...prev, toast]);

      // auto close
      window.setTimeout(() => remove(id), toast.duration);

      return id;
    },
    [remove]
  );

  // ✅ Bridge: para poder usar toast desde cualquier archivo (sin hooks)
  useEffect(() => {
    window.__toastShow = show;
    return () => {
      if (window.__toastShow === show) delete window.__toastShow;
    };
  }, [show]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastCtx.Provider value={api}>
      {children}

      <div className="toastWrap" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div key={t.id} className={`toastItem toast-${t.type}`}>
            <div className="toastContent">
              {t.title ? <div className="toastTitle">{t.title}</div> : null}
              {t.message ? <div className="toastMsg">{t.message}</div> : null}
            </div>

            <button
              className="toastClose"
              onClick={() => remove(t.id)}
              type="button"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast() debe usarse dentro de <ToastProvider>");
  return ctx;
}
