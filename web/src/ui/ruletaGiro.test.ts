// web/src/ui/ruletaGiro.test.ts
import { describe, expect, it } from "vitest";
import { anguloDestino } from "./ruletaGiro";

/**
 * El sector `primario` ocupa [0,180) y el `ambar` [180,360). El puntero está arriba, así que
 * el ángulo que devuelve esto es dónde tiene que quedar la rueda para que el puntero caiga
 * dentro del sector pedido.
 */
describe("anguloDestino", () => {
  it("el primario cae en la primera mitad", () => {
    expect(anguloDestino("primario", 0)).toBeGreaterThanOrEqual(0);
    expect(anguloDestino("primario", 0.999)).toBeLessThan(180);
  });

  it("el ambar cae en la segunda mitad", () => {
    expect(anguloDestino("ambar", 0)).toBeGreaterThanOrEqual(180);
    expect(anguloDestino("ambar", 0.999)).toBeLessThan(360);
  });

  // Si siempre cayera clavada en el mismo grado, se notaría que el dibujo obedece a un dato.
  it("dos tiradas del mismo color aterrizan en puntos distintos", () => {
    expect(anguloDestino("primario", 0.1)).not.toBe(anguloDestino("primario", 0.9));
  });

  // Los bordes son donde el puntero queda ambiguo: nunca debe aterrizar exactamente ahí.
  it("nunca aterriza pegada al borde del sector", () => {
    const margen = 10;
    expect(anguloDestino("primario", 0)).toBeGreaterThanOrEqual(margen);
    expect(anguloDestino("primario", 1)).toBeLessThanOrEqual(180 - margen);
    expect(anguloDestino("ambar", 0)).toBeGreaterThanOrEqual(180 + margen);
    expect(anguloDestino("ambar", 1)).toBeLessThanOrEqual(360 - margen);
  });
});
