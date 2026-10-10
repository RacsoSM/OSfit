import { describe, expect, it } from "vitest";
import { NOMBRES_MUSCULO, nombreMusculo, percentilDe, rangoDe } from "./fuerza";
import frenteH from "../public/mapa-muscular-frente.svg?raw";
import espaldaH from "../public/mapa-muscular-espalda.svg?raw";
import frenteM from "../public/mapa-muscular-frente-mujer.svg?raw";
import espaldaM from "../public/mapa-muscular-espalda-mujer.svg?raw";

describe("rangoDe", () => {
  it("cada corte abre su rango", () => {
    expect(rangoDe(0).nombre).toBe("Principiante");
    expect(rangoDe(0.99).nombre).toBe("Principiante");
    expect(rangoDe(1).nombre).toBe("Novato");
    expect(rangoDe(2.5).nombre).toBe("Intermedio");
    expect(rangoDe(3).nombre).toBe("Avanzado");
    expect(rangoDe(4).nombre).toBe("Élite");
    expect(rangoDe(5).nombre).toBe("Élite");
  });

  it("fuera de la escala se queda en sus orillas", () => {
    expect(rangoDe(-3).nombre).toBe("Principiante");
    expect(rangoDe(9).nombre).toBe("Élite");
  });
});

describe("percentilDe", () => {
  it("en los cortes da los porcentajes de las tablas", () => {
    expect([0, 1, 2, 3, 4, 5].map(percentilDe)).toEqual([5, 20, 50, 80, 95, 99]);
  });

  it("entre cortes interpola", () => {
    expect(percentilDe(2.5)).toBe(65);
  });

  it("nunca 0 % ni 100 %", () => {
    expect(percentilDe(-1)).toBe(5);
    expect(percentilDe(99)).toBe(99);
  });

  it("sube siempre con el nivel", () => {
    for (let n = 0; n < 5; n += 0.25) expect(percentilDe(n + 0.25)).toBeGreaterThanOrEqual(percentilDe(n));
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
