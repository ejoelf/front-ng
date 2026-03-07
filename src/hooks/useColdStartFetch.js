import { useEffect, useRef, useState } from "react";

/**
 * fetcher: función async que retorna data (ej: () => api.get(...).then(r => r.data))
 * options:
 *  - shouldRetry: (data) => boolean. Si devuelve true, sigue reintentando (ej si viene [] vacío)
 *  - delays: array ms para reintentos
 */
export function useColdStartFetch(fetcher, options = {}) {
  const {
    shouldRetry = () => false,
    delays = [0, 1500, 2500, 4000, 6500, 10000, 15000], // ~40s total aprox
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      for (let i = 0; i < delays.length; i++) {
        if (cancelled || !aliveRef.current) return;

        setAttempt(i + 1);

        if (delays[i] > 0) {
          await new Promise((r) => setTimeout(r, delays[i]));
        }

        try {
          const result = await fetcher();
          if (cancelled || !aliveRef.current) return;

          // Si el fetch devolvió data, decidimos si reintentar (por ej. lista vacía)
          if (shouldRetry(result)) {
            continue;
          }

          setData(result);
          setLoading(false);
          return;
        } catch (e) {
          if (cancelled || !aliveRef.current) return;

          const msg =
            e?.response?.data?.error?.message ||
            e?.message ||
            "No se pudo cargar.";
          setError(msg);

          // sigue al próximo intento
        }
      }

      // si llegó acá, agotó reintentos
      setLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // se corre 1 vez

  return { data, loading, attempt, error };
}