import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { fechaMazatlan, periodoEnPalabras, textoPagoAcreditado, ultimoPagoDe } from "./ultimoPago";

describe("ultimoPago", () => {
  it("la fecha en Mazatlán", () => {
    // 2026-11-26 03:00 UTC = 25 de noviembre, 20:00 en Mazatlán.
    expect(fechaMazatlan(Timestamp.fromDate(new Date("2026-11-26T03:00:00Z")))).toBe("2026-11-25");
    expect(fechaMazatlan(null)).toBeNull();
  });

  it("copia solo fecha, monto y vencimiento; nunca la nota", () => {
    const u = ultimoPagoDe({
      fecha: Timestamp.fromDate(new Date("2026-11-20T18:00:00Z")),
      monto: 650,
      fechaProximoPagoGenerada: Timestamp.fromDate(new Date("2026-12-20T18:00:00Z")),
      nota: "le hice descuento",
    } as never);
    expect(u).toEqual({ fecha: "2026-11-20", monto: 650, vence: "2026-12-20" });
  });

  it("sin pago, o sin fecha, no hay último pago", () => {
    expect(ultimoPagoDe(undefined)).toBeNull();
    expect(ultimoPagoDe({ monto: 100 } as never)).toBeNull();
  });

  it("cuánto cubre el pago, en semanas o meses", () => {
    expect(periodoEnPalabras("2026-11-20", "2026-11-27")).toBe("1 semana");
    expect(periodoEnPalabras("2026-11-20", "2026-12-04")).toBe("2 semanas");
    expect(periodoEnPalabras("2026-11-20", "2026-12-20")).toBe("1 mes");
    expect(periodoEnPalabras("2026-01-31", "2026-02-28")).toBe("1 mes");
    expect(periodoEnPalabras("2026-11-20", "2027-02-20")).toBe("3 meses");
    expect(periodoEnPalabras("2026-11-20", null)).toBeNull();
    expect(periodoEnPalabras("2026-11-20", "2026-11-20")).toBeNull();
  });

  it("el texto de la notificación", () => {
    expect(textoPagoAcreditado({ fecha: "2026-11-20", monto: 700, vence: "2026-12-20" }))
      .toBe("Tu pago de $700 correspondiente a 1 mes fue acreditado con éxito, ¡muchas gracias!");
    expect(textoPagoAcreditado({ fecha: "2026-11-20", monto: 250, vence: "2026-11-27" }))
      .toBe("Tu pago de $250 correspondiente a 1 semana fue acreditado con éxito, ¡muchas gracias!");
    expect(textoPagoAcreditado({ fecha: "2026-11-20", monto: 0, vence: null }))
      .toBe("Tu pago fue acreditado con éxito, ¡muchas gracias!");
  });
});
