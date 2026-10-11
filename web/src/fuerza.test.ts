import { describe, expect, it } from "vitest";
import {
  NOMBRES_MUSCULO, fuerzaPorMusculo, nivelDe, nombreMusculo, nombreRango, percentilDe,
  percentilEntrenanDe, rangoDe, unoRm,
} from "./fuerza";
import type { EjercicioBanco, Sesion } from "./datos";
import frenteH from "../public/mapa-muscular-frente.svg?raw";
import espaldaH from "../public/mapa-muscular-espalda.svg?raw";
import frenteM from "../public/mapa-muscular-frente-mujer.svg?raw";
import espaldaM from "../public/mapa-muscular-espalda-mujer.svg?raw";

describe("rangoDe", () => {
  it("cada rango empieza al alcanzar su estándar", () => {
    expect(rangoDe(0).nombre).toBe("Principiante");
    expect(rangoDe(1.99).nombre).toBe("Principiante");
    expect(rangoDe(2).nombre).toBe("Novato");
    expect(rangoDe(3).nombre).toBe("En forma");
    expect(rangoDe(4.5).nombre).toBe("Intermedio");
    expect(rangoDe(5).nombre).toBe("Atlético");
    expect(rangoDe(6).nombre).toBe("Fuerte");
    expect(rangoDe(7.99).nombre).toBe("Avanzado");
    expect(rangoDe(8).nombre).toBe("Élite");
  });

  it("fuera de la escala se queda en sus orillas", () => {
    expect(rangoDe(-3).nombre).toBe("Principiante");
    expect(rangoDe(12).nombre).toBe("Élite");
  });
});

describe("nombreRango", () => {
  it("Atlético va en femenino para ellas; los demás no cambian", () => {
    expect(nombreRango(5, "M")).toBe("Atlética");
    expect(nombreRango(5, "H")).toBe("Atlético");
    expect(nombreRango(8, "M")).toBe("Élite");
  });
});

describe("percentilDe (contra toda la población)", () => {
  it("en cada estándar da su porcentaje", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(percentilDe)).toEqual([1, 50, 65, 78, 83, 88, 92, 95, 99]);
  });

  it("el estándar de Principiante es el promedio: la mitad de la población", () => {
    expect(percentilDe(1)).toBe(50);
  });

  it("entre estándares interpola", () => {
    expect(percentilDe(5.5)).toBe(90);
  });

  it("nunca 0 % ni 100 %", () => {
    expect(percentilDe(-1)).toBe(1);
    expect(percentilDe(99)).toBe(99);
  });

  it("sube siempre con el nivel", () => {
    for (let n = 0; n < 8; n += 0.25) expect(percentilDe(n + 0.25)).toBeGreaterThanOrEqual(percentilDe(n));
  });
});

describe("percentilEntrenanDe (contra quienes entrenan)", () => {
  it("en cada estándar da su porcentaje", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(percentilEntrenanDe)).toEqual([1, 5, 12, 20, 35, 50, 65, 80, 95]);
  });

  it("siempre por debajo del de toda la población", () => {
    for (let n = 0.5; n <= 8; n += 0.5) expect(percentilEntrenanDe(n)).toBeLessThan(percentilDe(n));
  });
});

describe("unoRm", () => {
  it("Epley: 40 kg × 8 ≈ 50.7 kg", () => {
    expect(unoRm(40, 8)).toBeCloseTo(50.67, 1);
  });

  it("con 1 repetición es el peso tal cual", () => {
    expect(unoRm(100, 1)).toBe(100);
  });

  it("las reps se topan en 12", () => {
    expect(unoRm(20, 30)).toBe(unoRm(20, 12));
  });
});

describe("nivelDe", () => {
  const e = [1, 2, 3, 4, 5, 6, 7, 8];

  it("en cada estándar da su nivel, y en medio, en proporción", () => {
    expect(nivelDe(1, e)).toBe(1);
    expect(nivelDe(4, e)).toBe(4);
    expect(nivelDe(4.5, e)).toBe(4.5);
  });

  it("por debajo del primero va desde 0", () => {
    expect(nivelDe(0.5, e)).toBe(0.5);
    expect(nivelDe(0, e)).toBe(0);
  });

  it("arriba del último se queda en 8", () => {
    expect(nivelDe(20, e)).toBe(8);
  });
});

