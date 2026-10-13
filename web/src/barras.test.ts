import { describe, expect, it } from "vitest";
import { barrasAKg, kgABarras, KG_POR_BARRA, unidadPorDefecto } from "./barras";

describe("barras", () => {
  it("las máquinas de placas abren en barras; lo demás en kg", () => {
    expect(unidadPorDefecto("jalon-al-pecho")).toBe("barras");
    expect(unidadPorDefecto("extension-cuadriceps")).toBe("barras");
    expect(unidadPorDefecto("press-banca")).toBe("kg");
    expect(unidadPorDefecto("prensa")).toBe("kg");
  });

  it("convierte de ida y vuelta sin decimales basura", () => {
    expect(barrasAKg(5)).toBe(Math.round(5 * KG_POR_BARRA * 10) / 10);
    expect(String(barrasAKg(7))).not.toMatch(/0000/);
    expect(kgABarras(barrasAKg(6))).toBe(6);
  });
});
