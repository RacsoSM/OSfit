import { describe, expect, it } from "vitest";
import { pesoCorporalValido } from "./guardarPeso";

describe("pesoCorporalValido", () => {
  it("acepta un peso de persona y lo deja con un decimal", () => {
    expect(pesoCorporalValido(62)).toBe(62);
    expect(pesoCorporalValido(62.46)).toBe(62.5);
    expect(pesoCorporalValido(25)).toBe(25);
    expect(pesoCorporalValido(300)).toBe(300);
  });

  it("rechaza lo que no es un peso de persona", () => {
    expect(pesoCorporalValido(24.9)).toBeNull();
    expect(pesoCorporalValido(300.1)).toBeNull();
    expect(pesoCorporalValido(0)).toBeNull();
    expect(pesoCorporalValido(-60)).toBeNull();
    expect(pesoCorporalValido(Number.NaN)).toBeNull();
    expect(pesoCorporalValido(Number.POSITIVE_INFINITY)).toBeNull();
    expect(pesoCorporalValido("62")).toBeNull();
    expect(pesoCorporalValido(null)).toBeNull();
    expect(pesoCorporalValido(undefined)).toBeNull();
  });
});
