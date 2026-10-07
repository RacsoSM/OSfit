import { describe, expect, it } from "vitest";
import { estrellas, fondoPixel } from "./fondoPixel";

describe("fondoPixel", () => {
  const html = fondoPixel();

  it("dibuja sin suavizado, que es lo que hace que se vea en píxeles", () => {
    // La luna, el paisaje y las tres capas de estrellas.
    expect(html.match(/crispEdges/g)).toHaveLength(5);
  });

  it("las estrellas van como imagen de fondo bien escapada, sin romper el atributo", () => {
    expect(html.match(/class="px-estrellas /g)).toHaveLength(3);
    expect(html).not.toMatch(/style="[^"]*<svg/);
  });

  it("es decorativo: el lector de pantalla no lo lee", () => {
    expect(html).toContain(`aria-hidden="true"`);
  });

  it("las siluetas solo usan trazos horizontales y verticales", () => {
    const trazos = [...html.matchAll(/ d="([^"]*)"/g)].map((m) => m[1]).join("");
    expect(trazos).not.toMatch(/[CcSsQqTtAaLl]/);
  });
});

describe("estrellas", () => {
  it("son las mismas en cada carga", () => {
    expect(estrellas(30)).toEqual(estrellas(30));
  });

  it("solo usan trazos horizontales y verticales", () => {
    expect(estrellas(30).join("")).not.toMatch(/[CcSsQqTtAaLl]/);
  });

  it("se reparten en tres grupos que titilan por turnos", () => {
    expect(estrellas(30).every((g) => g.length > 0)).toBe(true);
  });
});
