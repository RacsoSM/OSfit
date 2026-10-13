import { describe, expect, it } from "vitest";
import { abreMenu, ORILLA } from "./deslizarMenu";

const ANCHO = 390;
const ORILLA_X = ANCHO - 10;

describe("abreMenu", () => {
  it("abre al jalar desde la orilla derecha hacia la izquierda", () => {
    expect(abreMenu(ORILLA_X, ANCHO, -120, 10, 400)).toBe(true);
  });

  it("abre con un jalón corto pero rápido", () => {
    expect(abreMenu(ORILLA_X, ANCHO, -50, 5, 80)).toBe(true);
  });

  it("no abre si el dedo empieza lejos de la orilla", () => {
    expect(abreMenu(ANCHO - ORILLA - 1, ANCHO, -150, 0, 200)).toBe(false);
    expect(abreMenu(ANCHO / 2, ANCHO, -150, 0, 200)).toBe(false);
  });

  it("no abre hacia la derecha", () => {
    expect(abreMenu(ORILLA_X, ANCHO, 60, 0, 100)).toBe(false);
  });

  it("no abre si es más bien bajar la página", () => {
    expect(abreMenu(ORILLA_X, ANCHO, -100, 90, 300)).toBe(false);
  });

  it("no abre con un movimiento corto y lento", () => {
    expect(abreMenu(ORILLA_X, ANCHO, -50, 0, 400)).toBe(false);
  });
});
