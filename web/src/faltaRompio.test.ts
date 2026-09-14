import { describe, expect, it } from "vitest";
import { faltaQueRompioLaRacha } from "./faltaRompio";

/**
 * GEMELO: `FaltaQueRompioLaRachaTest` en Kotlin. Los mismos casos, las mismas fechas y los
 * mismos valores esperados.
 *
 * 2026-09-07 es lunes; 2026-09-12, sábado. Las fechas de estos tests se eligieron para que
 * la semana caiga entera de lunes a viernes y los fines de semana se vean aparte.
 *
 * La ventana de reparación son los 2 días hábiles anteriores a hoy: una rotura más vieja deja
 * de ofrecerse.
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
  it("encuentra la falta de ayer", () => {
    const asistencias = [vino("2026-09-08"), vino("2026-09-09"), falto("2026-09-10")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-11")).toBe("2026-09-10");
  });

  it("encuentra la falta de hace dos dias habiles", () => {
    // Límite de la ventana, inclusive: faltó el 9, volvió el 10, hoy es 11.
    const asistencias = [vino("2026-09-08"), falto("2026-09-09"), vino("2026-09-10")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-11")).toBe("2026-09-09");
  });

  it("no ofrece una rotura de hace tres dias habiles", () => {
    // Antes de la regla de los 2 días hábiles esto devolvía 2026-09-08.
    const asistencias = [
      vino("2026-09-07"),
      falto("2026-09-08"),
      vino("2026-09-09"),
      vino("2026-09-10"),
    ];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-11")).toBeNull();
  });

  it("el lunes todavia repara la falta del viernes", () => {
    // Es la razón de contar días hábiles y no 48 horas de reloj: el fin de semana la página
    // no dibuja acciones, así que con horas el viernes vencería sin que el cliente hubiera
    // tenido nunca un botón que tocar.
    const asistencias = [vino("2026-09-09"), vino("2026-09-10"), falto("2026-09-11")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-14")).toBe("2026-09-11");
  });

  it("devuelve null si la racha esta viva", () => {
    const asistencias = [vino("2026-09-09"), vino("2026-09-10")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-11")).toBeNull();
  });

  it("ignora las faltas ya justificadas", () => {
    const asistencias = [vino("2026-09-08"), falto("2026-09-09", true), vino("2026-09-10")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-11")).toBeNull();
  });

  it("ignora los fines de semana", () => {
    // 2026-09-12 y 13 son sábado y domingo: no hay registro y no rompen nada.
    const asistencias = [vino("2026-09-10"), vino("2026-09-11")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-14")).toBeNull();
  });

  it("un dia habil sin registro alguno cuenta como falta", () => {
    const asistencias = [vino("2026-09-08"), vino("2026-09-09")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-11")).toBe("2026-09-10");
  });

  it("nunca devuelve hoy", () => {
    const asistencias = [vino("2026-09-08"), vino("2026-09-09"), falto("2026-09-10")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-10")).toBeNull();
  });

  it("sin historial no hay nada que reparar", () => {
    expect(faltaQueRompioLaRacha([], "2026-09-11")).toBeNull();
  });

  it("un cliente recien dado de alta no tiene faltas anteriores a su alta", () => {
    const asistencias = [vino("2026-09-11")];
    expect(faltaQueRompioLaRacha(asistencias, "2026-09-11")).toBeNull();
  });
});
