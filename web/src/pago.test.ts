import { describe, expect, it } from "vitest";
import type { Timestamp } from "firebase/firestore";
import type { Cliente } from "./datos";
import { diasParaPago, recordatorioPago } from "./pago";

const HOY = "2026-10-08";

/** Mediodía de Mazatlán (19:00 UTC), que es como `AsignarProximoPagoDialog` guarda la fecha. */
function pagoEl(dia: string): Timestamp {
  return { toDate: () => new Date(`${dia}T19:00:00Z`) } as Timestamp;
}

function cliente(campos: Partial<Cliente> = {}): Cliente {
  return {
    nombre: "Ana", activo: true, rutinaAsignada: null,
    ultimoDia: null, ultimoDiaFecha: null, ultimoDiaEsAncla: false,
    ...campos,
  };
}

describe("diasParaPago", () => {
  it("cuenta los días que faltan", () => {
    expect(diasParaPago("2026-10-10", HOY)).toBe(2);
  });

  it("es 0 el mismo día y negativo cuando ya pasó", () => {
    expect(diasParaPago(HOY, HOY)).toBe(0);
    expect(diasParaPago("2026-10-05", HOY)).toBe(-3);
  });

  it("cruza fin de mes", () => {
    expect(diasParaPago("2026-11-01", "2026-10-30")).toBe(2);
  });

  it("cruza fin de año", () => {
    expect(diasParaPago("2027-01-01", "2026-12-31")).toBe(1);
  });

  it("no se descuadra con el cambio de horario de otros países", () => {
    // Fechas UTC puras: el 1 de noviembre de 2026 EE. UU. cambia de horario.
    expect(diasParaPago("2026-11-03", "2026-10-31")).toBe(3);
  });
});

describe("recordatorioPago", () => {
  it("con el interruptor ausente no se ve, aunque falte 1 día", () => {
    expect(recordatorioPago(cliente({ fechaProximoPago: pagoEl("2026-10-09") }), HOY))
      .toEqual({ visible: false });
  });

  it("con el interruptor apagado no se ve, aunque ya haya vencido", () => {
    const c = cliente({ recordatorioPago: false, fechaProximoPago: pagoEl("2026-10-01") });
    expect(recordatorioPago(c, HOY)).toEqual({ visible: false });
  });

  it("sin fecha de pago no se ve", () => {
    expect(recordatorioPago(cliente({ recordatorioPago: true }), HOY)).toEqual({ visible: false });
    expect(recordatorioPago(cliente({ recordatorioPago: true, fechaProximoPago: null }), HOY))
      .toEqual({ visible: false });
  });

  it("con 3 días todavía no se ve", () => {
    const c = cliente({ recordatorioPago: true, fechaProximoPago: pagoEl("2026-10-11") });
    expect(recordatorioPago(c, HOY)).toEqual({ visible: false });
  });

  it.each([
    ["2026-10-10", 2],
    ["2026-10-09", 1],
    ["2026-10-08", 0],
  ])("pago el %s: visible con %i días y vigente", (dia, dias) => {
    const c = cliente({ recordatorioPago: true, fechaProximoPago: pagoEl(dia) });
    expect(recordatorioPago(c, HOY)).toEqual({ visible: true, dias, vencido: false });
  });

  it("ya vencido: visible y vencido, por más días que pasen", () => {
    const c = cliente({ recordatorioPago: true, fechaProximoPago: pagoEl("2026-09-28") });
    expect(recordatorioPago(c, HOY)).toEqual({ visible: true, dias: -10, vencido: true });
  });
});
