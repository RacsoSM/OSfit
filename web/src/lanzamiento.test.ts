import { describe, expect, it } from "vitest";
import { LANZAMIENTO_RESUMEN, resumenNuevoActivo } from "./lanzamiento";

describe("lanzamiento del resumen nuevo", () => {
  it("se enciende el 1 de diciembre y no antes", () => {
    expect(LANZAMIENTO_RESUMEN).toBe("2026-12-01");
    expect(resumenNuevoActivo("2026-11-30")).toBe(false);
    expect(resumenNuevoActivo("2026-12-01")).toBe(true);
    expect(resumenNuevoActivo("2027-01-15")).toBe(true);
  });
});
