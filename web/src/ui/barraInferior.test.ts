import { describe, expect, it } from "vitest";
import { BARRA, ventana } from "../ventanas";
import { barraInferior } from "./barraInferior";

describe("barraInferior", () => {
  const html = barraInferior(BARRA.map(ventana));

  it("un botón por ventana, en el orden de BARRA", () => {
    const ids = [...html.matchAll(/data-ventana="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["inicio", "musculos", "registro"]);
  });

  it("con su ícono y su nombre", () => {
    expect(html).toContain("💪");
    expect(html).toContain("Músculos");
  });

  it("no trae la activa marcada: la marca marcarVentanaActiva", () => {
    expect(html).not.toContain("activa");
  });
});
