import { describe, expect, it } from "vitest";
import { aKg, barrasAKg, deKg, etiquetaUnidad, kgABarras, kgALb, KG_POR_BARRA, lbAKg, PILAS, unidadPorDefecto } from "./barras";

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

describe("la pila de la prensa (10 lb la primera, de 20 en 20 hasta 330 lb)", () => {
  it("barras → kg en las dos prensas que la usan", () => {
    for (const id of ["prensa-maquina", "prensa-horizontal-una-pierna"]) {
      expect(barrasAKg(1, id)).toBe(lbAKg(10));
      expect(barrasAKg(2, id)).toBe(lbAKg(30));
      expect(barrasAKg(6, id)).toBe(49.9);
      expect(barrasAKg(17, id)).toBe(lbAKg(330));
      expect(barrasAKg(0, id)).toBe(0);
    }
  });

  it("kg → barras, la más cercana y dentro de la pila", () => {
    for (let n = 1; n <= PILAS["prensa-maquina"].barras; n++) {
      expect(kgABarras(barrasAKg(n, "prensa-maquina"), "prensa-maquina")).toBe(n);
    }
    expect(kgABarras(500, "prensa-maquina")).toBe(17);
    expect(kgABarras(1, "prensa-maquina")).toBe(1);
  });

  it("aKg y deKg usan la pila de la máquina; las demás siguen con 4.5 kg por barra", () => {
    expect(aKg(6, "barras", "prensa-maquina")).toBe(49.9);
    expect(deKg(49.9, "barras", "prensa-maquina")).toBe(6);
    expect(aKg(6, "barras", "jalon-al-pecho")).toBe(27);
    expect(aKg(6, "barras")).toBe(27);
  });
});
