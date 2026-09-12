import { describe, expect, it } from "vitest";
import { faltaQueRompioLaRacha } from "./faltaRompio";

/**
 * GEMELO: `FaltaQueRompioLaRachaTest` en Kotlin. Los mismos casos, las mismas fechas y los
 * mismos valores esperados.
 *
 * 2026-09-07 es lunes; 2026-09-12, sábado. Las fechas de estos tests se eligieron para que
 * la semana caiga entera de lunes a viernes y los fines de semana se vean aparte.
 */
const vino = (fecha: string) => ({
  fecha,
  asistio: true,
  justificada: false,
  duracionMinutos: null,
});

const falto = (fecha: string, justificada = false) => ({
  fecha,
  asistio: false,
  justificada,
  duracionMinutos: null,
});

describe("faltaQueRompioLaRacha", () => {
  it("encuentra la falta que rompio la racha", () => {
    const asistencias = [
      vino("2026-09-07"),
      falto("2026-09-08"),
      vino("2026-09-09"),
      vino("2026-09-10"),
    ];
    // Vino el 9 y el 10, así que la racha viva arranca el 9; la falta del 8 es la que la
    // cortó y es la única reparable.
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-11")).toBe("2026-09-08");
  });

  it("devuelve null si la racha esta viva", () => {
    const asistencias = [vino("2026-09-09"), vino("2026-09-10")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-11")).toBeNull();
  });

  it("ignora las faltas ya justificadas", () => {
    const asistencias = [vino("2026-09-07"), falto("2026-09-08", true), vino("2026-09-09")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-10")).toBeNull();
  });

  it("ignora los fines de semana", () => {
    // 2026-09-12 y 13 son sábado y domingo: no hay registro y no rompen nada.
    const asistencias = [vino("2026-09-11"), vino("2026-09-14")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-15")).toBeNull();
  });

  it("un dia habil sin registro alguno cuenta como falta", () => {
    // No venir y que nadie lo registre es faltar igual: la racha se rompe sola.
    const asistencias = [vino("2026-09-07"), vino("2026-09-10")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-11")).toBe("2026-09-09");
  });

  it("nunca devuelve hoy", () => {
    // Hoy se justifica por el otro camino ("hoy no voy a poder ir"), no por este.
    const asistencias = [vino("2026-09-09"), falto("2026-09-10")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-10")).toBeNull();
  });

  it("sin historial no hay nada que reparar", () => {
    expect(faltaQueRompioLaRacha([], "2026-09-11")).toBeNull();
  });
});
