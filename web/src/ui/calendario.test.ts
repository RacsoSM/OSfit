import { describe, expect, it } from "vitest";
import type { Asistencia } from "../datos";
import { calendario, moverMes } from "./calendario";

function asistencia(campos: Partial<Asistencia> = {}): Asistencia {
  return {
    fecha: "2026-09-08",
    asistio: true,
    justificada: false,
    duracionMinutos: 45,
    ...campos,
  };
}

describe("calendario", () => {
  it("sin asistencias dice que faltan y quien las registra", () => {
    const html = calendario([], "2026-09", "2026-09-13");
    expect(html).toContain("Todavía no tienes asistencias registradas");
    expect(html).toContain("tu entrenador");
  });

  it("con asistencias no muestra la nota de estado vacio", () => {
    const html = calendario([asistencia()], "2026-09", "2026-09-13");
    expect(html).not.toContain("Todavía no tienes asistencias registradas");
  });

  it("sigue pintando la rejilla del mes aunque no haya asistencias", () => {
    const html = calendario([], "2026-09", "2026-09-13");
    expect(html).toContain("Septiembre 2026");
    expect(html).toContain('id="mes-anterior"');
  });
});

describe("moverMes", () => {
  it("retrocede de enero al diciembre del año anterior", () => {
    expect(moverMes("2026-01", -1)).toBe("2025-12");
  });

  it("avanza de diciembre a enero del año siguiente", () => {
    expect(moverMes("2026-12", 1)).toBe("2027-01");
  });
});
