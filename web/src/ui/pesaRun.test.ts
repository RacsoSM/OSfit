import { describe, expect, it } from "vitest";
import { htmlCapaPesaRun, htmlPesaRun } from "./pesaRun";
import { ventanaArcade } from "./arcade";

describe("Correle pa: la ventana", () => {
  it("toda la pestaña es el juego, con su marcador Records", () => {
    const html = htmlPesaRun();
    expect(html).toContain('id="pr-pantalla"');
    expect(html).toContain(">Records<");
  });
  it("al chocar: puntos, metros, batidos, zona alcanzada, Reintentar y Ver marcador", () => {
    const fin = htmlCapaPesaRun("fin", 640, 600, 8, "nada", true, 3);
    expect(fin).toContain("¡Nuevo récord!");
    expect(fin).toContain(">640<");
    expect(fin).toContain("600 m · 8 batidos · Nivel 3, Pesas libres");
    expect(fin).toMatch(/data-pr="jugar">Reintentar</);
    expect(fin).toMatch(/data-pr="marcador">Ver marcador</);
    expect(htmlCapaPesaRun("fin", 5, 5, 1, "error", false)).toContain("1 batido ·");
    expect(htmlCapaPesaRun("fin", 5, 5, 0, "error", false)).toContain('data-pr="reintentar-guardar"');
    expect(htmlCapaPesaRun("inicio", 0, 0, 0, "nada", false)).toContain("Correle pa");
  });
  it("está en el Arcade, al final y como nuevo (Jumper ya no)", () => {
    const html = ventanaArcade({});
    expect(html.indexOf('data-arcade="boxjump"')).toBeLessThan(html.indexOf('data-arcade="pesarun"'));
    expect(html).toMatch(/ar-maquina naranja" data-arcade="pesarun"/);
    expect(html.match(/¡NUEVO!/g)?.length).toBe(1);
  });
});
