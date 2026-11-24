import { describe, expect, it } from "vitest";
import { avisoResumen, nombreMes, resumenPorAvisar } from "./avisoResumen";

describe("resumenPorAvisar", () => {
  const meses = [{ mes: "2026-09" }, { mes: "2026-10" }];
  it("avisa del mes que acaba de terminar si ya está y no lo ha visto", () => {
    expect(resumenPorAvisar(meses, "2026-11-01", null)).toBe("2026-10");
    expect(resumenPorAvisar(meses, "2026-11-24", "2026-09")).toBe("2026-10");
  });
  it("no avisa si ya lo vio, si todavía no se cierra o si es de hace meses", () => {
    expect(resumenPorAvisar(meses, "2026-11-01", "2026-10")).toBeNull();
    expect(resumenPorAvisar([{ mes: "2026-09" }], "2026-11-01", null)).toBeNull();
    expect(resumenPorAvisar(meses, "2026-12-03", null)).toBeNull();
    expect(resumenPorAvisar(null, "2026-11-01", null)).toBeNull();
  });
  it("enero avisa de diciembre del año anterior", () => {
    expect(resumenPorAvisar([{ mes: "2026-12" }], "2027-01-01", null)).toBe("2026-12");
  });
});

describe("avisoResumen", () => {
  it("el texto con el mes y los dos botones; nada sin mes", () => {
    const html = avisoResumen("2026-10");
    expect(html).toContain("Tu resumen de octubre ya está listo");
    expect(html).toContain("¿Deseas verlo ahora?");
    expect(html).toContain("Ver ahora");
    expect(html).toContain("Cancelar");
    expect(avisoResumen(null)).toBe("");
    expect(nombreMes("2026-01")).toBe("enero");
  });
});
