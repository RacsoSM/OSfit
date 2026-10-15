import { describe, expect, it } from "vitest";
import type { Asistencia } from "../datos";
import { tarjetasStats } from "./tarjetasStats";

function asistencia(campos: Partial<Asistencia> = {}): Asistencia {
  return {
    fecha: "2026-09-08",
    asistio: true,
    justificada: false,
    duracionMinutos: 45,
    ...campos,
  };
}

describe("tarjetasStats", () => {
  it("sin asistencias dice que falta historial y quien lo llena", () => {
    const html = tarjetasStats([], "2026-09-13");
    expect(html).toContain("Todavía no tienes asistencias");
    expect(html).toContain("tu entrenador");
  });

  it("sin asistencias no dice que la racha esta en 0 dias sin explicar por que", () => {
    const html = tarjetasStats([], "2026-09-13");
    expect(html).not.toContain("días seguidos sin faltar");
    expect(html).toContain("arranca con tu primera sesión");
  });

  it("con historial no muestra la nota de asistencias, solo las cifras", () => {
    const html = tarjetasStats([asistencia()], "2026-09-13");
    expect(html).not.toContain("Todavía no tienes asistencias");
  });

  it("con una sola sesion muestra el numero en singular", () => {
    // 2026-09-08 es martes: dia habil, asi que cuenta para la racha.
    const html = tarjetasStats([asistencia({ fecha: "2026-09-08" })], "2026-09-08");
    expect(html).toContain("día seguido sin faltar");
  });
});

describe("entrenamientos de la semana", () => {
  it("muestra n / 5 en lugar del promedio", () => {
    const html = tarjetasStats([asistencia()], "2026-09-13", 2);
    expect(html).toContain("Esta semana");
    expect(html).toMatch(/2<span class="numero-de"> \/ 5<\/span>/);
    expect(html).toContain("entrenamientos");
    expect(html).not.toContain("minutos por sesión");
  });
  it("mientras no llegan sus sesiones dice —", () => {
    expect(tarjetasStats([asistencia()], "2026-09-13", null)).toMatch(/—<span class="numero-de"> \/ 5/);
  });
  it("en singular con uno", () => {
    expect(tarjetasStats([asistencia()], "2026-09-13", 1)).toMatch(/>\s*entrenamiento\s*</);
  });
});
