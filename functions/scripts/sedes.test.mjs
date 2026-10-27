import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { erroresSedes } from "./sedes.mjs";

const leer = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), "utf8"));
const semilla = leer("../semilla/ejercicios.json");
const archivo = leer("../../docs/sedes/sedes.json");

describe("erroresSedes", () => {
  it("el archivo de docs/sedes se puede cargar", () => {
    expect(erroresSedes(archivo, semilla)).toEqual([]);
  });

  it("rechaza ejercicios que no existen o que no son de peso", () => {
    expect(erroresSedes({ x: { nombre: "X", factores: { nada: 1 } } }, semilla)).toHaveLength(1);
    expect(erroresSedes({ x: { nombre: "X", factores: { plancha: 1 } } }, semilla)).toHaveLength(1);
  });

  it("rechaza factores fuera de rango, sin nombre o con id raro", () => {
    expect(erroresSedes({ x: { nombre: "X", factores: { "press-banca": 0 } } }, semilla)).toHaveLength(1);
    expect(erroresSedes({ x: { nombre: "X", factores: { "press-banca": 50 } } }, semilla)).toHaveLength(1);
    expect(erroresSedes({ x: { nombre: "", factores: {} } }, semilla)).toHaveLength(1);
    expect(erroresSedes({ "Smart Fit": { nombre: "X", factores: {} } }, semilla)).toHaveLength(1);
  });
});
