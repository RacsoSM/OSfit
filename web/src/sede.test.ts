import { describe, expect, it } from "vitest";
import { bancoEnSede, factorEn, factoresDesdeDoc } from "./sede";

const banco = [
  { id: "abductores-maquina", tipo: "peso", estandares: { H: [10, 20], M: [5, 10] } },
  { id: "press-banca", tipo: "peso", estandares: { H: [30, 40], M: [15, 20] } },
  { id: "lagartijas", tipo: "corporal", estandares: { H: [3, 9], M: [1, 3] } },
];

describe("bancoEnSede", () => {
  // Donde la máquina pesa la mitad, le pide el doble: sus kilos anotados no se tocan.
  it("divide los estándares de la máquina entre su factor", () => {
    const b = bancoEnSede(banco, { "abductores-maquina": 0.5 });
    expect(b[0].estandares).toEqual({ H: [20, 40], M: [10, 20] });
  });

  it("lo que no tiene factor, o no es de peso, se queda igual", () => {
    const b = bancoEnSede(banco, { lagartijas: 2 });
    expect(b[1]).toBe(banco[1]);
    expect(b[2]).toBe(banco[2]);
  });

  it("sin sede (sin factores) el banco sale igual", () => {
    expect(bancoEnSede(banco, {})).toEqual(banco);
  });
});

describe("factores", () => {
  it("del documento solo toma números positivos", () => {
    expect(factoresDesdeDoc({ factores: { a: 0.5, b: "x", c: -1, d: 0 } })).toEqual({ a: 0.5 });
    expect(factoresDesdeDoc(undefined)).toEqual({});
  });

  it("factorEn: 1 si no está o no es de peso", () => {
    expect(factorEn({ x: 0.5 }, { id: "x", tipo: "peso" })).toBe(0.5);
    expect(factorEn({ x: 0.5 }, { id: "x", tipo: "corporal" })).toBe(1);
    expect(factorEn({}, { id: "y", tipo: "peso" })).toBe(1);
  });
});
