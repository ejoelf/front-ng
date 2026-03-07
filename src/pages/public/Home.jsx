// src/pages/Home/Home.jsx
import "./Home.css";
import { useEffect, useRef, useState } from "react";

import api from "../../services/http";

import HeroSection from "../../components/public/sections/HeroSection";
import ServicesSection from "../../components/public/sections/ServicesSection";
import TeamSection from "../../components/public/sections/TeamSection";
import ContactSection from "../../components/public/sections/ContactSection";
import PublicLoader from "../../components/public/PublicLoader";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function Home() {
  const [business, setBusiness] = useState(null);

  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);

  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const [attemptServices, setAttemptServices] = useState(0);
  const [attemptStaff, setAttemptStaff] = useState(0);

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Traemos business 1 vez (si falla no pasa nada, Hero tiene fallback)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("/public/business");
        if (cancelled || !aliveRef.current) return;
        setBusiness(res?.data?.business ?? null);
      } catch {
        if (cancelled || !aliveRef.current) return;
        setBusiness(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ Servicios con reintentos (para cold start)
  useEffect(() => {
    let cancelled = false;

    const delays = [0, 1500, 2500, 4000, 6500, 10000, 15000]; // ~40s total

    (async () => {
      setLoadingServices(true);

      for (let i = 0; i < delays.length; i++) {
        if (cancelled || !aliveRef.current) return;

        setAttemptServices(i + 1);
        if (delays[i] > 0) await sleep(delays[i]);

        try {
          const res = await api.get("/public/services");
          if (cancelled || !aliveRef.current) return;

          const rows = Array.isArray(res?.data?.services) ? res.data.services : [];

          // si viene vacío, probablemente el back recién despertó / seed / etc -> reintenta
          if (rows.length === 0) {
            continue;
          }

          setServices(rows);
          setLoadingServices(false);
          return;
        } catch {
          // sigue intentando
        }
      }

      // agotó intentos: dejamos vacío y apagamos loader
      if (cancelled || !aliveRef.current) return;
      setServices([]);
      setLoadingServices(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ Staff con reintentos (para cold start)
  useEffect(() => {
    let cancelled = false;

    const delays = [0, 1500, 2500, 4000, 6500, 10000, 15000];

    (async () => {
      setLoadingStaff(true);

      for (let i = 0; i < delays.length; i++) {
        if (cancelled || !aliveRef.current) return;

        setAttemptStaff(i + 1);
        if (delays[i] > 0) await sleep(delays[i]);

        try {
          const res = await api.get("/public/staff");
          if (cancelled || !aliveRef.current) return;

          const rows = Array.isArray(res?.data?.staff) ? res.data.staff : [];

          if (rows.length === 0) {
            continue;
          }

          setStaff(rows);
          setLoadingStaff(false);
          return;
        } catch {
          // sigue intentando
        }
      }

      if (cancelled || !aliveRef.current) return;
      setStaff([]);
      setLoadingStaff(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home">
      <div id="inicio" />
      <HeroSection business={business} />

      <div id="servicios" />
      {loadingServices ? (
        <div style={{ padding: "0 0 18px 0" }}>
          <PublicLoader
            title="Aguarde un momento…"
            subtitle={`Estamos cargando nuestros servicios. (Intento ${attemptServices})`}
          />
        </div>
      ) : (
        <ServicesSection services={services} />
      )}

      <div id="equipo" />
      {loadingStaff ? (
        <div style={{ padding: "0 0 18px 0" }}>
          <PublicLoader
            title="Aguarde un momento…"
            subtitle={`Estamos cargando nuestro equipo. (Intento ${attemptStaff})`}
          />
        </div>
      ) : (
        <TeamSection staff={staff} />
      )}

      <div id="contacto" />
      <ContactSection business={business} />
    </div>
  );
}