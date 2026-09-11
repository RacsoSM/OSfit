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

  // Firestore no devuelve `null` para un campo que nunca se escribió: lo omite, y leerlo
  // da `undefined`. Un cliente anterior a la denormalizacion llega exactamente asi, y
  // antes producia NaN, que se colaba por el `=== null` y reventaba al indexar los dias.
  it("un campo ausente (undefined) se trata como sin día denormalizado", () => {
    const valor = { dia: undefined, fecha: undefined, esAncla: undefined };
    expect(interpretar(valor, 4, "2026-09-10")).toBeNull();
  });

  it("nunca devuelve NaN con un campo ausente", () => {
    const valor = { dia: undefined, fecha: undefined, esAncla: undefined };
    expect(Number.isNaN(interpretar(valor, 4, "2026-09-10") as number)).toBe(false);
  });

  it("un documento entero sin los campos denormalizados devuelve null", () => {
    const valor = {} as Parameters<typeof interpretar>[0];
    expect(interpretar(valor, 6, "2026-09-11")).toBeNull();
  });
});
