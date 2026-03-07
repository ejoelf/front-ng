// seed.js
import logoNG from "../../public/LogoNG.png";
import heroImg from "../../public/Hero.jpeg";

export const seedData = {
  business: {
    id: "biz_1",
    name: "Nico Galicia - Mens Hair Stylist",
    address: "General Paz 16, Las Higueras ,Río Cuarto, Córdoba, Argentina",
    whatsapp: "3585737060",

    // ✅ Landing
    brand: {
      logoUrl: logoNG,
      heroImageUrl: heroImg,
    },

    schedule: {
      openDays: [2, 3, 4, 5, 6], // Mar..Sáb
      intervals: [
        { start: "09:00", end: "12:30" },
        { start: "16:00", end: "20:30" },
      ],
      stepMinutes: 10,
      bufferMin: 0,
    },

    specialDays: [],
  },

  staff: [
    {
      id: "st_1",

      // ✅ Compat (por si en algún lado todavía usan name)
      name: "Nicolás Galicia",

      // ✅ Nuevos campos Settings
      firstName: "Nicolás",
      lastName: "Galicia",
      age: "",
      birthday: "",
      phone: "",
      dni: "",
      address: "",

      skills: ["corte", "barba", "color", "reflejos"],
      scheduleOverride: null,

      // ✅ Landing
      role: "Propietario, estilista y colorista",
      bio: "Con años de trayectoria y una ética de trabajo impecable. Confianza, estilo y pasión en cada corte.",
      photoUrl: "",
      isOwner: true,
    },

    {
      id: "st_2",
      name: "Fernando",
      firstName: "Fernando",
      lastName: "",
      age: "",
      birthday: "",
      phone: "",
      dni: "",
      address: "",

      skills: ["corte", "barba"],
      scheduleOverride: null,

      role: "Barbero y estilista",
      bio: "Especialista en barba y cortes clásicos/modernos. Atención al detalle y prolijidad.",
      photoUrl: "",
      isOwner: false,
    },
  ],

  services: [
    {
      id: "sv_1",
      code: "corte",
      name: "Corte",
      durationMin: 30,
      price: 13000,
      allowedStaffIds: ["st_1", "st_2"],
      imageUrl: "", // ✅ editable/subible luego
    },
    {
      id: "sv_2",
      code: "combo",
      name: "Corte + Barba",
      durationMin: 50,
      price: 16000,
      allowedStaffIds: ["st_1", "st_2"],
      imageUrl: "",
    },
    {
      id: "sv_3",
      code: "barba",
      name: "Barba",
      durationMin: 30,
      price: 12000,
      allowedStaffIds: ["st_1", "st_2"],
      imageUrl: "",
    },
    {
      id: "sv_4",
      code: "color",
      name: "Color",
      durationMin: 60,
      price: 25000,
      allowedStaffIds: ["st_1"],
      imageUrl: "",
    },
  ],

  blocks: [],
  recurringBlocks: [],
  appointments: [],
  clients: [],
  incomes: [],
};
