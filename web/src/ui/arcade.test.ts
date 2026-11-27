import { afterEach, describe, expect, it, vi } from "vitest";
import { hiScore, ventanaArcade } from "./arcade";
import type { TablaDiscos } from "./juegoDiscos";

const tabla = (filas: [number, string, number, boolean?][], tuMejor = 0): TablaDiscos =>
  ({ filas: filas.map(([puesto, nombre, puntos, esTuyo]) => ({ puesto, nombre, puntos, esTuyo: !!esTuyo })), tuMejor });

describe("Arcade", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("el HI-SCORE es el campeón (primer nombre e inicial) y su puntuación; empates como +n", () => {
    expect(hiScore(tabla([[1, "Jessica Morales Ibarra", 47], [2, "Said", 28]]))).toEqual({ quien: ["👑 Jessica Morales Ib"], puntos: "47" });
    expect(hiScore(tabla([[1, "Jose  Juan", 36]])).quien).toEqual(["👑 Jose Juan"]);
    expect(hiScore(tabla([]))).toEqual({ quien: ["¡Sé el primer campeón!"], puntos: "" });
    expect(hiScore(null).quien).toEqual(["Cargando…"]);
  });

  it("con empate en el primer lugar salen los dos campeones, cada uno hasta 18 letras", () => {
    expect(hiScore(tabla([[1, "Said", 31], [1, "Ana Soto", 31], [3, "Bogue", 20]]))).toEqual({ quien: ["👑 Said", "👑 Ana Soto"], puntos: "31" });
    expect(hiScore(tabla([[1, "Jessica Morales Ibarra", 47], [1, "Brianda Torres Quintero", 47]])).quien)
      .toEqual(["👑 Jessica Morales Ib", "👑 Brianda Torres Qui"]);
    // Más de dos empatados: los dos primeros, y el segundo dice cuántos más.
    expect(hiScore(tabla([[1, "Said", 31], [1, "Ana", 31], [1, "Bogue", 31], [1, "Luz", 31]])).quien).toEqual(["👑 Said", "👑 Ana +2"]);
    const html = ventanaArcade({ "osfit:torre-tabla": tabla([[1, "Said", 31], [1, "Ana Soto", 31]]) });
    expect(html).toContain("<span>👑 Said</span><span>👑 Ana Soto</span>");
  });

  it("una maquinita por juego que abre su ventana, con su campeón y tu récord", () => {
    const html = ventanaArcade({
      "osfit:torre-tabla": tabla([[1, "Jessica Morales Ibarra", 47], [3, "Said", 28, true]], 28),
      "osfit:kettlebell-tabla": tabla([]),
    });
    expect(html).toContain('data-arcade="juego"');
    expect(html).toContain('data-arcade="kettlebell"');
    expect(html).toContain("Fit Bird");
    expect(html).toContain("👑 Jessica Morales Ib");
    expect(html).toContain("Tu récord 28 · #3");
    expect(html).toContain("¡Sé el primer campeón!");
    expect(html).toContain(">ARCADE<");
    expect(html).toContain(">CAMPEÓN<");
    expect(html).not.toContain("HI-SCORE");
  });

  it("escapa los nombres", () => {
    const html = ventanaArcade({ "osfit:torre-tabla": tabla([[1, "<b>Hack</b> X", 9]]), "osfit:kettlebell-tabla": null });
    expect(html).not.toContain("<b>Hack");
    expect(html).toContain("&lt;b&gt;Hack");
  });
});
