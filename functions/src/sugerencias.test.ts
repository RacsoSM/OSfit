import { describe, expect, it } from "vitest";
import { LARGO_MAXIMO_SUGERENCIA, cuerpoNotificacion, textoSugerencia } from "./sugerencias";

describe("textoSugerencia", () => {
  it("limpia los espacios y rechaza vacíos, no-texto y demasiado largos", () => {
    expect(textoSugerencia("  Más máquinas de pierna  ")).toBe("Más máquinas de pierna");
    expect(textoSugerencia("   ")).toBeNull();
    expect(textoSugerencia(42)).toBeNull();
    expect(textoSugerencia("a".repeat(LARGO_MAXIMO_SUGERENCIA))).toHaveLength(LARGO_MAXIMO_SUGERENCIA);
    expect(textoSugerencia("a".repeat(LARGO_MAXIMO_SUGERENCIA + 1))).toBeNull();
  });
});

describe("cuerpoNotificacion", () => {
  it("lleva el nombre y el texto en un renglón, recortado si es largo", () => {
    expect(cuerpoNotificacion("Valeria", "Que pongan\nmúsica")).toBe("Valeria: Que pongan música");
    const largo = cuerpoNotificacion("Valeria", "x".repeat(500));
    expect(largo.length).toBeLessThanOrEqual(300);
    expect(largo.endsWith("…")).toBe(true);
  });
});
