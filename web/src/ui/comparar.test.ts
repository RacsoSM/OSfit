import { beforeEach, describe, expect, it } from "vitest";
import {
  elegirEnComparar, reiniciarComparar, reiniciarEleccionAmigos, sexosAComparar, ventanaComparar,
  type PersonaComparar,
} from "./comparar";

const yo: PersonaComparar = { nombre: "Ana", sexo: "M", esTuyo: true, niveles: { pecho: 3.5, biceps: 2.1 } };
const beto: PersonaComparar = { nombre: "Beto", sexo: "H", esTuyo: false, niveles: { pecho: 4.2, cuadriceps: 5 } };
const listo = { estado: "listo" as const, personas: [yo, beto] };
const svg = (m: string) => `<svg viewBox="0 0 10 20"><path class="musculo" data-musculo="${m}" d="M0 0"/></svg>`;
const mapas = {
  "/mapa-muscular-frente-mujer.svg": { estado: "listo" as const, svg: svg("pecho") },
  "/mapa-muscular-frente.svg": { estado: "listo" as const, svg: svg("cuadriceps") },
};

beforeEach(() => { reiniciarComparar(); reiniciarEleccionAmigos(); });

/** Ya eligió mostrarse: lo de siempre. */
const ya = { mostrarEnAmigos: true };

describe("lista", () => {
  it("cada una con su rango general; tú marcada", () => {
    const html = ventanaComparar(listo, "M", mapas, ya);
    expect(html).toContain("Compárate con el resto");
    expect(html).toMatch(/Ana <span class="cmp-tu">Tú<\/span>/);
    expect(html).toContain('data-persona="Beto"');
    expect(html).not.toMatch(/kg/);
  });
  it("sin músculos propios, avisa pero deja ver a las demás", () => {
    expect(ventanaComparar({ estado: "listo", personas: [beto] }, "M", mapas, ya)).toContain("Todavía no tienes músculos con rango");
  });
  it("sin sexo pide completar el perfil", () => {
    expect(ventanaComparar(listo, null, mapas, ya)).toContain("completar tu perfil");
  });
  it("error con reintentar", () => {
    expect(ventanaComparar({ estado: "error" }, "M", mapas, ya)).toContain('data-cmp="reintentar"');
  });
});

describe("comparación", () => {
  beforeEach(() => elegirEnComparar("Beto"));

  it("dos cuerpos, cada uno con el mapa de su sexo y sus colores", () => {
    const html = ventanaComparar(listo, "M", mapas, ya);
    expect(html).toContain('id="cmp-a-frente"');
    expect(html).toContain('id="cmp-b-frente"');
    // Nivel 3.5 es En forma (índice 2); nivel 5, Atlético (índice 4).
    expect(html).toMatch(/data-musculo="pecho" data-rango="2"/);
    expect(html).toMatch(/data-musculo="cuadriceps" data-rango="4"/);
  });
  it("músculo por músculo, con el más alto resaltado y — donde no hay datos", () => {
    const html = ventanaComparar(listo, "M", mapas, ya);
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
    expect(ventanaComparar({ estado: "listo", personas: [yo] }, "M", mapas, ya)).toContain("Compárate con el resto");
  });
});

describe("lista con mini cuerpos", () => {
  it("cada tarjeta dibuja su cuerpo de frente con sus colores", () => {
    const html = ventanaComparar(listo, "M", mapas, ya);
    expect(html).toContain('id="cmp-l0"');
    expect(html).toContain('id="cmp-l1"');
    expect(html).toMatch(/id="cmp-l1"[\s\S]*?data-musculo="cuadriceps" data-rango="4"/);
    expect(html).toContain("cmp-tarjeta tuya");
  });
  it("en la lista pide los mapas de todos los sexos que haya", () => {
    expect(sexosAComparar(listo, "M").sort()).toEqual(["H", "M"]);
  });
});

describe("Amigos: acceso y elección", () => {
  const listo = { estado: "listo" as const, personas: [] };
  it("sin acceso no ve nada más que el aviso", () => {
    const html = ventanaComparar(listo, "M", {}, { sinAccesoAmigos: true, mostrarEnAmigos: true });
    expect(html).toContain("no te ha dado acceso a Amigos");
    expect(html).not.toContain("cmp-grid");
  });
  it("sin elegir, pregunta antes de mostrar la lista", () => {
    const html = ventanaComparar(listo, "M", {}, {});
    expect(html).toContain("¿Quieres que los demás vean tus músculos?");
    expect(html).toContain('data-cmp="mostrar"');
    expect(html).toContain('data-cmp="ocultar"');
    expect(html).not.toContain("Compárate con el resto");
  });
  it("ya elegida, la lista dice cómo está y ofrece cambiarlo", () => {
    expect(ventanaComparar(listo, "M", {}, { mostrarEnAmigos: true })).toContain('data-cmp="ocultar"');
    const oculta = ventanaComparar(listo, "M", {}, { mostrarEnAmigos: false });
    expect(oculta).toContain("ocultos para los demás");
    expect(oculta).toContain('data-cmp="mostrar"');
  });
});
