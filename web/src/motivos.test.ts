import { describe, expect, it } from "vitest";
import { motivosDisponibles } from "./motivos";

/**
 * 2026-09-14 es lunes, 15 martes, 16 miércoles; 11 viernes y 10 jueves.
 */
const vino = (fecha: string) => ({
  fecha,
  asistio: true,
  justificada: false,
  duracionMinutos: null,
});

const justificada = (fecha: string) => ({
  fecha,
  asistio: false,
  justificada: true,
  duracionMinutos: null,
});

const ids = (hoy: string, asistencias: Parameters<typeof motivosDisponibles>[1]) =>
  motivosDisponibles(hoy, asistencias).map((m) => m.id);

describe("motivosDisponibles", () => {
  it("filtra el motivo del lunes cuando no es lunes", () => {
    expect(ids("2026-09-16", [])).not.toContain("lunes");
  });

  it("filtra el de mas de dos dias cuando asistio ayer", () => {
    expect(ids("2026-09-16", [vino("2026-09-15")])).not.toContain("ausencia");
  });

  it("un lunes con mas de dos dias sin venir ofrece los seis", () => {
    // Último rastro el miércoles 9: el jueves 10 y el viernes 11, los dos días hábiles
    // previos al lunes, están vacíos.
    expect(ids("2026-09-14", [vino("2026-09-09")])).toEqual([
      "lunes",
      "ausencia",
      "adelantar",
      "reservado",
      "fragil",
      "otro",
    ]);
  });

  it("el fin de semana no cuenta como dia sin venir", () => {
    // Un lunes, haber venido el viernes es haber venido hace un día hábil.
    expect(ids("2026-09-14", [vino("2026-09-11")])).not.toContain("ausencia");
  });

  it("una falta justificada no es haber venido", () => {
    // Para la racha el soborno vale; para "tengo más de dos días sin venir" no, porque el
    // motivo afirma un hecho físico: el cliente no pisó el gimnasio.
    expect(ids("2026-09-16", [justificada("2026-09-15")])).toContain("ausencia");
  });

  it("haber venido hoy no ofrece el de la ausencia", () => {
    expect(ids("2026-09-16", [vino("2026-09-16")])).not.toContain("ausencia");
  });

  it("un miercoles sin venir en dos dias habiles ofrece cinco", () => {
    expect(ids("2026-09-16", [vino("2026-09-11")])).toEqual([
      "ausencia",
      "adelantar",
      "reservado",
      "fragil",
      "otro",
    ]);
  });

  it("solo el de texto libre habilita el campo", () => {
    const libres = motivosDisponibles("2026-09-14", []).filter((m) => m.libre).map((m) => m.id);
    expect(libres).toEqual(["otro"]);
  });
});
