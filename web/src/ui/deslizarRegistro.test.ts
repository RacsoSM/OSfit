import { describe, expect, it } from "vitest";
import { decidirDeslizamiento } from "./deslizarRegistro";

describe("decidirDeslizamiento", () => {
  it("un deslizamiento largo a la izquierda avanza y a la derecha regresa", () => {
    expect(decidirDeslizamiento(-90, 10, 300)).toBe("siguiente");
    expect(decidirDeslizamiento(90, -10, 300)).toBe("anterior");
  });

  it("uno corto pero rápido también cuenta", () => {
    expect(decidirDeslizamiento(-40, 0, 60)).toBe("siguiente");
  });

  it("uno corto y lento no cuenta: regresa a su lugar", () => {
    expect(decidirDeslizamiento(-40, 0, 400)).toBeNull();
  });

  it("si fue más vertical que horizontal era para recorrer la página, no para cambiar", () => {
    expect(decidirDeslizamiento(-90, 120, 300)).toBeNull();
  });
});
