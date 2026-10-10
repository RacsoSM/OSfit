import { describe, expect, it } from "vitest";
import {
  avisosDesdeDoc,
  diaDeAvisoPago,
  habilAnterior,
  idAviso,
  mensajePago,
  mensajeRacha,
  quiere,
  rachaPerdida,
  type ClienteParaAvisos,
} from "./avisosAutomaticos";

const vino = (fecha: string) => ({ fecha, asistio: true, justificada: false });
const falto = (fecha: string) => ({ fecha, asistio: false, justificada: false });
const justificada = (fecha: string) => ({ fecha, asistio: false, justificada: true });

// Septiembre 2026: lun 14, mar 15, mie 16, jue 17, vie 18, sab 19, dom 20, lun 21.
const semana = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"].map(vino);

const cliente = (c: Partial<ClienteParaAvisos> = {}): ClienteParaAvisos => ({
  id: "ana", activo: true, notificacionesWeb: true,
  avisosAutomaticos: { rachaPerdida: true, recordatorioPago: true }, fechaPago: null, ...c,
});

describe("quiere", () => {
  it("con todo prendido, sí", () => {
    expect(quiere(cliente(), "rachaPerdida")).toBe(true);
  });

  it("la llave de Notificaciones manda sobre el interruptor del aviso", () => {
    expect(quiere(cliente({ notificacionesWeb: false }), "rachaPerdida")).toBe(false);
  });

  it("una clienta pausada no recibe nada", () => {
    expect(quiere(cliente({ activo: false }), "recordatorioPago")).toBe(false);
  });

  it("cada tipo se prende por separado", () => {
    const c = cliente({ avisosAutomaticos: { recordatorioPago: true } });
    expect(quiere(c, "recordatorioPago")).toBe(true);
    expect(quiere(c, "rachaPerdida")).toBe(false);
  });
});

describe("avisosDesdeDoc", () => {
  it("sin el campo, todo apagado", () => {
    expect(avisosDesdeDoc({})).toEqual({});
  });

  it("solo true cuenta como prendido", () => {
    expect(avisosDesdeDoc({ avisosAutomaticos: { rachaPerdida: "sí", recordatorioPago: true } }))
      .toEqual({ rachaPerdida: false, recordatorioPago: true });
  });
});

describe("habilAnterior", () => {
  it("el de un martes es el lunes", () => {
    expect(habilAnterior("2026-09-15")).toBe("2026-09-14");
  });

  it("el de un lunes es el viernes", () => {
    expect(habilAnterior("2026-09-21")).toBe("2026-09-18");
  });
});

describe("rachaPerdida", () => {
  it("faltó ayer con racha de 4: avisa con la fecha y los días", () => {
    expect(rachaPerdida([...semana, falto("2026-09-18")], "2026-09-21"))
      .toEqual({ fecha: "2026-09-18", dias: 4 });
  });

  it("sin registro de ayer también es falta", () => {
    expect(rachaPerdida(semana, "2026-09-18")).toBeNull(); // hoy viernes: ayer jueves sí vino
    expect(rachaPerdida(semana.slice(0, 3), "2026-09-18")).toEqual({ fecha: "2026-09-17", dias: 3 });
  });

  it("si ayer vino, no hay nada que avisar", () => {
    expect(rachaPerdida([...semana, vino("2026-09-18")], "2026-09-21")).toBeNull();
  });

  it("si ya la revivió (justificada) antes de las 9, tampoco", () => {
    expect(rachaPerdida([...semana, justificada("2026-09-18")], "2026-09-21")).toBeNull();
  });

  it("una racha de menos de 3 días no vale aviso", () => {
    expect(rachaPerdida([vino("2026-09-16"), vino("2026-09-17")], "2026-09-21")).toBeNull();
  });

  it("en fin de semana no avisa: la página no deja revivir; la del viernes sale el lunes", () => {
    const datos = [...semana, falto("2026-09-18")];
    expect(rachaPerdida(datos, "2026-09-19")).toBeNull();
    expect(rachaPerdida(datos, "2026-09-20")).toBeNull();
    expect(rachaPerdida(datos, "2026-09-21")).not.toBeNull();
  });

  it("dos faltas seguidas: la segunda ya no tenía racha y no avisa otra vez", () => {
    expect(rachaPerdida([...semana, falto("2026-09-18"), falto("2026-09-21")], "2026-09-22")).toBeNull();
  });

  it("antes de su primer registro no era clienta", () => {
    expect(rachaPerdida([vino("2026-09-21")], "2026-09-22")).toBeNull();
    expect(rachaPerdida([], "2026-09-22")).toBeNull();
  });
});

describe("mensajeRacha", () => {
  it("con vidas, la invita a revivirla y dice cuántas", () => {
    expect(mensajeRacha(5, { vidas: 2 }).texto).toBe(
      "Se rompió tu racha de 5 días. Todavía te quedan 2 vidas: entra a tu página y revívela."
    );
    expect(mensajeRacha(5, { vidas: 1 }).texto).toContain("te queda 1 vida");
  });

  it("sin vidas, la ruleta", () => {
    expect(mensajeRacha(3, { ruleta: true }).texto).toContain("puedes jugar la ruleta");
  });

  it("sin vidas y ya jugó la ruleta, a empezar otra", () => {
    expect(mensajeRacha(3, { nada: true }).texto).toContain("¡Hoy puedes empezar una nueva!");
  });
});

describe("recordatorio de pago", () => {
  it("avisa 2 días antes y el día", () => {
    expect(diaDeAvisoPago("2026-09-20", "2026-09-18")).toBe(2);
    expect(diaDeAvisoPago("2026-09-20", "2026-09-20")).toBe(0);
  });

  it("los demás días, no", () => {
    expect(diaDeAvisoPago("2026-09-20", "2026-09-19")).toBeNull();
    expect(diaDeAvisoPago("2026-09-20", "2026-09-17")).toBeNull();
    expect(diaDeAvisoPago("2026-09-20", "2026-09-21")).toBeNull();
  });

  it("sin fecha de pago, nunca", () => {
    expect(diaDeAvisoPago(null, "2026-09-20")).toBeNull();
  });

  it("textos", () => {
    expect(mensajePago(2).titulo).toBe("Tu periodo vence en 2 días");
    expect(mensajePago(0).titulo).toBe("Tu periodo vence hoy");
  });
});

describe("idAviso", () => {
  it("fijo por tipo, clienta y ocasión", () => {
    expect(idAviso("recordatorioPago", "ana", "2026-09-20_2")).toBe("auto_recordatorioPago_ana_2026-09-20_2");
  });
});
