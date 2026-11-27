import { describe, expect, it } from "vitest";
import { BOX_JUMP, KETTLEBELL_BIRD, PESA_RUN, armarTabla, avisoSuperada, nombreVisible, partidaValida, superadas, type Registro } from "./juegoDiscos";

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

describe("superadas: a quién avisar que la rebasaron", () => {
  const r = (clienteId: string, mejor: number): Registro => ({ clienteId, nombre: clienteId, mejor });
  const regs = [r("yo", 30), r("said", 25), r("ana", 20), r("eva", 12), r("lia", 30), r("nueva", 0)];
  it("quienes estaban arriba o empatadas y quedaron abajo del nuevo récord", () => {
    // Iba en 18 y hace 30: rebasa a Said (25) y a Ana (20); Eva ya iba abajo; Lía empata (30), no la rebasa.
    expect(superadas(regs, "yo", 18, 30).sort()).toEqual(["ana", "said"]);
  });
  it("un empate previo que ahora rompe sí cuenta", () => {
    expect(superadas(regs, "yo", 25, 26)).toEqual(["said"]);
  });
  it("sin récord nuevo, nadie; quien no ha jugado tampoco", () => {
    expect(superadas(regs, "yo", 30, 30)).toEqual([]);
    expect(superadas(regs, "yo", 0, 5)).toEqual([]);
  });
});

describe("avisoSuperada", () => {
  it("con su nombre, el texto pedido, abre el juego y su id no se repite", () => {
    const a = avisoSuperada("said", "bogue", "  Bogue   López ", 31);
    expect(a.titulo).toBe("Bogue López te ha superado en Torre de discos");
    expect(a.texto).toBe("¡Juega para intentar quitarle su lugar en el marcador!");
    expect(a.abrir).toEqual({ ventana: "juego" });
    expect(a.id).toBe("auto_torreDiscos_said_bogue_31");
    expect(a.id).toMatch(/^[A-Za-z0-9_:.-]{1,200}$/);
  });
});

describe("Kettlebell Bird", () => {
  it("cada barra es un punto y tarda al menos 0.35 s (el nivel más alto va a ~0.47 s)", () => {
    expect(partidaValida({ puntos: 20, apilados: 20, duracionMs: 15_000 }, KETTLEBELL_BIRD)).toEqual({ puntos: 20, apilados: 20, duracionMs: 15_000 });
    expect(partidaValida({ puntos: 40, apilados: 20, duracionMs: 15_000 }, KETTLEBELL_BIRD)).toBeNull();
    expect(partidaValida({ puntos: 20, apilados: 20, duracionMs: 9_500 }, KETTLEBELL_BIRD)).not.toBeNull();
    expect(partidaValida({ puntos: 20, apilados: 20, duracionMs: 5_000 }, KETTLEBELL_BIRD)).toBeNull();
  });
  it("su aviso dice el juego y abre su ventana; no choca con los de Torre de discos", () => {
    const a = avisoSuperada("said", "bogue", "Bogue", 31, KETTLEBELL_BIRD);
    expect(a.titulo).toBe("Bogue te ha superado en Fit Bird");
    expect(a.abrir).toEqual({ ventana: "kettlebell" });
    expect(a.id).toBe("auto_kettlebellBird_said_bogue_31");
    expect(avisoSuperada("said", "bogue", "Bogue", 31).id).toBe("auto_torreDiscos_said_bogue_31");
  });
});

describe("Box Jump", () => {
  it("cada metro es un punto; subir más rápido que el trampolín es imposible", () => {
    expect(partidaValida({ puntos: 120, apilados: 120, duracionMs: 60_000 }, BOX_JUMP)).not.toBeNull();
    expect(partidaValida({ puntos: 120, apilados: 120, duracionMs: 3_000 }, BOX_JUMP)).toBeNull();
    expect(partidaValida({ puntos: 240, apilados: 120, duracionMs: 60_000 }, BOX_JUMP)).toBeNull();
  });
  it("su aviso dice el juego y abre su ventana", () => {
    const a = avisoSuperada("said", "bogue", "Bogue", 87, BOX_JUMP);
    expect(a.titulo).toBe("Bogue te ha superado en Jumper");
    expect(a.abrir).toEqual({ ventana: "boxjump" });
    expect(a.id).toBe("auto_boxJump_said_bogue_87");
  });
});

describe("Pesa Run", () => {
  it("metros y batidos son puntos; más rápido que corriendo a tope con batidos es imposible", () => {
    expect(partidaValida({ puntos: 1500, apilados: 1500, duracionMs: 90_000 }, PESA_RUN)).not.toBeNull();
    expect(partidaValida({ puntos: 1500, apilados: 1500, duracionMs: 5_000 }, PESA_RUN)).toBeNull();
    expect(partidaValida({ puntos: 3000, apilados: 1500, duracionMs: 90_000 }, PESA_RUN)).toBeNull();
  });
  it("su aviso dice el juego y abre su ventana", () => {
    const a = avisoSuperada("said", "bogue", "Bogue", 640, PESA_RUN);
    expect(a.titulo).toBe("Bogue te ha superado en Pesa Run");
    expect(a.abrir).toEqual({ ventana: "pesarun" });
    expect(a.id).toBe("auto_pesaRun_said_bogue_640");
  });
});
