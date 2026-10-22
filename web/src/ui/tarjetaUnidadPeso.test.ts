import { describe, expect, it } from "vitest";
import { tarjetaAutollenado, tarjetaUnidadPeso } from "./tarjetaUnidadPeso";

describe("tarjetaUnidadPeso", () => {
  it("el interruptor dice si está prendido y explica qué hace", () => {
    const apagado = tarjetaUnidadPeso(false);
    expect(apagado).toContain("Registrar en libras");
    expect(apagado).toContain('aria-checked="false"');
    const prendido = tarjetaUnidadPeso(true);
    expect(prendido).toContain('aria-checked="true"');
    expect(prendido).toContain("barras, kg o libras");
    expect(prendido).toContain("se sigue viendo en kg");
  });
});

describe("tarjetaAutollenado", () => {
  it("interruptor apagado de entrada y su explicación", () => {
    const apagado = tarjetaAutollenado(false);
    expect(apagado).toContain("Autollenar con lo de la vez pasada");
    expect(apagado).toContain('aria-checked="false"');
    expect(apagado).toContain("aparece sin series");
    expect(tarjetaAutollenado(true)).toContain("tus series de la última vez");
  });
});
