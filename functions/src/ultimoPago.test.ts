import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { fechaMazatlan, ultimoPagoDe } from "./ultimoPago";

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
});
