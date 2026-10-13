import { describe, expect, it } from "vitest";
import { abreMenu } from "./deslizarMenu";

describe("abreMenu", () => {
  it("abre con un deslizamiento largo hacia la derecha", () => {
    expect(abreMenu(120, 10, 400)).toBe(true);
  });

  it("abre con un flick corto pero rápido", () => {
    expect(abreMenu(50, 5, 80)).toBe(true);
  });

  it("no abre hacia la izquierda", () => {
    expect(abreMenu(-150, 0, 200)).toBe(false);
  });

  it("no abre si es más bien bajar la página", () => {
    expect(abreMenu(100, 90, 300)).toBe(false);
  });

  it("no abre con un movimiento corto y lento", () => {
    expect(abreMenu(50, 0, 400)).toBe(false);
  });
});
