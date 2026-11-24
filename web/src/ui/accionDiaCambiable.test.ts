import { describe, expect, it } from "vitest";
import { diaCambiable, mensajeDeError } from "./accionDia";

const hoy = "2026-11-23";

describe("diaCambiable", () => {
  it("sin asistencia de hoy, o con falta, se puede", () => {
    expect(diaCambiable([], null, hoy)).toBe(true);
    expect(diaCambiable([{ fecha: hoy, asistio: false }], [], hoy)).toBe(true);
    expect(diaCambiable([{ fecha: "2026-11-22", asistio: true }], [], hoy)).toBe(true);
  });

  it("si la marcó la web al empezar y no ha guardado nada hoy, se puede (Jesica, 2026-11-23)", () => {
    expect(diaCambiable([{ fecha: hoy, asistio: true, marcadaDesde: "registro" }], [{ fecha: "2026-11-18" }], hoy)).toBe(true);
    expect(diaCambiable([{ fecha: hoy, asistio: true, marcadaDesde: "registro" }], null, hoy)).toBe(true);
  });

  it("con un entrenamiento guardado hoy, o marcada por el entrenador, ya no", () => {
    expect(diaCambiable([{ fecha: hoy, asistio: true, marcadaDesde: "registro" }], [{ fecha: hoy }], hoy)).toBe(false);
    expect(diaCambiable([{ fecha: hoy, asistio: true }], [], hoy)).toBe(false);
  });
});

describe("mensajeDeError", () => {
  it("dice por qué cuando la función lo explica; si no, el genérico", () => {
    expect(mensajeDeError({ message: "ya_asistio_hoy" })).toContain("Ya entrenaste hoy");
    expect(mensajeDeError({ message: "sin_rutina" })).toContain("rutina");
    expect(mensajeDeError(new Error("network"))).toContain("No pudimos cambiar tu día");
    expect(mensajeDeError(null)).toContain("No pudimos cambiar tu día");
  });
});
