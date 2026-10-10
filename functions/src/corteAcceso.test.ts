import { describe, expect, it } from "vitest";
import { sesionVigente } from "./corteAcceso";

describe("sesionVigente", () => {
  const corte = Date.parse("2026-10-10T18:00:00Z");

  it("sin corte, cualquier sesión sirve", () => {
    expect(sesionVigente(1_000, null)).toBe(true);
  });

  it("una sesión iniciada antes del corte ya no sirve", () => {
    expect(sesionVigente(corte / 1000 - 60, corte)).toBe(false);
  });

  it("una del mismo segundo que el corte tampoco", () => {
    expect(sesionVigente(corte / 1000, corte)).toBe(false);
  });

  it("una iniciada después del corte (link nuevo) sí", () => {
    expect(sesionVigente(corte / 1000 + 1, corte)).toBe(true);
  });

  it("sin auth_time y con corte, no sirve", () => {
    expect(sesionVigente(undefined, corte)).toBe(false);
  });
});
