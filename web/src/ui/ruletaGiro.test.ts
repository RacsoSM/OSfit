// web/src/ui/ruletaGiro.test.ts
import { describe, expect, it } from "vitest";
import { rotacionDestino } from "./ruletaGiro";

/**
 * `rotacionDestino` NO devuelve un ángulo del dibujo: devuelve la rotación que se le pasa a
 * `transform: rotate()`. El sector `primario` está pintado en [0,180) y el `ambar` en
 * [180,360), medidos desde las 12 en horario, y el puntero es fijo a las 12; como la rueda
 * gira en horario, bajo el puntero queda el material que estaba en `360 − rotación`. Por eso
 * lo que se fija acá es la relación puntero↔sector y no el rango del número.
 */

/** Réplica del `conic-gradient` y del puntero de `estilos.css`: qué se lee a las 12. */
function colorBajoElPuntero(rotacion: number): "primario" | "ambar" {
  const enElDibujo = (((360 - (rotacion % 360)) % 360) + 360) % 360;
  return enElDibujo < 180 ? "primario" : "ambar";
}

describe("rotacionDestino", () => {
  // El fallo que esto fija: la rueda aterrizaba en el color contrario al que anunciaba el
  // acuse, en el 100 % de las tiradas, porque se usaba el ángulo del sector como rotación.
  it("el puntero queda sobre el color que mandó el servidor", () => {
    for (const azar of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
      expect(colorBajoElPuntero(rotacionDestino("primario", azar))).toBe("primario");
      expect(colorBajoElPuntero(rotacionDestino("ambar", azar))).toBe("ambar");
    }
  });

  // Si siempre cayera clavada en el mismo grado, se notaría que el dibujo obedece a un dato.
  it("dos tiradas del mismo color aterrizan en puntos distintos", () => {
    expect(rotacionDestino("primario", 0.1)).not.toBe(rotacionDestino("primario", 0.9));
  });

  // Los bordes son donde el puntero queda ambiguo: nunca debe aterrizar exactamente ahí.
  it("nunca aterriza pegada al borde del sector", () => {
    const margen = 10;
    const distanciaAlBorde = (rotacion: number) => {
      const enElDibujo = (((360 - (rotacion % 360)) % 360) + 360) % 360;
      return Math.min(
        Math.abs(enElDibujo - 0),
        Math.abs(enElDibujo - 180),
        Math.abs(enElDibujo - 360)
      );
    };
    for (const azar of [0, 0.5, 1]) {
      expect(distanciaAlBorde(rotacionDestino("primario", azar))).toBeGreaterThanOrEqual(margen);
      expect(distanciaAlBorde(rotacionDestino("ambar", azar))).toBeGreaterThanOrEqual(margen);
    }
  });
});
