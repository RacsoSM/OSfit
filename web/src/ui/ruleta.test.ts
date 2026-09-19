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

  it("mientras gira no dibuja la salida: la apuesta ya esta cobrada", () => {
    abrirRuleta();
    marcarResultado({ tipo: "girando-real" });
    expect(modalRuleta()).not.toContain(`id="ruleta-cerrar"`);
  });
});
