import { describe, expect, it } from "vitest";
import {
  ALTURA_SALTO, ANCHO, METROS_POR_PISO, PISOS, RADIO, SALTO, SUPER_SALTO, anchoCajon, avanzar, metros, nuevoSalto, piso, separacion,
  type Cajon,
} from "./boxJump";

function semilla(n: number): () => number {
  let s = n;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

describe("Box Jump", () => {
  it("arranca rebotando sobre un cajón ancho y sube", () => {
    const s = nuevoSalto(180, semilla(1));
    expect(s.cajones[0]!.ancho).toBe(40);
    for (let i = 0; i < 20; i++) avanzar(s, 1 / 60, null);
    expect(s.h).toBeGreaterThan(0);
  });

  it("al caer sobre un cajón rebota; el trampolín da un súper salto; la espuma se rompe", () => {
    const s = nuevoSalto(180, semilla(2));
    const c: Cajon = { x: 40, h: 30, ancho: 20, tipo: "firme", vx: 0, trampolin: false, roto: false };
    s.cajones = [c]; s.x = 50; s.h = 30.5; s.vh = -40;
    expect(avanzar(s, 1 / 60, null)).toBe("rebote");
    expect(s.vh).toBe(SALTO);
    c.trampolin = true; s.h = 30.5; s.vh = -40;
    expect(avanzar(s, 1 / 60, null)).toBe("trampolin");
    expect(s.vh).toBe(SUPER_SALTO);
    c.trampolin = false; c.tipo = "espuma"; s.h = 30.5; s.vh = -40;
    expect(avanzar(s, 1 / 60, null)).toBe("espuma");
    expect(c.roto).toBe(true);
  });

  it("subiendo no choca con un cajón: solo se aterriza cayendo", () => {
    const s = nuevoSalto(180, semilla(3));
    s.cajones = [{ x: 40, h: 30, ancho: 20, tipo: "firme", vx: 0, trampolin: false, roto: false }];
    s.x = 50; s.h = 29.5; s.vh = 60;
    expect(avanzar(s, 1 / 60, null)).toBeNull();
    expect(s.h).toBeGreaterThan(30);
  });

  it("si sale por un lado entra por el otro, y va hacia el dedo por el camino corto", () => {
    const s = nuevoSalto(180, semilla(4));
    s.x = 2; s.vx = 0;
    avanzar(s, 1 / 60, ANCHO - 4);
    expect(s.vx).toBeLessThan(0); // hacia la izquierda: cruzar la orilla es más corto
    for (let i = 0; i < 40; i++) avanzar(s, 1 / 60, ANCHO - 4);
    // Llega a donde apunta el dedo (x = −4 es el mismo lugar que 96, del otro lado de la orilla).
    expect(((s.x % ANCHO) + ANCHO) % ANCHO).toBeCloseTo(ANCHO - 4, 0);
  });

  it("caer debajo de la pantalla termina", () => {
    const s = nuevoSalto(180, semilla(5));
    s.cajones = []; s.camara = 0; s.h = 1; s.vh = -100;
    let fin = null;
    for (let i = 0; i < 60 && !fin; i++) fin = avanzar(s, 1 / 60, null);
    expect(fin).toBe("fin");
  });

  it("cada 40 m un nivel más difícil (hasta el 8, de la Tierra a la galaxia): más separados y más angostos", () => {
    expect([0, 39, 40, 80, 320, 999].map(piso)).toEqual([1, 1, 2, 3, PISOS, PISOS]);
    expect(separacion(3)[1]).toBeGreaterThan(separacion(1)[1]);
    expect(anchoCajon(PISOS)).toBeLessThan(anchoCajon(1));
    expect(METROS_POR_PISO).toBe(40);
  });

  it("siempre hay camino: entre dos cajones firmes nunca hay más altura de la que se salta", () => {
    for (let k = 1; k <= 20; k++) {
      const s = nuevoSalto(180, semilla(k));
      // Sube la cámara a la fuerza para generar muchos pisos.
      for (let paso = 0; paso < 400; paso++) {
        s.h = s.camara + 300; s.vh = 0; s.terminada = false;
        avanzar(s, 1 / 60, null);
      }
      const firmes = s.cajones.filter((c) => c.tipo !== "espuma").map((c) => c.h).sort((a, b) => a - b);
      for (let i = 1; i < firmes.length; i++) expect(firmes[i]! - firmes[i - 1]!).toBeLessThan(ALTURA_SALTO - RADIO);
    }
  });

  it("los puntos son los metros más altos alcanzados", () => {
    const s = nuevoSalto(180, semilla(6));
    s.maxH = 123;
    expect(metros(s)).toBe(12);
  });
});
