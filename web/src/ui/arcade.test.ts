import { afterEach, describe, expect, it, vi } from "vitest";
import { hiScore, ventanaArcade } from "./arcade";
import type { TablaDiscos } from "./juegoDiscos";

const tabla = (filas: [number, string, number, boolean?][], tuMejor = 0): TablaDiscos =>
  ({ filas: filas.map(([puesto, nombre, puntos, esTuyo]) => ({ puesto, nombre, puntos, esTuyo: !!esTuyo })), tuMejor });

describe("Arcade", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("el HI-SCORE es el campeón (primer nombre e inicial) y su puntuación; empates como +n", () => {
    expect(hiScore(tabla([[1, "Jessica Morales Ibarra", 47], [2, "Said", 28]]))).toEqual({ quien: "👑 Jessica Morales Ib", puntos: "47" });
    expect(hiScore(tabla([[1, "Jose  Juan", 36]])).quien).toBe("👑 Jose Juan");
    expect(hiScore(tabla([[1, "Said", 31], [1, "Ana Soto", 31]]))).toEqual({ quien: "👑 Said +1", puntos: "31" });
    expect(hiScore(tabla([]))).toEqual({ quien: "¡Sé el primer campeón!", puntos: "" });
    expect(hiScore(null).quien).toBe("Cargando…");
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
