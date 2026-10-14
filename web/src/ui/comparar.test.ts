import { beforeEach, describe, expect, it } from "vitest";
import { elegirEnComparar, reiniciarComparar, sexosAComparar, ventanaComparar, type PersonaComparar } from "./comparar";

const yo: PersonaComparar = { nombre: "Ana", sexo: "M", esTuyo: true, niveles: { pecho: 3.5, biceps: 2.1 } };
const beto: PersonaComparar = { nombre: "Beto", sexo: "H", esTuyo: false, niveles: { pecho: 4.2, cuadriceps: 5 } };
const listo = { estado: "listo" as const, personas: [yo, beto] };
const svg = (m: string) => `<svg viewBox="0 0 10 20"><path class="musculo" data-musculo="${m}" d="M0 0"/></svg>`;
const mapas = {
  "/mapa-muscular-frente-mujer.svg": { estado: "listo" as const, svg: svg("pecho") },
  "/mapa-muscular-frente.svg": { estado: "listo" as const, svg: svg("cuadriceps") },
};

beforeEach(() => reiniciarComparar());

describe("lista", () => {
  it("cada una con su rango general; tú marcada", () => {
    const html = ventanaComparar(listo, "M", mapas);
    expect(html).toContain("Compárate con el resto");
    expect(html).toMatch(/Ana <span class="cmp-tu">Tú<\/span>/);
    expect(html).toContain('data-persona="Beto"');
    expect(html).not.toMatch(/kg/);
  });
  it("sin músculos propios, avisa pero deja ver a las demás", () => {
    expect(ventanaComparar({ estado: "listo", personas: [beto] }, "M", mapas)).toContain("Todavía no tienes músculos con rango");
  });
  it("sin sexo pide completar el perfil", () => {
    expect(ventanaComparar(listo, null, mapas)).toContain("completar tu perfil");
  });
  it("error con reintentar", () => {
    expect(ventanaComparar({ estado: "error" }, "M", mapas)).toContain('data-cmp="reintentar"');
  });
});

describe("comparación", () => {
  beforeEach(() => elegirEnComparar("Beto"));

  it("dos cuerpos, cada uno con el mapa de su sexo y sus colores", () => {
    const html = ventanaComparar(listo, "M", mapas);
    expect(html).toContain('id="cmp-a-frente"');
    expect(html).toContain('id="cmp-b-frente"');
    // Nivel 3.5 es En forma (índice 2); nivel 5, Atlético (índice 4).
    expect(html).toMatch(/data-musculo="pecho" data-rango="2"/);
    expect(html).toMatch(/data-musculo="cuadriceps" data-rango="4"/);
  });
  it("músculo por músculo, con el más alto resaltado y — donde no hay datos", () => {
    const html = ventanaComparar(listo, "M", mapas);
    expect(html).toContain('data-musculo-cmp="pecho"');
    expect(html).toContain('data-musculo-cmp="cuadriceps"');
    expect(html).toContain('data-musculo-cmp="biceps"');
    expect(html).toMatch(/data-musculo-cmp="pecho"[\s\S]*?cmp-celda"[\s\S]*?cmp-celda gana/);
    expect(html).toContain('cmp-celda sin">—');
  });
  it("pide los mapas de los dos sexos", () => {
    expect(sexosAComparar(listo, "M").sort()).toEqual(["H", "M"]);
  });
  it("si ya no está en la lista, regresa a la lista", () => {
    expect(ventanaComparar({ estado: "listo", personas: [yo] }, "M", mapas)).toContain("Compárate con el resto");
  });
});

describe("lista con mini cuerpos", () => {
  it("cada tarjeta dibuja su cuerpo de frente con sus colores", () => {
    const html = ventanaComparar(listo, "M", mapas);
    expect(html).toContain('id="cmp-l0"');
    expect(html).toContain('id="cmp-l1"');
    expect(html).toMatch(/id="cmp-l1"[\s\S]*?data-musculo="cuadriceps" data-rango="4"/);
    expect(html).toContain("cmp-tarjeta tuya");
  });
  it("en la lista pide los mapas de todos los sexos que haya", () => {
    expect(sexosAComparar(listo, "M").sort()).toEqual(["H", "M"]);
  });
});
