import { describe, expect, it } from "vitest";
import type { Asistencia } from "./datos";
import { variacionQueToca } from "./variacion";

const HOY = "2026-09-15";

function asistio(fecha: string, dia: number, variacion?: number | null): Asistencia {
  return {
    fecha,
    asistio: true,
    justificada: false,
    diaRutinaRealizado: dia,
    variacionRealizada: variacion,
  };
}

function falto(fecha: string): Asistencia {
  return { fecha, asistio: false, justificada: false, diaRutinaRealizado: null };
}

function toca(dia: number, asistencias: Asistencia[], total: number, hoy = HOY): number {
  return variacionQueToca(dia, asistencias, hoy, total);
}

describe("variacionQueToca", () => {
  it("sin asistencias previas toca la primera variación", () => {
    expect(toca(0, [], 3)).toBe(0);
  });

  it("la siguiente vuelta avanza una posición", () => {
    expect(toca(0, [asistio("2026-09-08", 0, 0)], 3)).toBe(1);
  });

  it("después de la última vuelve a la primera", () => {
    expect(toca(0, [asistio("2026-09-08", 0, 2)], 3)).toBe(0);
  });

  it("si ya entrenó hoy se queda en la variación que hizo", () => {
    const previas = [asistio("2026-09-08", 0, 0), asistio(HOY, 0, 1)];
    expect(toca(0, previas, 3)).toBe(1);
  });

  it("una falta no avanza la variación", () => {
    expect(toca(0, [asistio("2026-09-08", 0, 0), falto("2026-09-11")], 3)).toBe(1);
  });

  it("una asistencia sin variacionRealizada cuenta como la primera", () => {
    // Firestore omite los campos que nunca se escribieron: llega `undefined`, no `null`.
    expect(toca(0, [asistio("2026-09-08", 0, undefined)], 3)).toBe(1);
    expect(toca(0, [asistio("2026-09-08", 0, null)], 3)).toBe(1);
  });

  it("cada día del ciclo rota por su cuenta", () => {
    const previas = [asistio("2026-09-08", 0, 1), asistio("2026-09-09", 1, 0)];
    expect(toca(0, previas, 3)).toBe(2);
    expect(toca(1, previas, 2)).toBe(1);
  });

  it("si se quitan variaciones el índice se acota", () => {
    expect(toca(0, [asistio("2026-09-08", 0, 7)], 2)).toBe(0);
  });

  it("un día sin variaciones siempre es la cero", () => {
    expect(toca(0, [asistio("2026-09-08", 0, 3)], 1)).toBe(0);
    expect(toca(0, [asistio("2026-09-08", 0, 3)], 0)).toBe(0);
  });

  it("las asistencias futuras no cuentan", () => {
    const previas = [asistio("2026-09-08", 0, 0), asistio("2026-09-30", 0, 2)];
    expect(toca(0, previas, 3)).toBe(1);
  });
});
