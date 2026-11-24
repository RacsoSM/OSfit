import { describe, expect, it } from "vitest";
import { esfuerzoValido } from "./esfuerzo";

describe("esfuerzoValido", () => {
  it("un entero del 1 al 10 para una sesión con id válido", () => {
    expect(esfuerzoValido({ sesionId: "abc12345", esfuerzo: 7 })).toEqual({ sesionId: "abc12345", esfuerzo: 7 });
    expect(esfuerzoValido({ sesionId: "abc12345", esfuerzo: 1 })?.esfuerzo).toBe(1);
    expect(esfuerzoValido({ sesionId: "abc12345", esfuerzo: 10 })?.esfuerzo).toBe(10);
  });
  it("rechaza fuera de rango, decimales, ids raros o datos vacíos", () => {
    for (const d of [{ sesionId: "abc12345", esfuerzo: 0 }, { sesionId: "abc12345", esfuerzo: 11 }, { sesionId: "abc12345", esfuerzo: 6.5 },
      { sesionId: "abc12345", esfuerzo: "7" }, { sesionId: "../otra", esfuerzo: 5 }, { sesionId: "corto", esfuerzo: 5 }, null, undefined]) {
      expect(esfuerzoValido(d)).toBeNull();
    }
  });
});
