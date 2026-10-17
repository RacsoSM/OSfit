import { describe, expect, it } from "vitest";
import { BARRA, ventana } from "../ventanas";
import { barraInferior } from "./barraInferior";

describe("barraInferior", () => {
  const html = barraInferior(BARRA.map(ventana));

  it("un botón por ventana, en el orden de BARRA", () => {
    const ids = [...html.matchAll(/data-ventana="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["inicio", "musculos", "registro"]);
  });

  it("cada botón con su ícono (SVG, no emoji) y su nombre", () => {
    const botones = html.split('class="barra-opcion"').slice(1);
    expect(botones).toHaveLength(3);
    for (const b of botones) expect(b).toMatch(/<span class="barra-icono" aria-hidden="true">\s*<svg/);
    expect(html).toContain("Músculos");
    expect(html).not.toContain("💪");
    expect(html).not.toContain("🏠");
    expect(html).not.toContain("📝");
  });

  it("Músculos trae el busto de los dos sexos, cada uno con su máscara", () => {
    expect(html).toContain('class="barra-busto barra-busto-H"');
    expect(html).toContain('class="barra-busto barra-busto-M"');
    expect(html).toContain('mask="url(#barra-mascara-H)"');
    expect(html).toContain('mask="url(#barra-mascara-M)"');
  });

  it("no trae la activa marcada: la marca marcarVentanaActiva", () => {
    expect(html).not.toContain("activa");
  });
});
