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

  /**
   * Los valores son los que quedaron escritos en Firestore el 2026-09-15 al verificar U1: la
   * clienta cambió su día al 3 desde su página y el entrenador le marcó la asistencia.
   *
   * Es la regresión de `d424286` vista desde la web. `cambiarDia` fecha el ancla AYER a
   * propósito; si la fechara hoy, la asistencia de hoy quedaría fuera de la ventana exclusiva
   * del ancla —`15 > 15` es falso— y el trío se habría quedado en `esAncla: true`, dejando a
   * la clienta en el Día 3 para siempre por muchas sesiones que hiciera.
   *
   * Lo que prueba este test es la consecuencia: con `esAncla: false`, al día siguiente el
   * ciclo da la vuelta al Día 1 en vez de quedarse trabado.
   */
  it("tras cambiar el día y asistir, al día siguiente el ciclo avanza", () => {
    const trioTrasAsistir = { dia: 2, fecha: "2026-09-15", esAncla: false };

    expect(interpretar(trioTrasAsistir, 3, "2026-09-15")).toBe(2);
    expect(interpretar(trioTrasAsistir, 3, "2026-09-16")).toBe(0);
  });

  it("si el ancla se hubiera fechado hoy, se quedaría trabado", () => {
    // El estado que habría dejado la regresión: la asistencia nunca entra en la ventana, así
    // que el trío se queda en ancla y `interpretar` devuelve el mismo día para siempre.
    const trioTrabado = { dia: 2, fecha: "2026-09-15", esAncla: true };

    expect(interpretar(trioTrabado, 3, "2026-09-16")).toBe(2);
    expect(interpretar(trioTrabado, 3, "2026-10-30")).toBe(2);
  });
});
