import { describe, expect, it } from "vitest";
import { armarTabla, nombreCorto, partidaValida, type Registro } from "./juegoDiscos";

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

describe("nombreCorto", () => {
  it("primer nombre e inicial del apellido", () => {
    expect(nombreCorto("Valeria Ruiz Pérez")).toBe("Valeria R.");
    expect(nombreCorto("  jessica   lópez ")).toBe("jessica L.");
    expect(nombreCorto("Ana")).toBe("Ana");
    expect(nombreCorto(" ")).toBe("Sin nombre");
  });
});

describe("armarTabla", () => {
  const r = (clienteId: string, nombre: string, mejor: number, mes: string | null, mejorMes: number): Registro =>
    ({ clienteId, nombre, mejor, mes, mejorMes });
  const regs = [
    r("a", "Ana Soto", 40, "2026-11", 25),
    r("b", "Bety Cruz", 60, "2026-10", 60),
    r("c", "Caro Díaz", 40, "2026-11", 40),
    r("d", "Dani Paz", 0, null, 0),
  ];
  it("este mes solo cuenta lo jugado en el mes; el histórico, el mejor de siempre", () => {
    const t = armarTabla(regs, "a", "2026-11");
    expect(t.esteMes.map((f) => [f.puesto, f.nombre, f.puntos])).toEqual([[1, "Caro D.", 40], [2, "Ana S.", 25]]);
    expect(t.historico.map((f) => [f.puesto, f.nombre, f.puntos])).toEqual([[1, "Bety C.", 60], [2, "Ana S.", 40], [2, "Caro D.", 40]]);
    expect(t.historico.find((f) => f.esTuyo)?.nombre).toBe("Ana S.");
    expect([t.tuMejor, t.tuMejorMes]).toEqual([40, 25]);
  });
  it("el récord del mes de alguien que no ha jugado este mes es 0", () => {
    const t = armarTabla(regs, "b", "2026-11");
    expect([t.tuMejor, t.tuMejorMes]).toEqual([60, 0]);
    expect(t.esteMes.some((f) => f.esTuyo)).toBe(false);
  });
});
