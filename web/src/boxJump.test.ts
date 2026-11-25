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

  it("si sale por un lado entra por el otro", () => {
    const s = nuevoSalto(180, semilla(4));
    s.x = 1; s.vx = 0;
    // Como con la flecha del teclado: siempre un poco más a la izquierda.
    let cruzo = false;
    for (let i = 0; i < 10; i++) { avanzar(s, 1 / 60, s.x - 30); if (s.x > ANCHO * 0.8) cruzo = true; }
    expect(cruzo).toBe(true);
  });

  it("con el dedo va derecho hacia él, sin cruzar la orilla ni cambiar de dirección", () => {
    const s = nuevoSalto(180, semilla(4));
    s.x = 2; s.vx = 0;
    let antes = s.x;
    for (let i = 0; i < 70; i++) {
      avanzar(s, 1 / 60, ANCHO - 4);
      expect(s.x).toBeGreaterThanOrEqual(antes - 1e-9); // nunca se regresa
      antes = s.x;
    }
    expect(s.x).toBeCloseTo(ANCHO - 4, 0);
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

  it("sigue al dedo sin retraso y al soltar frena casi en seco", () => {
    const s = nuevoSalto(180, semilla(3));
    s.x = 50; s.vx = 0;
    let t = 0;
    while (Math.abs(s.x - 80) > 1 && t < 1) { avanzar(s, 1 / 60, 80); t += 1 / 60; }
    expect(t).toBeLessThan(0.25);
    s.x = 20; s.vx = 170;
    const desde = s.x;
    for (let k = 0; k < 60; k++) avanzar(s, 1 / 60, null);
    expect(s.x - desde).toBeLessThan(5);
  });
});
