import { describe, expect, it } from "vitest";
import { cuerpoAviso, lunesDe, semanaValida } from "./cambiarSemana";

describe("cambiarSemana", () => {
  it("acepta solo las semanas 1 a 4", () => {
    expect(semanaValida({ semana: 1 })).toBe(1);
    expect(semanaValida({ semana: 4 })).toBe(4);
    expect(semanaValida({ semana: 0 })).toBeNull();
    expect(semanaValida({ semana: 5 })).toBeNull();
    expect(semanaValida({ semana: 2.5 })).toBeNull();
    expect(semanaValida({ semana: "2" })).toBeNull();
    expect(semanaValida(null)).toBeNull();
  });

  it("el lunes de la semana", () => {
    expect(lunesDe("2026-11-26")).toBe("2026-11-23");
    expect(lunesDe("2026-11-29")).toBe("2026-11-23");
  });

  it("el aviso al entrenador dice de qué semana a cuál", () => {
    expect(cuerpoAviso("Valeria", 4, 1)).toBe("Valeria cambió su semana de Base a Descarga.");
    expect(cuerpoAviso("Valeria", 2, null)).toBe("Valeria cambió su semana a Carga.");
  });
});
