import { describe, expect, it } from "vitest";
import { LANZAMIENTO_AVISO_RESUMEN, avisoResumenActivo } from "./lanzamiento";

describe("lanzamiento de la ventana emergente del resumen", () => {
  it("se enciende el 1 de diciembre y no antes", () => {
    expect(LANZAMIENTO_AVISO_RESUMEN).toBe("2026-12-01");
    expect(avisoResumenActivo("2026-11-30")).toBe(false);
    expect(avisoResumenActivo("2026-12-01")).toBe(true);
    expect(avisoResumenActivo("2027-01-15")).toBe(true);
  });
});
