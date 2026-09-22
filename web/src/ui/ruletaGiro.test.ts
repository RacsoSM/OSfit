// web/src/ui/ruletaGiro.test.ts
import { describe, expect, it } from "vitest";
import {
  MARGEN,
  SECTORES,
  anguloDesdeTransform,
  arcoDelSector,
  colorBajoElPuntero,
  colorEnElDibujo,
  rotacionDestino,
} from "./ruletaGiro";

/**
 * `rotacionDestino` NO devuelve un ángulo del dibujo: devuelve la rotación que se le pasa a
 * `transform: rotate()`. Como la rueda gira en horario y el puntero es fijo a las 12, bajo el
 * puntero queda el material que estaba en `360 − rotación`. Por eso lo que se fija acá es la
 * relación puntero↔sector y no el rango del número.
 *
 * **Este archivo ya no reimplementa el reparto.** Antes tenía su propia copia del
 * `conic-gradient` y del margen, así que invertir los colores del dibujo lo habría dejado en
 * verde con el puntero señalando el color contrario — el agujero que nombran las entradas 25
 * §4 y 28 del backlog. Ahora importa `colorBajoElPuntero`, `SECTORES` y `MARGEN` de donde
 * también sale el SVG, de modo que una sola fuente manda sobre el dibujo y sobre la cuenta.
 */

describe("rotacionDestino", () => {
  // El fallo que esto fija: la rueda aterrizaba en el color contrario al que anunciaba el
  // acuse, en el 100 % de las tiradas, porque se usaba el ángulo del sector como rotación.
  it("el puntero queda sobre el color que mandó el servidor", () => {
    for (const azar of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
      expect(colorBajoElPuntero(rotacionDestino("rojo", azar))).toBe("rojo");
      expect(colorBajoElPuntero(rotacionDestino("negro", azar))).toBe("negro");
    }
  });

  // Si siempre cayera clavada en el mismo grado, se notaría que el dibujo obedece a un dato.
  it("dos tiradas del mismo color aterrizan en puntos distintos", () => {
    expect(rotacionDestino("rojo", 0.1)).not.toBe(rotacionDestino("rojo", 0.9));
  });

  // Los bordes son donde el puntero queda ambiguo: nunca debe aterrizar exactamente ahí. Las
  // costuras salen de SECTORES, así que añadir o mover un sector las mueve con él.
  it("nunca aterriza pegada al borde del sector", () => {
    const costuras = [...SECTORES.map((s) => s.desde), 360];
    const distanciaAlBorde = (rotacion: number) => {
      const enElDibujo = (((360 - (rotacion % 360)) % 360) + 360) % 360;
      return Math.min(...costuras.map((c) => Math.abs(enElDibujo - c)));
    };
    for (const { color } of SECTORES) {
      for (const azar of [0, 0.5, 1]) {
        expect(distanciaAlBorde(rotacionDestino(color, azar))).toBeGreaterThanOrEqual(MARGEN);
      }
    }
  });
});

/**
 * Lo que de verdad cierra el agujero: que el SVG que se pinta y la cuenta del aterrizaje
 * salgan del mismo sitio. Si alguien invierte los sectores, estas dos cosas cambian juntas y
 * el test de arriba lo nota; antes, con el `conic-gradient` aparte, no lo habría notado nadie.
 */
describe("el dibujo sale de SECTORES", () => {
  it("cada sector se pinta donde dice que está", () => {
    for (const s of SECTORES) {
      expect(colorEnElDibujo(s.desde)).toBe(s.color);
      expect(colorEnElDibujo((s.desde + s.hasta) / 2)).toBe(s.color);
      expect(colorEnElDibujo(s.hasta - 0.001)).toBe(s.color);
    }
  });

  // Las 12 es donde está el puntero: con la rueda sin girar, ahí se lee el primer sector.
  it("sin rotación el puntero lee el primer sector", () => {
    expect(colorBajoElPuntero(0)).toBe(SECTORES[0].color);
    expect(colorBajoElPuntero(360)).toBe(SECTORES[0].color);
  });

  // El arco empieza y termina en el borde del disco, en los grados que declara el sector.
  // Con dos medias vueltas los dos extremos son las 12 y las 6, y el flag de arco grande va
  // en 0: si alguien mete un sector de más de media vuelta, tiene que pasar a 1.
  it("el arco del sector empieza y acaba en sus propios grados", () => {
    const [primero, segundo] = SECTORES;
    expect(arcoDelSector(primero)).toBe("M100,100 L100.00,8.00 A92,92 0 0,1 100.00,192.00 Z");
    expect(arcoDelSector(segundo)).toBe("M100,100 L100.00,192.00 A92,92 0 0,1 100.00,8.00 Z");
  });

  it("un sector de mas de media vuelta pide el flag de arco grande", () => {
    expect(arcoDelSector({ desde: 0, hasta: 270 })).toContain("0 1,1");
    expect(arcoDelSector({ desde: 0, hasta: 180 })).toContain("0 0,1");
  });
});

describe("anguloDesdeTransform", () => {
  // El fallo que esto fija: sin transform, `getComputedStyle` devuelve el string "none" (no la
  // cadena vacía), y `DOMMatrixReadOnly` lo rechazaba con SyntaxError. Eso pasaba siempre que
  // la clienta tuviera "reducir movimiento" activo, porque ahí nunca hay transform inline
  // durante el giro libre, y `frenar` reventaba a mitad de una tirada ya registrada.
  it("trata 'none' como 0 grados en vez de reventar", () => {
    expect(anguloDesdeTransform("none")).toBe(0);
  });

  // Algún motor podría computar la cadena vacía para "sin transform"; también es identidad.
  it("trata la cadena vacía como 0 grados", () => {
    expect(anguloDesdeTransform("")).toBe(0);
  });
});
