import { describe, expect, it } from "vitest";
import { ANCHO_BARRA, IMPULSO, PISO, RADIO, aletear, avanzar, choca, hueco, nuevoVuelo, salto, velocidad } from "./kettlebellBird";

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
    w.y = b.centro - b.hueco / 2 - 1; w.x = b.x + ANCHO_BARRA / 2; w.vy = 0;
    expect(avanzar(w, 0.001)).toBe("fin");
  });

  it("se pone difícil: más rápido, hueco más chico y alturas más cambiantes, con topes", () => {
    expect(velocidad(20)).toBeGreaterThan(velocidad(0));
    expect(velocidad(999)).toBe(56);
    expect(hueco(30)).toBeLessThan(hueco(0));
    expect(hueco(999)).toBe(23);
    expect(salto(20)).toBeGreaterThan(salto(0));
    expect(salto(999)).toBe(34);
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

  it("choca: círculo contra rectángulo", () => {
    expect(choca(5, 5, 2, 6, 0, 4, 10)).toBe(true);
    expect(choca(0, 5, 2, 6, 0, 4, 10)).toBe(false);
  });
});
