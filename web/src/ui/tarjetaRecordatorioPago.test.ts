import { describe, expect, it } from "vitest";
import { tarjetaRecordatorioPago } from "./tarjetaRecordatorioPago";

describe("tarjetaRecordatorioPago", () => {
  it("no pinta nada si no es visible", () => {
    expect(tarjetaRecordatorioPago({ visible: false })).toBe("");
  });

  it.each([
    [2, "Tu periodo de entrenamiento vence en 2 días"],
    [1, "Tu periodo de entrenamiento vence en 1 día"],
    [0, "Tu periodo de entrenamiento vence hoy"],
  ])("%i días: verde, \"%s\"", (dias, frase) => {
    const html = tarjetaRecordatorioPago({ visible: true, dias, vencido: false });
    expect(html).toContain(frase);
    expect(html).toContain("recordatorio-pago vigente");
    expect(html).not.toContain("vencido");
  });

  it.each([
    [-1, "Tu periodo de entrenamiento venció hace 1 día"],
    [-5, "Tu periodo de entrenamiento venció hace 5 días"],
  ])("%i días: rojo, \"%s\"", (dias, frase) => {
    const html = tarjetaRecordatorioPago({ visible: true, dias, vencido: true });
    expect(html).toContain(frase);
    expect(html).toContain("recordatorio-pago vencido");
    expect(html).not.toContain("vigente");
  });

  it("nunca dice \"ayer\" ni \"en 0 días\"", () => {
    const todos = [2, 1, 0, -1, -2].map((dias) =>
      tarjetaRecordatorioPago({ visible: true, dias, vencido: dias < 0 })).join("");
    expect(todos).not.toContain("ayer");
    expect(todos).not.toContain("en 0");
    expect(todos).not.toContain("hace -");
  });
});
