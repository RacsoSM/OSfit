import { describe, expect, it } from "vitest";
import { trayectoria } from "./vueloRegistro";

describe("trayectoria", () => {
  const desde = { left: 20, top: 400, width: 160, height: 160 };
  const hasta = { left: 32, top: 120, width: 64, height: 64 };

  it("termina exactamente sobre el destino, encogido a su tamaño", () => {
    const t = trayectoria(desde, hasta);
    expect(t.fin).toEqual({ x: 12, y: -280, escala: 0.4 });
  });

  it("a medio camino va por encima de la recta: vuela en arco, no en línea", () => {
    const t = trayectoria(desde, hasta);
    expect(t.medio.x).toBeCloseTo(6);
    expect(t.medio.y).toBeLessThan(-140);
    expect(t.medio.escala).toBeCloseTo(0.7);
  });

  it("el arco no se dispara en recorridos largos", () => {
    const t = trayectoria(desde, { ...hasta, top: -3000 });
    expect(t.medio.y - (-3400 / 2)).toBeGreaterThanOrEqual(-60);
  });
});
