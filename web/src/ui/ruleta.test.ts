// web/src/ui/ruleta.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { abrirRuleta, cerrarRuleta, elegirColor, modalRuleta, marcarResultado } from "./ruleta";

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
    elegirColor("primario");
    expect(modalRuleta()).not.toMatch(/id="ruleta-jugar"[^>]*disabled/);
  });

  it("la tirada de prueba siempre esta disponible y se rotula como falsa", () => {
    abrirRuleta();
    expect(modalRuleta()).toContain(`id="ruleta-prueba"`);
    marcarResultado({ tipo: "prueba", color: "ambar" });
    expect(modalRuleta()).toContain("esta no cuenta");
  });

  // Que un toque impaciente convierta un ensayo en la apuesta real seria el peor fallo
  // posible de esta pantalla.
  it("durante una prueba girando, Jugar queda deshabilitado", () => {
    abrirRuleta();
    elegirColor("primario");
    marcarResultado({ tipo: "girando-prueba" });
    expect(modalRuleta()).toMatch(/id="ruleta-jugar"[^>]*disabled/);
  });

  it("al perder nombra el costo, no solo dice que perdio", () => {
    abrirRuleta();
    marcarResultado({ tipo: "perdio", color: "primario" });
    const html = modalRuleta();
    expect(html).toContain("2 revives en vez de 3");
    expect(html).not.toMatch(/^Perdiste\.?$/);
  });

  it("al ganar lo dice y no menciona castigo", () => {
    abrirRuleta();
    marcarResultado({ tipo: "gano", color: "primario" });
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
   * El sector y la ficha del primario son `var(--primario)`: la paleta que el entrenador le
   * asigna a cada clienta. Nombrar el tono a mano ("morado") sólo acierta con la paleta de
   * por defecto, y con cualquier otra la clienta lee un color que no tiene delante — en la
   * frase que le dice si ganó. Se detectó el 2026-09-22 con una clienta en turquesa, que leía
   * "Cayó en morado" con la rueda verde agua.
   */
  it("el acuse no nombra el tono del primario, que lo pone la paleta de cada clienta", () => {
    for (const tipo of ["gano", "perdio", "prueba"] as const) {
      abrirRuleta();
      marcarResultado({ tipo, color: "primario" });
      const html = modalRuleta();
      expect(html).toContain("Cayó en tu color.");
      expect(html).not.toContain("morado");
    }
  });

  // El ámbar no sale de la paleta: es el mismo para todas, así que ése sí se nombra.
  it("el ambar si se nombra, porque no depende de la paleta", () => {
    abrirRuleta();
    marcarResultado({ tipo: "gano", color: "ambar" });
    expect(modalRuleta()).toContain("Cayó en el ámbar.");
  });

  // Las dos frases piden gramática distinta, y salen del mismo sitio: si alguien unifica los
  // nombres en una sola cadena, una de las dos queda mal escrita.
  it("las fichas se anuncian con la preposicion correcta", () => {
    abrirRuleta();
    const html = modalRuleta();
    expect(html).toContain('aria-label="Apostar a tu color"');
    expect(html).toContain('aria-label="Apostar al ámbar"');
  });
});
