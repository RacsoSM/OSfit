import { describe, expect, it } from "vitest";
import {
  ANCHO_INICIAL, DESDE_LADOS, DESDE_ONDULADO, TOLERANCIA_PERFECTO, avanzar, nuevaPartida, pesoDe, soltar, velocidad, type Partida,
} from "./juegoDiscos";

/** Pone el disco móvil en `x` (relativo a la torre) y lo suelta. */
function soltarEn(p: Partida, desplazamiento: number) {
  const tope = p.torre[p.torre.length - 1]!;
  p.movil.x = tope.x + desplazamiento;
  return soltar(p);
}

describe("Torre de discos", () => {
  it("arranca con la base de 60 y el primer disco entrando por la izquierda", () => {
    const p = nuevaPartida();
    expect(p.torre).toHaveLength(1);
    expect(p.torre[0]!.ancho).toBe(ANCHO_INICIAL);
    expect(p.movil.dir).toBe(1);
    expect(p.movil.x).toBeLessThan(0);
  });

  it("lo que sobresale se corta: el siguiente disco sale más angosto", () => {
    const p = nuevaPartida();
    const r = soltarEn(p, 10);
    expect(r.tipo).toBe("corte");
    expect(p.torre[1]!.ancho).toBeCloseTo(50);
    expect(p.movil.ancho).toBeCloseTo(50);
    if (r.tipo === "corte") expect(r.cortado.ancho).toBeCloseTo(10);
    expect(p.puntos).toBe(1);
  });

  it("casi exacto es perfecto: no corta y vale doble", () => {
    const p = nuevaPartida();
    expect(soltarEn(p, TOLERANCIA_PERFECTO - 0.1).tipo).toBe("perfecto");
    expect(p.torre[1]!.ancho).toBe(ANCHO_INICIAL);
    expect(p.puntos).toBe(2);
  });

  it("cuatro perfectos seguidos devuelven ancho, sin pasar del inicial", () => {
    const p = nuevaPartida();
    soltarEn(p, 20); // queda de 40
    for (let i = 0; i < 3; i++) expect(soltarEn(p, 0)).toEqual({ tipo: "perfecto", crecio: false });
    expect(soltarEn(p, 0)).toEqual({ tipo: "perfecto", crecio: true });
    expect(p.torre.at(-1)!.ancho).toBeCloseTo(44);
  });

  it("si no toca la torre, se acaba", () => {
    const p = nuevaPartida();
    const r = soltarEn(p, ANCHO_INICIAL + 1);
    expect(r.tipo).toBe("fallo");
    expect(p.terminada).toBe(true);
    avanzar(p, 1);
    expect(p.torre).toHaveLength(1);
  });

  it("se pone difícil: más rápido, desde ambos lados y luego ondulado", () => {
    expect(velocidad(10)).toBeGreaterThan(velocidad(0));
    expect(velocidad(500)).toBe(150);
    const p = nuevaPartida();
    for (let i = 0; i < DESDE_LADOS; i++) soltarEn(p, 0);
    expect(p.movil.dir).toBe(1);
    soltarEn(p, 0);
    expect(p.movil.dir).toBe(-1);
    for (let i = p.apilados; i < DESDE_ONDULADO; i++) soltarEn(p, 0);
    // Ondulado: dos tramos iguales de tiempo no avanzan lo mismo.
    const x0 = p.movil.x; avanzar(p, 0.1); const a = Math.abs(p.movil.x - x0);
    const x1 = p.movil.x; avanzar(p, 0.1); const b = Math.abs(p.movil.x - x1);
    expect(Math.abs(a - b)).toBeGreaterThan(0.2);
  });

  it("rebota en los bordes y nunca se sale", () => {
    const p = nuevaPartida();
    for (let i = 0; i < 400; i++) {
      avanzar(p, 0.05);
      expect(p.movil.x).toBeGreaterThanOrEqual(-15);
      expect(p.movil.x + p.movil.ancho).toBeLessThanOrEqual(115);
    }
  });
});

describe("pesoDe", () => {
  it("entre más angosto, más ligero: 25, 20, 15, 10, 5 y 2.5 kg", () => {
    expect([60, 45, 35, 25, 15, 5].map((a) => pesoDe(a).kg)).toEqual(["25", "20", "15", "10", "5", "2.5"]);
    expect(pesoDe(60).color).toBe("#d6372c");
  });
});
