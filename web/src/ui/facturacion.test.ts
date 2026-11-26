import { describe, expect, it } from "vitest";
import type { Cliente } from "../datos";
import { SIN_ACCESO, estadoPeriodo, fechaLarga, pesos, ventanaFacturacion } from "./facturacion";

const HOY = "2026-11-26";
const base = { nombre: "Ana", activo: true } as Cliente;
const conPago = {
  ...base, facturacionWeb: true, mensualidad: 700,
  ultimoPago: { fecha: "2026-11-20", monto: 650, vence: "2026-12-20" },
} as Cliente;

describe("Facturación", () => {
  it("sin acceso, el aviso del entrenador y nada más", () => {
    const html = ventanaFacturacion(base, HOY, null);
    expect(html).toContain(SIN_ACCESO);
    expect(html).not.toContain("Tu periodo");
  });

  it("con acceso: periodo, último pago, vencimiento y mensualidad", () => {
    const html = ventanaFacturacion(conPago, HOY, null);
    expect(html).toContain("Del 20 de noviembre de 2026");
    expect(html).toContain("al 20 de diciembre de 2026");
    expect(html).toContain("Te quedan 24 días");
    expect(html).toContain("$650");
    expect(html).toContain("Tu mensualidad");
    expect(html).toContain("$700");
    expect(html).toContain("Pídele a tu coach los datos para pagar.");
  });

  it("sin mensualidad usa el monto del último pago; sin pagos lo dice", () => {
    expect(ventanaFacturacion({ ...conPago, mensualidad: null }, HOY, null)).toMatch(/Tu mensualidad<\/span><b>\$650/);
    expect(ventanaFacturacion({ ...base, facturacionWeb: true }, HOY, null)).toContain("Todavía no hay pagos registrados.");
  });

  it("los datos para pagar, renglón por renglón", () => {
    const html = ventanaFacturacion(conPago, HOY, { lineas: [{ etiqueta: "Banco", valor: "BBVA" }, { etiqueta: "CLABE", valor: "0123 <b>" }], nota: "Manda tu comprobante" });
    expect(html).toContain("BBVA");
    expect(html).toContain("0123 &lt;b&gt;");
    expect(html).toContain("Manda tu comprobante");
  });

  it("el estado del periodo", () => {
    expect(estadoPeriodo("2026-11-26", HOY)).toEqual({ texto: "Vence hoy", tono: "pronto" });
    expect(estadoPeriodo("2026-11-27", HOY).texto).toBe("Vence mañana");
    expect(estadoPeriodo("2026-11-25", HOY)).toEqual({ texto: "Venció ayer", tono: "vencido" });
    expect(estadoPeriodo("2026-11-20", HOY).texto).toBe("Venció hace 6 días");
    expect(estadoPeriodo("2026-11-30", HOY).tono).toBe("pronto");
    expect(estadoPeriodo("2026-12-20", HOY).tono).toBe("bien");
  });

  it("fechas y pesos", () => {
    expect(fechaLarga("2026-01-05")).toBe("5 de enero de 2026");
    expect(pesos(1250.5)).toBe("$1,250.50");
    expect(pesos(650)).toBe("$650");
  });
});
