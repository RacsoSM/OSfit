import { describe, expect, it } from "vitest";
import { promedioMinutos, rachaActual } from "./racha";

const vino = (fecha: string) => ({ fecha, asistio: true, justificada: false, duracionMinutos: null });
const falto = (fecha: string) => ({ fecha, asistio: false, justificada: false, duracionMinutos: null });
const justificada = (fecha: string) => ({ fecha, asistio: false, justificada: true, duracionMinutos: null });

describe("rachaActual", () => {
  it("cuenta días hábiles seguidos", () => {
    // 2026-09-08 es martes, 09 miércoles, 10 jueves
    expect(rachaActual([vino("2026-09-08"), vino("2026-09-09"), vino("2026-09-10")], "2026-09-10")).toBe(3);
  });

  it("una falta corta la racha", () => {
    expect(rachaActual([vino("2026-09-08"), falto("2026-09-09"), vino("2026-09-10")], "2026-09-10")).toBe(1);
  });

  it("una falta justificada mantiene la racha", () => {
    expect(rachaActual([vino("2026-09-08"), justificada("2026-09-09"), vino("2026-09-10")], "2026-09-10")).toBe(3);
  });

  it("el fin de semana ni suma ni corta", () => {
    // 2026-09-11 viernes, 12 sábado, 13 domingo, 14 lunes
    expect(rachaActual([vino("2026-09-11"), vino("2026-09-14")], "2026-09-14")).toBe(2);
  });

  it("hoy sin registro todavía no corta la racha", () => {
    expect(rachaActual([vino("2026-09-08"), vino("2026-09-09")], "2026-09-10")).toBe(2);
  });

  it("sin asistencias la racha es cero", () => {
    expect(rachaActual([], "2026-09-10")).toBe(0);
  });
});

describe("promedioMinutos", () => {
  it("promedia solo las sesiones con duración", () => {
    expect(promedioMinutos([
      { fecha: "2026-09-08", asistio: true, justificada: false, duracionMinutos: 50 },
      { fecha: "2026-09-09", asistio: true, justificada: false, duracionMinutos: 54 },
      { fecha: "2026-09-10", asistio: true, justificada: false, duracionMinutos: null },
    ])).toBe(52);
  });

  it("sin duraciones devuelve null", () => {
    expect(promedioMinutos([vino("2026-09-08")])).toBeNull();
  });
});
