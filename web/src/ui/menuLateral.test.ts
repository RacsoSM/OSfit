import { describe, expect, it } from "vitest";
import { VENTANAS } from "../ventanas";
import { cabecera, panelMenu } from "./menuLateral";

/** Los textos de las opciones, en el orden en que se pintaron. */
function opciones(html: string): string[] {
  return [...html.matchAll(/class="menu-texto">([^<]*)</g)].map((m) => m[1]);
}

describe("panelMenu", () => {
  const html = panelMenu(VENTANAS, "medallas", "Ana");

  it("lista todas las ventanas del registro, en orden", () => {
    expect(opciones(html)).toEqual(
      ["Inicio", "Ranking", "Medallas", "Logros personales", "Videos", "Ajustes"]
    );
  });

  it("marca solo la ventana activa", () => {
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/class="menu-opcion activa" data-ventana="medallas"/);
  });

  it("Ajustes va en el bloque del pie", () => {
    const pie = html.slice(html.indexOf(`class="menu-pie"`));
    expect(opciones(pie)).toEqual(["Ajustes"]);
  });

  it("las ventanas por venir llevan la etiqueta Pronto", () => {
    expect(html.match(/class="menu-pronto"/g)).toHaveLength(2);
  });

  it("escapa el nombre", () => {
    const raro = panelMenu(VENTANAS, "inicio", "<b>Ana & Co</b>");
    expect(raro).toContain("&lt;b&gt;Ana &amp; Co&lt;/b&gt;");
    expect(raro).not.toContain("<b>Ana");
  });

  it("se puede cerrar con la ✕ y con el velo", () => {
    expect(html.match(/data-cerrar-menu/g)).toHaveLength(2);
  });
});

describe("cabecera", () => {
  it("trae el botón del menú con su etiqueta y el saludo adentro", () => {
    const html = cabecera(`<h1 id="saludo">Hola</h1>`);
    expect(html).toContain(`aria-label="Abrir menú"`);
    expect(html).toContain(`<h1 id="saludo">Hola</h1>`);
    expect(html).toMatch(/id="titulo-ventana" hidden/);
  });
});
