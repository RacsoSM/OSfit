import { describe, expect, it } from "vitest";
import {
  ejerciciosDe, ganaEjercicio, musculosEnComun, resolverBatalla, textoResultado, textoSerie, valorDe,
  type DatosBatalla, type EjercicioBatalla,
} from "./batalla";

const ej = (id: string, musculos: string[], pa: number, pb: number, campos: Partial<EjercicioBatalla> = {}): EjercicioBatalla => ({
  id, nombre: id, tipo: "peso", musculos, pesoPorMancuerna: false,
  a: { reps: 10, peso: 40, unoRm: 53.3, puntaje: pa },
  b: { reps: 8, peso: 50, unoRm: 63.3, puntaje: pb },
  ...campos,
});
const datos = (ejercicios: EjercicioBatalla[]): DatosBatalla => ({
  a: { nombre: "Said", sexo: "H" }, b: { nombre: "Bogue", sexo: "H" }, ejercicios,
});

describe("ganaEjercicio", () => {
  it("gana el puntaje más alto; a menos de 0.5 % es empate", () => {
    expect(ganaEjercicio(ej("x", [], 0.8, 0.7))).toBe("a");
    expect(ganaEjercicio(ej("x", [], 0.7, 0.8))).toBe("b");
    expect(ganaEjercicio(ej("x", [], 0.8, 0.798))).toBeNull();
  });
});

describe("Modo real", () => {
  it("compara los kilos del 1RM tal cual, sin el peso corporal", () => {
    // a: 53.3 kg de 1RM pero más para su peso; b: 63.3 kg.
    const e = ej("x", [], 0.9, 0.7);
    expect(ganaEjercicio(e)).toBe("a");
    expect(ganaEjercicio(e, "real")).toBe("b");
    expect(valorDe(e, e.b, "real")).toBe(63.3);
  });

  it("en los que no son de peso cuenta reps o segundos", () => {
    const e = ej("x", [], 0.9, 0.7, { tipo: "corporal", a: { reps: 20, peso: null, unoRm: null, puntaje: 0.9 }, b: { reps: 25, peso: null, unoRm: null, puntaje: 0.7 } });
    expect(ganaEjercicio(e, "real")).toBe("b");
  });

  it("el resultado y su margen usan el modo", () => {
    const r = resolverBatalla([ej("x", [], 0.9, 0.7)], "real");
    expect(r.ganador).toBe("b");
    // 63.3 / 53.3 − 1 = 19 %: con claridad.
    expect(r.margen).toBe("clara");
  });
});

describe("resolverBatalla", () => {
  it("Said gana 2 y Bogue 3: Bogue gana por una diferencia mínima", () => {
    const d = datos([
      ej("p1", ["pecho"], 0.9, 0.5), ej("p2", ["pecho"], 0.9, 0.5),
      ej("p3", ["pecho"], 0.5, 0.9), ej("p4", ["pecho"], 0.5, 0.9), ej("p5", ["pecho"], 0.5, 0.9),
    ]);
    const r = resolverBatalla(ejerciciosDe(d, { modo: "musculo", musculo: "pecho" }));
    expect(r.victorias).toEqual({ a: 2, b: 3 });
    expect(r.ganador).toBe("b");
    expect(r.margen).toBe("minima");
    expect(textoResultado(r, d)).toEqual({ titulo: "¡Bogue ganó la batalla!", detalle: "2 a 3, por una diferencia mínima.", como: "por una diferencia mínima" });
  });

  it("3 a 0 es aplastante; 4 a 1, con claridad; parejos, empate", () => {
    expect(resolverBatalla([ej("a", [], 1, 0.5), ej("b", [], 1, 0.5), ej("c", [], 1, 0.5)]).margen).toBe("aplastante");
    const clara = resolverBatalla([ej("a", [], 1, 0.5), ej("b", [], 1, 0.5), ej("c", [], 1, 0.5), ej("d", [], 1, 0.5), ej("e", [], 0.5, 1)]);
    expect([clara.ganador, clara.margen]).toEqual(["a", "clara"]);
    expect(textoResultado(clara, datos([])).titulo).toBe("¡Ganaste la batalla!");
    const empate = resolverBatalla([ej("a", [], 1, 0.5), ej("b", [], 0.5, 1)]);
    expect([empate.ganador, textoResultado(empate, datos([])).titulo]).toEqual([null, "¡Empate!"]);
  });

  it("con un solo ejercicio el margen sale de cuánto más levantó", () => {
    expect(resolverBatalla([ej("a", [], 1.03, 1)]).margen).toBe("minima");
    expect(resolverBatalla([ej("a", [], 1.15, 1)]).margen).toBe("clara");
    expect(resolverBatalla([ej("a", [], 1.6, 1)]).margen).toBe("aplastante");
    expect(textoResultado(resolverBatalla([ej("a", [], 1.6, 1)]), datos([])).detalle).toBe("de forma aplastante.");
  });
});

describe("qué entra", () => {
  const d = datos([ej("press", ["pecho"], 1, 1), ej("aperturas", ["pecho"], 1, 1), ej("curl", ["biceps"], 1, 1)]);
  it("los músculos con ejercicios en común, en el orden del mapa", () => {
    expect(musculosEnComun(d)).toEqual([{ musculo: "pecho", ejercicios: 2 }, { musculo: "biceps", ejercicios: 1 }]);
  });
  it("por ejercicio, solo ese; todo, todos", () => {
    expect(ejerciciosDe(d, { modo: "ejercicio", ejercicio: "curl" }).map((e) => e.id)).toEqual(["curl"]);
    expect(ejerciciosDe(d, { modo: "todo" })).toHaveLength(3);
  });
});

describe("textoSerie", () => {
  it("peso, reps o segundos", () => {
    const e = ej("x", [], 1, 1);
    expect(textoSerie(e, e.a)).toBe("40 kg × 10");
    expect(textoSerie({ ...e, tipo: "corporal" }, { reps: 1, peso: null, unoRm: null, puntaje: 1 })).toBe("1 rep");
    expect(textoSerie({ ...e, tipo: "tiempo" }, { reps: 60, peso: null, unoRm: null, puntaje: 60 })).toBe("60 s");
  });
});
