import { describe, expect, it } from "vitest";
import { htmlBoxJump, htmlCapaBoxJump } from "./boxJump";
import { ventanaArcade } from "./arcade";

describe("Box Jump: la ventana", () => {
  it("toda la pestaña es el juego, con su marcador Records", () => {
    const html = htmlBoxJump();
    expect(html).toContain('id="bj-pantalla"');
    expect(html).toContain(">Records<");
  });
  it("al caer: metros, piso alcanzado, Reintentar y Ver marcador", () => {
    const fin = htmlCapaBoxJump("fin", 87, "nada", true, 3);
    expect(fin).toContain("¡Nuevo récord!");
    expect(fin).toContain("87 m");
    expect(fin).toContain("Piso 3, Cardio");
    expect(fin).toMatch(/data-bj="jugar">Reintentar</);
    expect(fin).toMatch(/data-bj="marcador">Ver marcador</);
    expect(htmlCapaBoxJump("fin", 5, "error", false)).toContain('data-bj="reintentar-guardar"');
    expect(htmlCapaBoxJump("inicio", 0, "nada", false)).toContain("Box Jump");
  });
  it("está en el Arcade, primero y como nuevo", () => {
    const html = ventanaArcade({});
    expect(html.indexOf('data-arcade="boxjump"')).toBeLessThan(html.indexOf('data-arcade="kettlebell"'));
    expect(html).toMatch(/ar-maquina lima" data-arcade="boxjump"/);
  });
});
