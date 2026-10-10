import { describe, expect, it } from "vitest";
import { NOMBRES_MUSCULO, nombreMusculo, percentilDe, rangoDe } from "./fuerza";
import frenteH from "../public/mapa-muscular-frente.svg?raw";
import espaldaH from "../public/mapa-muscular-espalda.svg?raw";
import frenteM from "../public/mapa-muscular-frente-mujer.svg?raw";
import espaldaM from "../public/mapa-muscular-espalda-mujer.svg?raw";

describe("rangoDe", () => {
  it("cada rango empieza al alcanzar su estándar", () => {
    expect(rangoDe(0).nombre).toBe("Principiante");
    expect(rangoDe(1).nombre).toBe("Principiante");
    expect(rangoDe(1.99).nombre).toBe("Principiante");
    expect(rangoDe(2).nombre).toBe("Novato");
    expect(rangoDe(3.5).nombre).toBe("Intermedio");
    expect(rangoDe(4).nombre).toBe("Avanzado");
    expect(rangoDe(4.99).nombre).toBe("Avanzado");
    expect(rangoDe(5).nombre).toBe("Élite");
  });

  it("fuera de la escala se queda en sus orillas", () => {
    expect(rangoDe(-3).nombre).toBe("Principiante");
    expect(rangoDe(9).nombre).toBe("Élite");
  });
});

describe("percentilDe (contra toda la población)", () => {
  it("en cada estándar da su porcentaje", () => {
    expect([0, 1, 2, 3, 4, 5].map(percentilDe)).toEqual([1, 50, 78, 88, 95, 99]);
  });

  it("el estándar de Principiante es el promedio: la mitad de la población", () => {
    expect(percentilDe(1)).toBe(50);
  });

  it("por debajo del promedio también se puede quedar", () => {
    expect(percentilDe(0.5)).toBeLessThan(50);
  });

  it("entre estándares interpola", () => {
    expect(percentilDe(2.5)).toBe(83);
  });

  it("nunca 0 % ni 100 %", () => {
    expect(percentilDe(-1)).toBe(1);
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
