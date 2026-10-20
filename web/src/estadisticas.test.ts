import { describe, expect, it } from "vitest";
import type { EjercicioBanco, Sesion } from "./datos";
import {
  ejerciciosHechos, historialEjercicio, musculosHechos, nivelesMusculo, puntosEjercicio, resumenEjercicio,
} from "./estadisticas";

const press: EjercicioBanco = {
  id: "press-banca", nombre: "Press de banca", tipo: "peso", musculos: { pecho: 1, triceps: 0.5 },
  estandares: { H: [0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.3, 1.7], M: [0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 0.85, 1.3] },
};
const lagartijas: EjercicioBanco = { id: "lagartijas", nombre: "Lagartijas", tipo: "corporal", musculos: { pecho: 1 } };
const plancha: EjercicioBanco = { id: "plancha", nombre: "Plancha", tipo: "tiempo", musculos: { abdomen: 1 } };
const banco = [press, lagartijas, plancha];

function sesion(fecha: string, ejercicios: Sesion["ejercicios"]): Sesion {
  return { id: fecha, fecha, origen: "manual", ejercicios };
}
const sesiones: Sesion[] = [
  sesion("2026-10-16", [{ ejercicioId: "press-banca", nombre: "Press de banca", series: [{ reps: 5, peso: 62.5 }, { reps: 6, peso: 60, caidas: [{ reps: 8, peso: 40 }] }] }]),
  sesion("2026-09-01", [
    { ejercicioId: "press-banca", nombre: "Press de banca", series: [{ reps: 8, peso: 55 }, { reps: 8, peso: 55 }] },
    { ejercicioId: "plancha", nombre: "Plancha", series: [{ reps: 45, peso: null }, { reps: 60, peso: null }] },
  ]),
  sesion("2026-09-01", [{ ejercicioId: "lagartijas", nombre: "Lagartijas", series: [{ reps: 15, peso: null }] }]),
];

describe("ejerciciosHechos", () => {
  it("lista lo que hizo, el más reciente primero, con cuántas fechas distintas", () => {
    const h = ejerciciosHechos(sesiones, banco);
    expect(h.map((e) => e.id)).toEqual(["press-banca", "lagartijas", "plancha"]);
    expect(h[0]).toMatchObject({ veces: 2, ultima: "2026-10-16", tipo: "peso" });
  });

  it("un ejercicio que ya no está en el banco sale con su nombre guardado, como de peso", () => {
    const h = ejerciciosHechos([sesion("2026-10-01", [{ ejercicioId: "viejo", nombre: "Viejo", series: [{ reps: 5, peso: 10 }] }])], banco);
    expect(h[0]).toMatchObject({ id: "viejo", nombre: "Viejo", tipo: "peso" });
  });
});

describe("musculosHechos", () => {
  it("solo cuenta los músculos principales (× 1), como el mapa", () => {
    const m = musculosHechos(ejerciciosHechos(sesiones, banco), banco);
    expect(m.map((x) => x.grupo).sort()).toEqual(["abdomen", "pecho"]);
    expect(m.find((x) => x.grupo === "pecho")?.ejercicios.map((e) => e.id)).toEqual(["press-banca", "lagartijas"]);
  });
});

describe("resumenEjercicio", () => {
  it("de peso: suma kg × reps de todas las series, bajadas incluidas, y da la mejor serie por 1RM", () => {
    const r = resumenEjercicio(sesiones, "press-banca", "peso", "2026-10-20");
    expect(r).toMatchObject({ veces: 2, series: 5, reps: 35, pesoMaximo: 62.5, primera: "2026-09-01", ultima: "2026-10-16" });
    // 62.5×5 + 60×6 + 40×8 + 55×8 + 55×8 = 312.5 + 360 + 320 + 880
    expect(r.kgTotales).toBe(1873);
    // 60 × 6 → 72; 62.5 × 5 → 72.9: gana la de 62.5.
    expect(r.mejor).toEqual({ reps: 5, peso: 62.5, fecha: "2026-10-16" });
    expect(r.unoRm).toBe(72.9);
    // Hace 30 días lo mejor era 55 × 8 → 69.7.
    expect(r.cambio30).toBe(3.3);
  });

  it("sin nada de hace más de 30 días no hay cambio que dar", () => {
    expect(resumenEjercicio(sesiones, "press-banca", "peso", "2026-09-20").cambio30).toBeNull();
  });

  it("corporal y de tiempo: sin kg, la mejor es la de más reps o segundos", () => {
    const p = resumenEjercicio(sesiones, "plancha", "tiempo", "2026-10-20");
    expect(p).toMatchObject({ veces: 1, series: 2, reps: 105, kgTotales: 0, unoRm: null });
    expect(p.mejor).toEqual({ reps: 60, peso: null, fecha: "2026-09-01" });
  });

  it("sin datos del ejercicio queda en ceros", () => {
    expect(resumenEjercicio(sesiones, "otro", "peso", "2026-10-20")).toMatchObject({ veces: 0, mejor: null, primera: null });
  });
});

describe("puntosEjercicio", () => {
  it("1RM: el mejor del día, uno por fecha y de la más vieja a la más nueva", () => {
    expect(puntosEjercicio(sesiones, "press-banca", "peso", "1rm")).toEqual([
      { fecha: "2026-09-01", valor: 69.7, etiqueta: "55 kg × 8" },
      { fecha: "2026-10-16", valor: 72.9, etiqueta: "62.5 kg × 5" },
    ]);
  });

  it("sesiones: la serie más pesada del día, tal cual", () => {
    expect(puntosEjercicio(sesiones, "press-banca", "peso", "sesiones").map((p) => p.etiqueta)).toEqual(["55 kg × 8", "62.5 kg × 5"]);
  });

  it("a igual peso gana la de más reps", () => {
    const s = [sesion("2026-10-01", [{ ejercicioId: "press-banca", nombre: "", series: [{ reps: 6, peso: 60 }, { reps: 8, peso: 60 }] }])];
    expect(puntosEjercicio(s, "press-banca", "peso", "sesiones")[0].etiqueta).toBe("60 kg × 8");
  });

  it("de tiempo: los segundos de la serie más larga", () => {
    expect(puntosEjercicio(sesiones, "plancha", "tiempo", "1rm")).toEqual([{ fecha: "2026-09-01", valor: 60, etiqueta: "60 s" }]);
  });
});

describe("historialEjercicio", () => {
  it("cada fecha con todas sus series, la más nueva primero", () => {
    expect(historialEjercicio(sesiones, "press-banca", "peso")).toEqual([
      { fecha: "2026-10-16", series: ["62.5 kg × 5", "60 kg × 6", "40 kg × 8"] },
      { fecha: "2026-09-01", series: ["55 kg × 8", "55 kg × 8"] },
    ]);
  });
});

describe("nivelesMusculo", () => {
  it("da el nivel de cada fecha en que trabajó el músculo, con la ventana de 8 semanas hasta ese día", () => {
    const n = nivelesMusculo(sesiones, banco, "pecho", { sexo: "M", peso: 60, edad: null });
    expect(n.map((p) => p.fecha)).toEqual(["2026-09-01", "2026-10-16"]);
    expect(n[1].valor).toBeGreaterThan(n[0].valor);
  });

  it("un músculo cuyos ejercicios no tienen estándares no tiene nivel", () => {
    expect(nivelesMusculo(sesiones, banco, "abdomen", { sexo: "M", peso: 60, edad: null })).toEqual([]);
  });
});
