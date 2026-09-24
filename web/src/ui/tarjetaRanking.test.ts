import { describe, expect, it } from "vitest";
import type { FilaRanking, Ranking } from "../datos";
import { tarjetaRanking, type EstadoRanking } from "./tarjetaRanking";

const fila = (puesto: number, nombre: string, racha: number, esTuyo = false): FilaRanking =>
  ({ puesto, nombre, racha, esTuyo });

const datos: Ranking = {
  actual: [fila(1, "Ana", 23), fila(2, "Carlos", 18), fila(2, "Diana", 18), fila(4, "María", 12, true), fila(5, "Pepe", 0)],
  historica: [fila(1, "Xime", 40), fila(2, "María", 30, true)],
};
const listo: EstadoRanking = { estado: "listo", datos };

/** Lo que dice cada fila, en orden: [puesto o medalla, nombre, racha]. */
function filas(html: string): string[][] {
  return [...html.matchAll(
    /class="ranking-puesto">([^<]*)<\/span>\s*<span class="ranking-nombre">([^<]*)<\/span>\s*<span class="ranking-racha">🔥 (\d+)</g
  )].map((m) => [m[1], m[2], m[3]]);
}

describe("tarjetaRanking", () => {
  it("pinta la actual con medallas por puesto y numero desde el 4", () => {
    expect(filas(tarjetaRanking(listo, "actual"))).toEqual([
      ["🥇", "Ana", "23"],
      ["🥈", "Carlos", "18"],
      ["🥈", "Diana", "18"],
      ["4", "Tú · María", "12"],
      ["5", "Pepe", "0"],
    ]);
  });

  it("pinta la historica cuando esa es la pestana", () => {
    expect(filas(tarjetaRanking(listo, "historica"))).toEqual([
      ["🥇", "Xime", "40"],
      ["🥈", "Tú · María", "30"],
    ]);
  });

  it("marca la pestana activa en el segmentado", () => {
    const html = tarjetaRanking(listo, "historica");
    expect(html).toMatch(/class="segmento activo" data-pestana="historica" aria-selected="true"/);
    expect(html).toMatch(/class="segmento" data-pestana="actual" aria-selected="false"/);
  });

  it("resalta solo la fila propia", () => {
    const html = tarjetaRanking(listo, "actual");
    expect(html.match(/ranking-fila tuya/g)?.length).toBe(1);
  });

  it("cargando muestra el esqueleto y el segmentado", () => {
    const html = tarjetaRanking({ estado: "cargando" }, "actual");
    expect(html).toContain("ranking-esqueleto");
    expect(html).toContain(`data-pestana="actual"`);
  });

  it("error muestra el mensaje y el boton de reintentar", () => {
    const html = tarjetaRanking({ estado: "error" }, "actual");
    expect(html).toContain("No pudimos cargar el ranking");
    expect(html).toContain(`id="ranking-reintentar"`);
  });

  it("una lista vacia muestra el estado vacio", () => {
    const html = tarjetaRanking({ estado: "listo", datos: { actual: [], historica: [] } }, "actual");
    expect(html).toContain("Todavía no hay rachas");
    expect(filas(html)).toEqual([]);
  });

  // Review Focus: nombres con HTML se escapan.
  it("escapa los nombres", () => {
    const html = tarjetaRanking(
      { estado: "listo", datos: { actual: [fila(1, `<b>Ana</b> & "Co"`, 3)], historica: [] } },
      "actual"
    );
    expect(html).not.toContain("<b>Ana</b>");
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt; &amp; &quot;Co&quot;");
  });
});
