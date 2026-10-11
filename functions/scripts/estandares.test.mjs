import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { erroresEstandares } from "./estandares.mjs";

const leer = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), "utf8"));
const semilla = leer("../semilla/ejercicios.json");
const archivo = leer("../../docs/estandares-fuerza/estandares.json");

const ocho = [1, 2, 3, 4, 5, 6, 7, 8];
const bien = { estandares: { H: ocho, M: ocho }, pesoPorMancuerna: false };

describe("erroresEstandares", () => {
  it("el archivo de docs/estandares-fuerza se puede cargar", () => {
    expect(erroresEstandares(archivo, semilla)).toEqual([]);
  });

  it("rechaza ejercicios que no están en la semilla o que son de tiempo", () => {
    expect(erroresEstandares({ nada: bien }, semilla)).toHaveLength(1);
    expect(erroresEstandares({ plancha: bien }, semilla)).toHaveLength(1);
  });

  it("rechaza marcas repetidas, al revés o que no son 8", () => {
    const con = (H) => ({ "press-banca": { ...bien, estandares: { H, M: ocho } } });
    expect(erroresEstandares(con([1, 1, 3, 4, 5, 6, 7, 8]), semilla)).toHaveLength(1);
    expect(erroresEstandares(con([2, 1, 3, 4, 5, 6, 7, 8]), semilla)).toHaveLength(1);
    expect(erroresEstandares(con([1, 2, 3, 4, 5]), semilla)).toHaveLength(1);
    expect(erroresEstandares(con([0, 2, 3, 4, 5, 6, 7, 8]), semilla)).toHaveLength(1);
  });

  it("por mancuerna solo en los de peso", () => {
    expect(erroresEstandares({ lagartijas: { ...bien, pesoPorMancuerna: true } }, semilla)).toHaveLength(1);
  });
});
