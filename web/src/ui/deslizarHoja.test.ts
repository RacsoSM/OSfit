import { describe, expect, it } from "vitest";
import { decidirCierre } from "./deslizarHoja";

describe("decidirCierre", () => {
  it("jalar lo suficiente hacia abajo la cierra", () => {
    expect(decidirCierre(100, 400)).toBe(true);
  });
  it("un tirón corto pero rápido también", () => {
    expect(decidirCierre(40, 50)).toBe(true);
  });
  it("corto y lento regresa a su lugar", () => {
    expect(decidirCierre(40, 400)).toBe(false);
  });
  it("hacia arriba nunca la cierra", () => {
    expect(decidirCierre(-120, 100)).toBe(false);
    expect(decidirCierre(0, 10)).toBe(false);
  });
});
