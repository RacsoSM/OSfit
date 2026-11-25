import { describe, expect, it } from "vitest";
import { tapa } from "./espacio";

describe("Mi espacio: quién tapa a quién", () => {
  it("un árbol tapa al personaje solo si está más abajo en pantalla (más adelante)", () => {
    const arbol = { orden: 17 };
    expect(tapa(arbol, 8, 8)).toBe(true); // el personaje va detrás
    expect(tapa(arbol, 9, 9)).toBe(false); // el personaje va delante
  });

  it("un mueble solo tapa si el personaje está en la zona de atrás de la caja", () => {
    const mesita = { orden: 6.2, base: { i0: 2.5, i1: 3.7, j0: 2.7, j1: 3.5 } };
    expect(tapa(mesita, 3.0, 2.2)).toBe(true); // detrás de la mesita
    expect(tapa(mesita, 4.2, 3.9)).toBe(false); // delante
    expect(tapa(mesita, 4.0, 3.0)).toBe(false); // a un lado
    const sillon = { orden: 3.9, base: { i0: 1.2, i1: 4.9, j0: 0.25, j1: 1.45 } };
    expect(tapa(sillon, 3.0, 1.2)).toBe(false); // sentada en el sillón
    expect(tapa(sillon, 0.75, 2.8)).toBe(false); // junto a la ventana, aunque su i + j sea menor
  });
});
