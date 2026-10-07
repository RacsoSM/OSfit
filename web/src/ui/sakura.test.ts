import { describe, expect, it } from "vitest";
import { arbol, fondoSakura } from "./sakura";

describe("arbol", () => {
  const a = arbol(42, 50, 800, -Math.PI / 2, 150, 20, 4, -Math.PI, 0);

  it("es el mismo en cada carga", () => {
    expect(arbol(42, 50, 800, -Math.PI / 2, 150, 20, 4, -Math.PI, 0)).toEqual(a);
  });

  it("se ramifica: con cuatro niveles hay más de una rama por nivel", () => {
    expect(a.ramas.length).toBeGreaterThan(15);
  });

  it("florece: hay muchas más flores que ramas", () => {
    expect(a.flores.length).toBeGreaterThan(a.ramas.length * 2);
  });

  it("las ramas adelgazan hacia las puntas", () => {
    const grosores = a.ramas.map((r) => Number(r.match(/stroke-width="([\d.]+)"/)![1]));
    expect(grosores[0]).toBe(Math.max(...grosores));
    expect(Math.min(...grosores)).toBeLessThan(grosores[0] / 4);
  });
});

describe("fondoSakura", () => {
  const html = fondoSakura();

  it("es decorativo: el lector de pantalla no lo lee", () => {
    expect(html).toContain(`aria-hidden="true"`);
  });

  it("trae el lienzo de los pétalos de atrás", () => {
    expect(html).toContain(`id="petalos-fondo"`);
  });

  it("la flor se define una vez y se reusa", () => {
    expect(html.match(/id="sk-flor"/g)).toHaveLength(1);
    expect((html.match(/href="#sk-flor"/g) ?? []).length).toBeGreaterThan(20);
  });

  it("la flor es un grupo y no un symbol: un symbol sin tamaño se estira a todo el SVG", () => {
    expect(html).not.toContain("<symbol");
  });
});
