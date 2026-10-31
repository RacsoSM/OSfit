import { describe, expect, it } from "vitest";
import { coincide, textoBusqueda } from "./buscarEjercicio";

const curl = textoBusqueda({ nombre: "Curl con mancuernas", alias: ["curl biceps", "curl alterno"] });
const jalon = textoBusqueda({ nombre: "Jalón al pecho", alias: [] });

describe("búsqueda de ejercicios", () => {
  it("sin acentos ni mayúsculas", () => {
    expect(coincide(jalon, "JALON")).toBe(true);
    expect(coincide(jalon, "jalón")).toBe(true);
  });

  it("cada palabra en cualquier parte, también a medias", () => {
    expect(coincide(curl, "curl manc")).toBe(true);
    expect(coincide(curl, "manc curl")).toBe(true);
    expect(coincide(curl, "curl barra")).toBe(false);
  });

  it("busca también en los alias", () => {
    expect(coincide(curl, "biceps")).toBe(true);
  });

  it("vacío o solo espacios coincide con todo", () => {
    expect(coincide(jalon, "")).toBe(true);
    expect(coincide(jalon, "   ")).toBe(true);
  });

  it("sin alias no truena", () => {
    expect(textoBusqueda({ nombre: "Plancha" })).toBe("plancha");
  });
});
