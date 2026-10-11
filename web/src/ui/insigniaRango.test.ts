import { describe, expect, it } from "vitest";
import { COLORES_RANGO, insigniaRango } from "./insigniaRango";

describe("insigniaRango", () => {
  it("cada rango tiene su propia figura", () => {
    const sinIds = (i: number) => insigniaRango(i, 40, "x").replace(/#[0-9a-f]{6}/g, "");
    const figuras = new Set(Array.from({ length: 8 }, (_, i) => sinIds(i)));
    expect(figuras.size).toBe(8);
  });

  it("usa el color de su rango", () => {
    for (let i = 0; i < 8; i++) expect(insigniaRango(i, 40, "x")).toContain(COLORES_RANGO[i]);
  });

  it("los degradados llevan el id que se le da, para no chocar con otras insignias", () => {
    const s = insigniaRango(3, 40, "abc");
    expect(s).toContain('id="abc-f"');
    expect(s).toContain("url(#abc-f)");
    expect(s).not.toMatch(/id="(?!abc-)/);
  });

  it("fuera de rango se queda en las orillas", () => {
    expect(insigniaRango(-2, 40, "x")).toBe(insigniaRango(0, 40, "x"));
    expect(insigniaRango(12, 40, "x")).toBe(insigniaRango(7, 40, "x"));
  });

  it("es del tamaño pedido", () => {
    expect(insigniaRango(0, 26, "x")).toContain('width="26" height="26"');
  });
});
