import { describe, expect, it } from "vitest";
import { interpretar } from "./dia";

describe("interpretar", () => {
  it("un ancla vale tal cual, sin importar la fecha", () => {
    const valor = { dia: 3, fecha: "2026-09-01", esAncla: true };
    expect(interpretar(valor, 4, "2026-09-05")).toBe(3);
  });

  it("una asistencia de hoy es el día que está haciendo hoy", () => {
    const valor = { dia: 1, fecha: "2026-09-10", esAncla: false };
    expect(interpretar(valor, 4, "2026-09-10")).toBe(1);
  });

  it("una asistencia anterior significa que le toca el siguiente", () => {
    const valor = { dia: 1, fecha: "2026-09-09", esAncla: false };
    expect(interpretar(valor, 4, "2026-09-10")).toBe(2);
  });

  it("da la vuelta al día 1 al terminar el ciclo", () => {
    const valor = { dia: 3, fecha: "2026-09-09", esAncla: false };
    expect(interpretar(valor, 4, "2026-09-10")).toBe(0);
  });

  it("sin día denormalizado devuelve null", () => {
    const valor = { dia: null, fecha: null, esAncla: false };
    expect(interpretar(valor, 4, "2026-09-10")).toBeNull();
  });

  it("sin rutina devuelve null", () => {
    const valor = { dia: 0, fecha: "2026-09-09", esAncla: false };
    expect(interpretar(valor, 0, "2026-09-10")).toBeNull();
  });
});
