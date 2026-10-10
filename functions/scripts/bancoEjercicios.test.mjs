import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { claveBanco, documentoDe, validarSemilla } from "./bancoEjercicios.mjs";

const semilla = JSON.parse(
  readFileSync(new URL("../semilla/ejercicios.json", import.meta.url), "utf8")
);

const ejercicio = (cambios = {}) => ({
  id: "press-banca",
  nombre: "Press de banca",
  alias: ["press banca"],
  tipo: "peso",
  grupo: "pecho",
  musculos: { pecho: 1, triceps: 0.5 },
  gifOrigen: "0025",
  ...cambios,
});

describe("claveBanco", () => {
  it("ignora acentos, mayúsculas y espacios de sobra", () => {
    expect(claveBanco("  Sentadilla   BÚLGARA ")).toBe(claveBanco("sentadilla bulgara"));
    expect(claveBanco("Jalón al pecho")).toBe("jalon al pecho");
  });
});

describe("validarSemilla", () => {
  it("la semilla del repo es válida", () => {
    expect(validarSemilla(semilla)).toEqual([]);
  });

  it("detecta un alias que ya es de otro ejercicio aunque cambie el acento", () => {
    const errores = validarSemilla([
      ejercicio(),
      ejercicio({ id: "otro", nombre: "Otro", alias: ["Préss banca"] }),
    ]);
    expect(errores).toEqual(['otro: "Préss banca" ya es de press-banca']);
  });

  it("detecta músculos que no existen en los mapas", () => {
    expect(validarSemilla([ejercicio({ musculos: { pectoral: 1 } })]))
      .toEqual(['press-banca: músculo "pectoral" no está en los SVG']);
  });

  it("detecta un grupo que no existe", () => {
    expect(validarSemilla([ejercicio({ grupo: "pectoral" })]))
      .toEqual(['press-banca: grupo "pectoral" no existe']);
  });

  it("detecta un GIF que no está en el dataset", () => {
    expect(validarSemilla([ejercicio()], new Set(["0001"])))
      .toEqual(["press-banca: el GIF 0025 no está en el dataset"]);
  });
});

describe("documentoDe", () => {
  it("guarda la ruta de Storage y la atribución, no el id del dataset", () => {
    const doc = documentoDe(ejercicio(), true);
    expect(doc.gifRuta).toBe("ejercicios/press-banca.webp");
    expect(doc.atribucion).toContain("Gym visual");
    expect(doc).not.toHaveProperty("gifOrigen");
    expect(doc.grupo).toBe("pecho");
  });

  it("no pisa el nombre ni los alias que el entrenador cambió desde la app", () => {
    const doc = documentoDe(ejercicio(), true, { editadoEnApp: true });
    expect(doc).not.toHaveProperty("nombre");
    expect(doc).not.toHaveProperty("alias");
    expect(doc.gifRuta).toBe("ejercicios/press-banca.webp");
  });

  it("sin editar en la app, la semilla manda", () => {
    expect(documentoDe(ejercicio(), true, { editadoEnApp: false }).nombre).toBe("Press de banca");
    expect(documentoDe(ejercicio(), true, null).nombre).toBe("Press de banca");
  });

  it("sin GIF deja la ruta en null para que la página muestre el marcador", () => {
    expect(documentoDe(ejercicio(), false).gifRuta).toBeNull();
  });
});
