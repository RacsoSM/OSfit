import { describe, expect, it } from "vitest";
import { fechaCorta, graficaLinea, lecturaGrafica } from "./grafica";

const puntos = [
  { fecha: "2026-09-01", valor: 69.7, etiqueta: "55 kg × 8" },
  { fecha: "2026-10-16", valor: 72.9, etiqueta: "62.5 kg × 5" },
];
const kg = (p: { valor: number }) => `${p.valor} kg`;

describe("graficaLinea", () => {
  it("sin puntos no pinta nada", () => {
    expect(graficaLinea([])).toBe("");
  });

  it("un punto por fecha, el último elegido, con su lectura en atributos", () => {
    const svg = graficaLinea(puntos, { formato: kg });
    expect(svg.match(/class="grafica-punto/g)).toHaveLength(2);
    expect(svg).toContain(`class="grafica-punto elegido"`);
    expect(svg).toContain(`data-valor="72.9 kg" data-detalle="16 oct · 62.5 kg × 5"`);
    expect(svg).toContain(`class="grafica-linea"`);
  });

  it("con un solo punto no hay línea", () => {
    expect(graficaLinea(puntos.slice(0, 1))).not.toContain("grafica-linea");
  });

  it("dice qué fechas abarca para el lector de pantalla", () => {
    expect(graficaLinea(puntos)).toContain(`aria-label="2 fechas, del 1 sep al 16 oct"`);
  });

  it("escapa lo que viene de las sesiones", () => {
    expect(graficaLinea([{ fecha: "2026-10-01", valor: 1, etiqueta: `<b>"x"</b>` }])).not.toContain("<b>");
  });

  it("con franjas pinta una por rango, con su nombre", () => {
    const svg = graficaLinea(puntos, { bandas: [{ desde: 0, hasta: 2, nombre: "Principiante", color: "#bfe3ff" }] });
    expect(svg).toContain(`fill="#bfe3ff"`);
    expect(svg).toContain("Principiante");
  });
});

describe("lecturaGrafica", () => {
  it("abre con el último punto: el número grande y, al lado, la fecha y la serie", () => {
    const html = lecturaGrafica(puntos, kg);
    expect(html).toContain(`<strong data-lectura="valor">72.9 kg</strong>`);
    expect(html).toContain(`<span data-lectura="detalle">16 oct · 62.5 kg × 5</span>`);
  });

  it("si el número ya es la serie, no la repite", () => {
    expect(lecturaGrafica(puntos)).toContain(`<span data-lectura="detalle">16 oct</span>`);
  });
});

describe("fechaCorta", () => {
  it("día y mes abreviado", () => {
    expect(fechaCorta("2026-01-05")).toBe("5 ene");
  });
});
