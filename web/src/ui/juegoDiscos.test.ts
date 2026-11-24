import { describe, expect, it } from "vitest";
import { htmlCapa, htmlJuego, htmlLista, type TablaDiscos } from "./juegoDiscos";

const tabla: TablaDiscos = {
  filas: [
    { puesto: 1, nombre: "Bety Cruz <b>", puntos: 60, esTuyo: false },
    { puesto: 2, nombre: "Ana Soto Ruiz", puntos: 40, esTuyo: true },
    { puesto: 4, nombre: "Eva Luna", puntos: 12, esTuyo: false },
  ],
  tuMejor: 40,
};

describe("Torre de discos: la ventana", () => {
  it("una sola tabla, Records, sin pestañas", () => {
    const html = htmlJuego();
    expect(html).toContain(">Records<");
    expect(html).not.toMatch(/Histórico|Este mes|role="tab"/);
    expect(html).toContain("Tu lugar");
  });

  it("la tabla: nombre completo escapado, su fila marcada y el podio", () => {
    const html = htmlLista(tabla, false);
    expect(html).toContain("Bety Cruz &lt;b&gt;");
    expect(html).toMatch(/class="tuyo podio p2"[\s\S]*Ana Soto Ruiz \(tú\)/);
    expect(html).toMatch(/class=""[\s\S]*Eva Luna/);
    expect(htmlLista({ filas: [], tuMejor: 0 }, false)).toContain("Todavía nadie ha jugado");
    expect(htmlLista(null, false)).toContain("Cargando");
    expect(htmlLista(null, true)).toContain("No se pudo cargar");
  });

  it("la capa: instrucciones, pausa y el resultado con récord y reintento", () => {
    expect(htmlCapa("inicio", 0, 0, "nada", false)).toContain('data-jd="jugar"');
    expect(htmlCapa("jugando", 3, 2, "nada", false)).toBe("");
    expect(htmlCapa("pausa", 3, 2, "nada", false)).toContain('data-jd="seguir"');
    const fin = htmlCapa("fin", 23, 15, "guardado", true);
    expect(fin).toContain("¡Nuevo récord!");
    expect(fin).toContain("23");
    expect(fin).toContain("15 discos");
    expect(htmlCapa("fin", 1, 1, "error", false)).toContain('data-jd="reintentar"');
    expect(htmlCapa("fin", 1, 1, "guardado", false)).not.toContain("récord");
  });
});
