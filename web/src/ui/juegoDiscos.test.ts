import { describe, expect, it } from "vitest";
import { conPartida, htmlCapa, htmlJuego, htmlLista, type TablaDiscos } from "./juegoDiscos";

const tabla: TablaDiscos = {
  filas: [
    { puesto: 1, nombre: "Bety Cruz <b>", puntos: 60, esTuyo: false },
    { puesto: 2, nombre: "Ana Soto Ruiz", puntos: 40, esTuyo: true },
    { puesto: 4, nombre: "Eva Luna", puntos: 12, esTuyo: false },
  ],
  tuMejor: 40,
};

describe("Torre de discos: la ventana", () => {
  it("toda la pestaña es el juego, con el marcador Records en una hoja, sin pestañas", () => {
    const html = htmlJuego();
    expect(html).toContain('id="jd-pantalla"');
    expect(html).toContain(">Records<");
    expect(html).not.toMatch(/Histórico|Este mes|role="tab"/);
  });

  it("la tabla: nombre completo escapado, su fila marcada y el podio", () => {
    const html = htmlLista(tabla, false);
    expect(html).toContain("Bety Cruz &lt;b&gt;");
    expect(html).toMatch(/class="tuyo podio p2"[\s\S]*Ana Soto Ruiz \(tú\)/);
    expect(html).toMatch(/class=""[\s\S]*Eva Luna/);
    expect(htmlLista({ filas: [], tuMejor: 0 }, false)).toContain("Todavía nadie ha jugado");
    expect(htmlLista(null, false)).toContain("Cargando");
    expect(htmlLista(null, true)).toContain("No se pudo cargar el marcador");
  });

  it("la capa: portada, pausa y, al perder, Reintentar o Ver marcador", () => {
    expect(htmlCapa("inicio", 0, 0, "nada", false)).toContain('data-jd="jugar"');
    expect(htmlCapa("inicio", 0, 0, "nada", false)).toContain('data-jd="marcador"');
    expect(htmlCapa("jugando", 3, 2, "nada", false)).toBe("");
    expect(htmlCapa("pausa", 3, 2, "nada", false)).toContain('data-jd="seguir"');
    const fin = htmlCapa("fin", 23, 15, "nada", true);
    expect(fin).toContain("¡Nuevo récord!");
    expect(fin).toContain("23");
    expect(fin).toContain("discos apilados");
    expect(fin).toMatch(/data-jd="jugar">Reintentar</);
    expect(fin).toMatch(/data-jd="marcador">Ver marcador</);
    expect(htmlCapa("fin", 1, 1, "error", false)).toContain('data-jd="reintentar-guardar"');
    expect(htmlCapa("fin", 1, 1, "nada", false)).not.toContain("récord");
  });

  it("al perder no dice «Guardando…»: guardar va por detrás", () => {
    expect(htmlCapa("fin", 12, 12, "nada", false)).not.toMatch(/Guardando/);
  });
});

describe("conPartida: el marcador se pone al día sin esperar al servidor", () => {
  it("si supera su récord, su fila sube y se reacomodan los lugares", () => {
    const r = conPartida(tabla, 50, "Ana Soto Ruiz");
    expect(r.record).toBe(true);
    expect(r.tabla.tuMejor).toBe(50);
    expect(r.tabla.filas.map((f) => [f.puesto, f.nombre, f.puntos])).toEqual([
      [1, "Bety Cruz <b>", 60], [2, "Ana Soto Ruiz", 50], [3, "Eva Luna", 12],
    ]);
  });
  it("si no lo supera, nada cambia", () => {
    const r = conPartida(tabla, 40, "Ana Soto Ruiz");
    expect(r.record).toBe(false);
    expect(r.tabla).toBe(tabla);
  });
  it("su primera partida: entra con su nombre; empates comparten lugar", () => {
    const r = conPartida({ filas: [{ puesto: 1, nombre: "Bety Cruz", puntos: 9, esTuyo: false }], tuMejor: 0 }, 9, "  Zoe   Paz ");
    expect(r.record).toBe(true);
    expect(r.tabla.filas.map((f) => [f.puesto, f.nombre, f.esTuyo])).toEqual([[1, "Bety Cruz", false], [1, "Zoe Paz", true]]);
  });
});
