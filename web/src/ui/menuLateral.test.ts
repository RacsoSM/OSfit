import { describe, expect, it } from "vitest";
import { VENTANAS } from "../ventanas";
import { cabecera, marcarVentanaActiva, panelMenu } from "./menuLateral";

/** Los textos de las opciones, en el orden en que se pintaron. */
function opciones(html: string): string[] {
  return [...html.matchAll(/class="menu-texto">([^<]*)</g)].map((m) => m[1]);
}

describe("panelMenu", () => {
  const html = panelMenu(VENTANAS, "Ana");

  it("lista todas las ventanas del registro, en orden", () => {
    expect(opciones(html)).toEqual(
      ["Inicio", "Ranking", "Medallas", "Logros personales", "Videos", "Ajustes"]
    );
  });

  it("Ajustes va en el bloque del pie", () => {
    const pie = html.slice(html.indexOf(`class="menu-pie"`));
    expect(opciones(pie)).toEqual(["Ajustes"]);
  });

  it("las ventanas por venir llevan la etiqueta Pronto", () => {
    expect(html.match(/class="menu-pronto"/g)).toHaveLength(2);
  });

  it("escapa el nombre", () => {
    const raro = panelMenu(VENTANAS, "<b>Ana & Co</b>");
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

  it("el ☰ va a la derecha, después del saludo", () => {
    const html = cabecera(`<h1 id="saludo">Hola</h1>`);
    expect(html.indexOf(`id="saludo"`)).toBeLessThan(html.indexOf(`id="abrir-menu"`));
  });
});

/** Un botón de opción de mentira: solo lo que toca `marcarVentanaActiva`. */
function boton(ventana: string) {
  const clases = new Set<string>();
  const atributos = new Map<string, string>();
  return {
    dataset: { ventana },
    classList: {
      toggle(c: string, si?: boolean) { (si ? clases.add(c) : clases.delete(c)); return !!si; },
    },
    setAttribute(n: string, v: string) { atributos.set(n, v); },
    removeAttribute(n: string) { atributos.delete(n); },
    clases, atributos,
  };
}

describe("marcarVentanaActiva", () => {
  it("marca la activa y desmarca la anterior sin rehacer el panel", () => {
    const botones = [boton("inicio"), boton("medallas")];
    marcarVentanaActiva(botones, "inicio");
    marcarVentanaActiva(botones, "medallas");
    expect([...botones[0].clases]).toEqual([]);
    expect(botones[0].atributos.has("aria-current")).toBe(false);
    expect([...botones[1].clases]).toEqual(["activa"]);
    expect(botones[1].atributos.get("aria-current")).toBe("page");
  });

  it("el HTML del panel no cambia con la ventana activa, así no se repinta al navegar", () => {
    expect(panelMenu(VENTANAS, "Ana")).not.toContain("aria-current");
  });
});
