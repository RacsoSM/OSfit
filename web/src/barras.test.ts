import { describe, expect, it } from "vitest";
import { aKg, barrasAKg, deKg, etiquetaUnidad, kgABarras, kgALb, KG_POR_BARRA, lbAKg, unidadPorDefecto } from "./barras";

describe("barras", () => {
  it("las máquinas de placas abren en barras; lo demás en kg", () => {
    expect(unidadPorDefecto("jalon-al-pecho")).toBe("barras");
    expect(unidadPorDefecto("extension-cuadriceps")).toBe("barras");
    expect(unidadPorDefecto("press-banca")).toBe("kg");
    expect(unidadPorDefecto("prensa")).toBe("kg");
    expect(unidadPorDefecto("prensa-maquina")).toBe("barras");
  });

  it("convierte de ida y vuelta sin decimales basura", () => {
    expect(barrasAKg(5)).toBe(Math.round(5 * KG_POR_BARRA * 10) / 10);
    expect(String(barrasAKg(7))).not.toMatch(/0000/);
    expect(kgABarras(barrasAKg(6))).toBe(6);
  });
});

describe("libras (Registrar en libras, 2026-10-22)", () => {
  it("lb ↔ kg: a décimas de kg y a media libra", () => {
    expect(lbAKg(45)).toBe(20.4);
    expect(lbAKg(100)).toBe(45.4);
    expect(kgALb(20.4)).toBe(45);
    expect(kgALb(45.4)).toBe(100);
  });

  it("aKg y deKg por unidad", () => {
    expect(aKg(6, "barras")).toBe(27);
    expect(aKg(45, "lb")).toBe(20.4);
    expect(aKg(20, "kg")).toBe(20);
    expect(deKg(27, "barras")).toBe(6);
    expect(deKg(20.4, "lb")).toBe(45);
  });

  it("con libras, el peso libre abre en lb y las máquinas de placas siguen en barras", () => {
    expect(unidadPorDefecto("press-banca", "lb")).toBe("lb");
    expect(unidadPorDefecto("jalon-al-pecho", "lb")).toBe("barras");
    expect(etiquetaUnidad("lb")).toBe("lb");
    expect(etiquetaUnidad("barras", "1")).toBe("barra");
  });
});
