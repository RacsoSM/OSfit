import { describe, expect, it } from "vitest";
import { tarjetaUnidadPeso } from "./tarjetaUnidadPeso";

describe("tarjetaUnidadPeso", () => {
  it("el interruptor dice si está prendido y explica qué hace", () => {
    const apagado = tarjetaUnidadPeso(false);
    expect(apagado).toContain("Registrar en libras");
    expect(apagado).toContain('aria-checked="false"');
    const prendido = tarjetaUnidadPeso(true);
    expect(prendido).toContain('aria-checked="true"');
    expect(prendido).toContain("libras o barras");
    expect(prendido).toContain("se sigue viendo en kg");
  });
});
