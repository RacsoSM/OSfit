// web/src/ui/ruleta.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { abrirRuleta, cerrarRuleta, elegirColor, modalRuleta, marcarResultado } from "./ruleta";
import { SECTORES } from "./ruletaGiro";

beforeEach(() => cerrarRuleta());

describe("modalRuleta", () => {
  it("cerrada no pinta nada", () => {
    expect(modalRuleta()).toBe("");
  });

  it("abierta pinta la propuesta con el costo y el premio", () => {
    abrirRuleta();
    const html = modalRuleta();
    expect(html).toContain("Te propongo un juego");
    expect(html).toContain("te revivo tu racha");
    expect(html).toContain("2 oportunidades para revivir en vez de 3");
    expect(html).toContain("¿Quieres jugar?");
  });

  it("abierta ofrece la salida sin costo", () => {
    abrirRuleta();
    expect(modalRuleta()).toContain(`id="ruleta-cerrar"`);
  });

  // Tocar "Jugar" ES la apuesta. Sin color elegido no puede apostarse por accidente.
  it("Jugar esta deshabilitado hasta elegir color", () => {
    abrirRuleta();
    expect(modalRuleta()).toMatch(/id="ruleta-jugar"[^>]*disabled/);
    elegirColor("rojo");
    expect(modalRuleta()).not.toMatch(/id="ruleta-jugar"[^>]*disabled/);
  });

  it("la tirada de prueba siempre esta disponible y se rotula como falsa", () => {
    abrirRuleta();
    expect(modalRuleta()).toContain(`id="ruleta-prueba"`);
    marcarResultado({ tipo: "prueba", color: "negro" });
    expect(modalRuleta()).toContain("esta no cuenta");
  });

  // Que un toque impaciente convierta un ensayo en la apuesta real seria el peor fallo
  // posible de esta pantalla.
  it("durante una prueba girando, Jugar queda deshabilitado", () => {
    abrirRuleta();
    elegirColor("rojo");
    marcarResultado({ tipo: "girando-prueba" });
    expect(modalRuleta()).toMatch(/id="ruleta-jugar"[^>]*disabled/);
  });

  it("al perder nombra el costo, no solo dice que perdio", () => {
    abrirRuleta();
    marcarResultado({ tipo: "perdio", color: "rojo" });
    const html = modalRuleta();
    expect(html).toContain("2 revives en vez de 3");
    expect(html).not.toMatch(/^Perdiste\.?$/);
  });

  it("al ganar lo dice y no menciona castigo", () => {
    abrirRuleta();
    marcarResultado({ tipo: "gano", color: "rojo" });
    const html = modalRuleta();
    expect(html).toContain("Has revivido tu racha");
    expect(html).not.toContain("en vez de 3");
  });

  // Desde el error se vuelve a apostar, asi que es el unico estado en el que podria apostarse
  // sin las condiciones delante.
  it("tras un error sigue mostrando la propuesta que se va a reapostar", () => {
    abrirRuleta();
    marcarResultado({ tipo: "error", texto: "No pudimos girar la ruleta." });
    const html = modalRuleta();
    expect(html).toContain("Te propongo un juego");
    expect(html).toContain("2 oportunidades para revivir en vez de 3");
    expect(html).toContain("No pudimos girar la ruleta.");
  });

  it("mientras gira no dibuja la salida: la apuesta ya esta cobrada", () => {
    abrirRuleta();
    marcarResultado({ tipo: "girando-real" });
    expect(modalRuleta()).not.toContain(`id="ruleta-cerrar"`);
  });
  /**
   * El acuse tiene que nombrar lo que la clienta ve. Se detectó al revés el 2026-09-22: los
   * colores salían de la paleta (`var(--primario)`), el nombre estaba escrito a mano, y una
   * clienta en turquesa leía "Cayó en morado" con la rueda verde agua (entrada 26 del
   * backlog). Se arregló fijando los colores a rojo y negro, así que ahora el nombre puede
   * volver a ser el tono — y este test es lo que amarra las dos puntas.
   */
  it("el acuse nombra el color que de verdad se pinta", () => {
    for (const { color } of SECTORES) {
      for (const tipo of ["gano", "perdio", "prueba"] as const) {
        abrirRuleta();
        marcarResultado({ tipo, color });
        expect(modalRuleta()).toContain(`Cayó en ${color}.`);
      }
    }
  });

  // Si alguien vuelve a atar la rueda a la paleta, el nombre vuelve a mentir. Esto lo nota:
  // los sectores y las fichas se marcan con el nombre del color, no con el de una variable.
  it("el dibujo no depende de la paleta de la clienta", () => {
    abrirRuleta();
    const html = modalRuleta();
    expect(html).not.toContain("primario");
    expect(html).not.toContain("ambar");
    for (const { color } of SECTORES) {
      expect(html).toContain(`ruleta-sector ${color}`);
      expect(html).toContain(`ruleta-ficha ${color}`);
    }
  });

  // Las dos frases piden gramática distinta y salen del mismo sitio: si alguien unifica los
  // nombres en una sola cadena, una de las dos queda mal escrita.
  it("las fichas se anuncian con la preposicion correcta", () => {
    abrirRuleta();
    const html = modalRuleta();
    expect(html).toContain('aria-label="Apostar al rojo"');
    expect(html).toContain('aria-label="Apostar al negro"');
  });

  // Sólo el `<g>` gira: `girarLibre` y `frenar` buscan `#ruleta-rueda`, y si ese id acabara en
  // el `<svg>` entero el aro metálico daría vueltas con el disco.
  it("el id que gira esta en el grupo, no en el svg", () => {
    abrirRuleta();
    expect(modalRuleta()).toMatch(/<g class="ruleta-rueda" id="ruleta-rueda">/);
  });
});
