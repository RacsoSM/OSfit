import { describe, expect, it } from "vitest";
import { armarTabla, nombreVisible, partidaValida, type Registro } from "./juegoDiscos";

describe("partidaValida", () => {
  it("acepta una partida posible", () => {
    expect(partidaValida({ puntos: 30, apilados: 20, duracionMs: 40_000 })).toEqual({ puntos: 30, apilados: 20, duracionMs: 40_000 });
  });
  it("rechaza puntos imposibles, discos demasiado rápidos o datos raros", () => {
    expect(partidaValida({ puntos: 50, apilados: 20, duracionMs: 40_000 })).toBeNull(); // más del doble
    expect(partidaValida({ puntos: 10, apilados: 20, duracionMs: 40_000 })).toBeNull(); // menos de uno por disco
    expect(partidaValida({ puntos: 20, apilados: 20, duracionMs: 1_000 })).toBeNull(); // 50 ms por disco
    expect(partidaValida({ puntos: 1.5, apilados: 1, duracionMs: 1_000 })).toBeNull();
    expect(partidaValida({ puntos: -1, apilados: 0, duracionMs: 0 })).toBeNull();
    expect(partidaValida("999999")).toBeNull();
    expect(partidaValida(null)).toBeNull();
  });
});

describe("nombreVisible", () => {
  it("el nombre completo, sin espacios de sobra", () => {
    expect(nombreVisible("  Valeria   Ruiz Pérez ")).toBe("Valeria Ruiz Pérez");
    expect(nombreVisible(" ")).toBe("Sin nombre");
  });
});

describe("armarTabla", () => {
  const r = (clienteId: string, nombre: string, mejor: number): Registro => ({ clienteId, nombre, mejor });
  it("la mejor de cada quien, de mayor a menor; los empates comparten lugar; quien no ha puntuado no sale", () => {
    const t = armarTabla([r("a", "Ana Soto", 40), r("b", "Bety Cruz", 60), r("c", "Caro Díaz", 40), r("d", "Dani Paz", 0), r("e", "Eva Luna", 12)], "a");
    expect(t.filas.map((f) => [f.puesto, f.nombre, f.puntos])).toEqual([
      [1, "Bety Cruz", 60], [2, "Ana Soto", 40], [2, "Caro Díaz", 40], [4, "Eva Luna", 12],
    ]);
    expect(t.filas.filter((f) => f.esTuyo).map((f) => f.nombre)).toEqual(["Ana Soto"]);
    expect(t.tuMejor).toBe(40);
  });
  it("quien no ha jugado: récord 0 y no sale en la tabla", () => {
    const t = armarTabla([r("a", "Ana Soto", 40)], "z");
    expect(t.tuMejor).toBe(0);
    expect(t.filas.some((f) => f.esTuyo)).toBe(false);
  });
});
