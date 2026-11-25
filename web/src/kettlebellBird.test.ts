import { describe, expect, it } from "vitest";
import { NIVELES, POR_NIVEL, nivel, separacion, ANCHO_DISCO, ANCHO_TUBO, DISCO_HASTA, IMPULSO, PISO, RADIO, aletear, avanzar, choca, chocaConBarra, hueco, nuevoVuelo, salto, velocidad } from "./kettlebellBird";

const fijo = () => 0.5; // el hueco siempre a media altura

describe("Kettlebell Bird", () => {
  it("cae por su peso y el toque la sube", () => {
    const v = nuevoVuelo(60, fijo);
    const y0 = v.y;
    for (let i = 0; i < 40; i++) avanzar(v, 0.016);
    expect(v.y).toBeGreaterThan(y0);
    aletear(v);
    expect(v.vy).toBe(IMPULSO);
  });

  it("tocar el piso termina; el techo solo la detiene", () => {
    const v = nuevoVuelo(60, fijo);
    let fin = null;
    for (let i = 0; i < 400 && !fin; i++) fin = avanzar(v, 0.016);
    expect(fin).toBe("fin");
    expect(v.y + RADIO).toBeCloseTo(PISO);
    const w = nuevoVuelo(60, fijo);
    w.y = 4; w.vy = -100;
    expect(avanzar(w, 0.05)).not.toBe("fin");
    expect(w.y).toBeGreaterThanOrEqual(RADIO);
  });

  it("pasar por el hueco suma un punto por barra; chocar con una barra termina", () => {
    const v = nuevoVuelo(60, fijo);
    let puntos = 0;
    // Vuela a la altura del hueco: aletea cada que baja de él.
    for (let i = 0; i < 2000 && puntos < 3; i++) {
      const b = v.barras.find((x) => !x.pasada)!;
      if (v.y > b.centro + 2 && v.vy > 0) aletear(v);
      expect(avanzar(v, 0.016)).not.toBe("fin");
      puntos = v.puntos;
    }
    expect(puntos).toBe(3);
    const w = nuevoVuelo(60, fijo);
    const b = w.barras[0]!;
    w.y = b.centro - b.hueco / 2 - 1; w.x = b.x + ANCHO_DISCO / 2; w.vy = 0;
    expect(avanzar(w, 0.001)).toBe("fin");
  });

  it("se pone difícil: más rápido, hueco más chico y alturas más cambiantes, con topes", () => {
    expect(velocidad(20)).toBeGreaterThan(velocidad(0));
    expect(velocidad(999)).toBe(64);
    expect(hueco(30)).toBeLessThan(hueco(0));
    expect(hueco(999)).toBe(23);
    expect(salto(20)).toBeGreaterThan(salto(0));
    expect(salto(999)).toBe(34);
  });

  it("cada 8 barras sube de nivel (hasta el 6): más juntas y más rápido", () => {
    expect([0, 7, 8, 16, 40, 200].map(nivel)).toEqual([1, 1, 2, 3, 6, NIVELES]);
    expect(separacion(POR_NIVEL)).toBeLessThan(separacion(0));
    expect(separacion(999)).toBe(30);
    // El salto de velocidad al pasar de nivel es mayor que el de una barra cualquiera.
    expect(velocidad(8) - velocidad(7)).toBeGreaterThan(velocidad(7) - velocidad(6));
  });

  it("los huecos siempre quedan entre el techo y el piso", () => {
    let k = 0;
    const azar = () => [0, 1, 0, 1, 0.9, 0.1][k++ % 6]!;
    const v = nuevoVuelo(60, azar);
    v.puntos = 60;
    for (let i = 0; i < 3000; i++) {
      v.y = 40; v.vy = 0; v.terminada = false;
      avanzar(v, 0.016);
      for (const b of v.barras) {
        expect(b.centro - b.hueco / 2).toBeGreaterThanOrEqual(10 - 1e-9);
        expect(b.centro + b.hueco / 2).toBeLessThanOrEqual(PISO - 8 + 1e-9);
      }
    }
  });

  it("se choca con lo que se ve: el disco ancho cerca de la orilla, la barra delgada en el resto", () => {
    const b = { x: 20, centro: 50, hueco: 30, pasada: false, n: 1 };
    const arriba = b.centro - b.hueco / 2;
    // Junto a la barra, lejos del disco: no toca (antes la caja era del ancho del disco en todo el largo).
    expect(chocaConBarra(b.x + 1, arriba - 12, 2, b)).toBe(false);
    // Sobre la barra misma: toca.
    expect(chocaConBarra(b.x + ANCHO_DISCO / 2, arriba - 12, 1, b)).toBe(true);
    // Al lado del eje pero a la altura del disco: toca.
    expect(chocaConBarra(b.x + ANCHO_DISCO / 2 - ANCHO_TUBO * 2, arriba - DISCO_HASTA / 2, 1, b)).toBe(true);
    // En el hueco: libre.
    expect(chocaConBarra(b.x + ANCHO_DISCO / 2, b.centro, 3.6, b)).toBe(false);
  });

  it("las barras van numeradas en orden, para poner las marcas de los records", () => {
    const v = nuevoVuelo(60, fijo);
    for (let i = 0; i < 600; i++) { v.y = 40; v.vy = 0; v.terminada = false; avanzar(v, 0.016); }
    const ns = v.barras.map((b) => b.n);
    expect(ns[0]).toBeGreaterThan(1);
    ns.forEach((n, i) => { if (i > 0) expect(n).toBe(ns[i - 1]! + 1); });
  });

  it("choca: círculo contra rectángulo", () => {
    expect(choca(5, 5, 2, 6, 0, 4, 10)).toBe(true);
    expect(choca(0, 5, 2, 6, 0, 4, 10)).toBe(false);
  });
});
