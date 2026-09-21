import { describe, expect, it } from "vitest";
import { DESCANSO, domingoAnterior, interpretar, lunesDe } from "./dia";

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

  it("con reinicio semanal, una asistencia de la semana pasada vuelve al día 1", () => {
    // 2026-09-11 es viernes, 2026-09-14 el lunes siguiente.
    const valor = { dia: 3, fecha: "2026-09-11", esAncla: false };
    expect(interpretar(valor, 5, "2026-09-14", true)).toBe(0);
  });

  it("con reinicio semanal, un ancla de la semana pasada también vuelve al día 1", () => {
    const valor = { dia: 2, fecha: "2026-09-09", esAncla: true };
    expect(interpretar(valor, 5, "2026-09-14", true)).toBe(0);
  });

  it("con reinicio semanal, un ancla de esta semana manda", () => {
    const valor = { dia: 2, fecha: "2026-09-09", esAncla: true };
    expect(interpretar(valor, 5, "2026-09-10", true)).toBe(2);
  });

  // La regresión que el gemelo Kotlin tuvo primero: `cambiarDia` fecha el ancla AYER, así
  // que un cambio hecho el lunes 09-14 queda fechado el domingo 09-13. Ese domingo, en ISO,
  // pertenece a la semana anterior — truncar a lunes lo reiniciaría y la clienta perdería su
  // cambio en el acto. `domingoAnterior("2026-09-14")` es exactamente "2026-09-13", y el
  // empate lo gana el ancla.
  it("con reinicio semanal, un ancla fechada en domingo es de la semana que empieza", () => {
    const valor = { dia: 2, fecha: "2026-09-13", esAncla: true };
    expect(interpretar(valor, 5, "2026-09-14", true)).toBe(2);
  });

  it("con reinicio semanal, una asistencia de ese mismo domingo sí reinicia", () => {
    const valor = { dia: 2, fecha: "2026-09-13", esAncla: false };
    expect(interpretar(valor, 5, "2026-09-14", true)).toBe(0);
  });

  it("con reinicio semanal, después del último día toca descansar", () => {
    // Día 5 hecho el viernes; el sábado ya no hay día.
    const valor = { dia: 4, fecha: "2026-09-11", esAncla: false };
    expect(interpretar(valor, 5, "2026-09-12", true)).toBe(DESCANSO);
  });

  it("con reinicio semanal, dentro de la semana avanza normal", () => {
    const valor = { dia: 1, fecha: "2026-09-08", esAncla: false };
    expect(interpretar(valor, 5, "2026-09-09", true)).toBe(2);
  });

  it("sin reinicio semanal nada cambia al cruzar la semana", () => {
    const valor = { dia: 3, fecha: "2026-09-11", esAncla: false };
    expect(interpretar(valor, 5, "2026-09-14")).toBe(4);
  });
});

describe("domingoAnterior", () => {
  it("el domingo anterior al lunes es el dia previo", () => {
    expect(domingoAnterior("2026-09-07")).toBe("2026-09-06");
  });

  it("cualquier dia de la semana da el mismo domingo", () => {
    expect(domingoAnterior("2026-09-11")).toBe("2026-09-06");
    expect(domingoAnterior("2026-09-13")).toBe("2026-09-06");
  });

  it("el lunes siguiente da el domingo que lo precede", () => {
    expect(domingoAnterior("2026-09-14")).toBe("2026-09-13");
  });
});

describe("lunesDe", () => {
  it("el lunes es su propio lunes", () => {
    expect(lunesDe("2026-09-07")).toBe("2026-09-07");
  });

  it("el viernes pertenece a la semana que empezó el lunes", () => {
    expect(lunesDe("2026-09-11")).toBe("2026-09-07");
  });

  it("el domingo cierra su semana y no abre la siguiente", () => {
    expect(lunesDe("2026-09-13")).toBe("2026-09-07");
  });

  it("el lunes siguiente ya es otra semana", () => {
    expect(lunesDe("2026-09-14")).toBe("2026-09-14");
  });
});