describe("fuerzaPorMusculo", () => {
  const banca: EjercicioBanco = {
    id: "press-banca", nombre: "Press de banca", tipo: "peso",
    musculos: { pecho: 1, triceps: 0.5 },
    estandares: { H: [0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.3, 1.7], M: [0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 0.85, 1.3] },
  };
  const lagartijas: EjercicioBanco = {
    id: "lagartijas", nombre: "Lagartijas", tipo: "corporal",
    musculos: { pecho: 1, abdomen: 0.5 },
    estandares: { H: [3, 9, 15, 22, 30, 34, 38, 55], M: [1, 3, 5, 10, 15, 18, 20, 34] },
  };
  const plancha: EjercicioBanco = {
    id: "plancha", nombre: "Plancha", tipo: "tiempo", musculos: { abdomen: 1 },
  };
  const banco = [banca, lagartijas, plancha];
  const sesion = (fecha: string, ejercicios: Sesion["ejercicios"]): Sesion =>
    ({ id: fecha, fecha, origen: "manual", ejercicios });

  it("el mejor 1RM entre su peso, contra los estándares de su sexo", () => {
    // 60 kg × 1 = 60 kg de 1RM; ÷ 75 kg = 0.8 → entre 0.75 (nivel 3) y 0.9 (nivel 4).
    const f = fuerzaPorMusculo(
      [sesion("2026-10-10", [{ ejercicioId: "press-banca", nombre: "", series: [
        { reps: 1, peso: 60 }, { reps: 5, peso: 40 },
      ] }])],
      banco, "H", 75, "2026-10-11"
    );
    expect(f.pecho.nivel).toBeCloseTo(3 + 0.05 / 0.15, 5);
    expect(f.triceps.nivel).toBeCloseTo(f.pecho.nivel / 2, 5);
  });

  it("por músculo se queda con el máximo de sus ejercicios", () => {
    const f = fuerzaPorMusculo(
      [sesion("2026-10-10", [
        { ejercicioId: "press-banca", nombre: "", series: [{ reps: 1, peso: 15 }] },
        { ejercicioId: "lagartijas", nombre: "", series: [{ reps: 15, peso: null }] },
      ])],
      banco, "M", 60, "2026-10-11"
    );
    expect(f.pecho.nivel).toBe(5);
    expect(f.abdomen.nivel).toBe(2.5);
  });

  it("solo cuentan las últimas 8 semanas", () => {
    const vieja = sesion("2026-08-01", [{ ejercicioId: "press-banca", nombre: "", series: [{ reps: 1, peso: 100 }] }]);
    expect(fuerzaPorMusculo([vieja], banco, "H", 75, "2026-10-11")).toEqual({});
  });

  it("sin datos no aparece: los de tiempo, sin estándar o desconocidos no pintan", () => {
    const f = fuerzaPorMusculo(
      [sesion("2026-10-10", [
        { ejercicioId: "plancha", nombre: "", series: [{ reps: 60, peso: null }] },
        { ejercicioId: "nada", nombre: "", series: [{ reps: 10, peso: 50 }] },
      ])],
      banco, "H", 75, "2026-10-11"
    );
    expect(f).toEqual({});
  });

  it("sin peso corporal no hay nada que medir", () => {
    const s = sesion("2026-10-10", [{ ejercicioId: "press-banca", nombre: "", series: [{ reps: 1, peso: 60 }] }]);
    expect(fuerzaPorMusculo([s], banco, "H", 0, "2026-10-11")).toEqual({});
  });
});

describe("nombreMusculo", () => {
  it("todo grupo de los cuatro mapas tiene nombre", () => {
    const grupos = new Set(
      [frenteH, espaldaH, frenteM, espaldaM].flatMap((s) =>
        [...s.matchAll(/data-musculo="([^"]+)"/g)].map((m) => m[1]))
    );
    for (const g of grupos) expect(NOMBRES_MUSCULO[g], g).toBeTruthy();
  });

  it("uno desconocido se muestra tal cual", () => {
    expect(nombreMusculo("nada")).toBe("nada");
  });
});
