import { describe, expect, it } from "vitest";
import {
  COLORES_PETALO, avanzarPetalo, brisa, crearPetalo, empujonDeToque, rafagaDePetalos, type Petalo,
} from "./petalos";

/** Un azar repetible: siempre el mismo pétalo. */
const fijo = (v: number) => () => v;

function petalo(campos: Partial<Petalo> = {}): Petalo {
  return { ...crearPetalo(fijo(0.5), 400, 800, 4, 8, false), ...campos };
}

describe("crearPetalo", () => {
  it("nace dentro de la ventana, o justo encima si se suelta desde arriba", () => {
    const enMedio = crearPetalo(fijo(0.5), 400, 800, 4, 8, false);
    expect(enMedio.y).toBeGreaterThanOrEqual(0);
    expect(enMedio.y).toBeLessThanOrEqual(800);
    expect(crearPetalo(fijo(0.5), 400, 800, 4, 8, true).y).toBeLessThan(0);
  });

  it("respeta el tamaño pedido y usa un rosa del catálogo", () => {
    for (const v of [0, 0.5, 0.999]) {
      const p = crearPetalo(fijo(v), 400, 800, 4, 8, false);
      expect(p.tam).toBeGreaterThanOrEqual(4);
      expect(p.tam).toBeLessThanOrEqual(8);
      expect(COLORES_PETALO).toContain(p.color);
    }
  });

  it("los grandes caen más rápido: pesan más", () => {
    expect(crearPetalo(fijo(0.5), 400, 800, 12, 12, false).vy)
      .toBeGreaterThan(crearPetalo(fijo(0.5), 400, 800, 4, 4, false).vy);
  });
});

describe("avanzarPetalo", () => {
  it("cae", () => {
    const p = petalo({ y: 100 });
    avanzarPetalo(p, 0.5, 0, 400, 800);
    expect(p.y).toBeGreaterThan(100);
  });

  it("avisa cuando ya salió por abajo, para soltarlo otra vez arriba", () => {
    expect(avanzarPetalo(petalo({ y: 790 }), 1, 0, 400, 800)).toBe(false);
    expect(avanzarPetalo(petalo({ y: 100 }), 0.016, 0, 400, 800)).toBe(true);
  });

  it("la brisa lo lleva a la derecha", () => {
    const calmo = petalo();
    const con = petalo();
    avanzarPetalo(calmo, 0.5, 0, 400, 800);
    avanzarPetalo(con, 0.5, 40, 400, 800);
    expect(con.x - calmo.x).toBeCloseTo(20, 5);
  });

  it("al salir por un costado entra por el otro", () => {
    const p = petalo({ x: 430, empuje: 0, amplitud: 0 });
    avanzarPetalo(p, 0.1, 200, 400, 800);
    expect(p.x).toBeLessThan(0);
  });

  it("el empujón de una ráfaga se apaga solo", () => {
    const p = petalo({ empuje: 200 });
    avanzarPetalo(p, 1, 0, 400, 800);
    expect(Math.abs(p.empuje)).toBeLessThan(50);
  });
});

describe("empujonDeToque", () => {
  it("aparta el pétalo del dedo, hacia el lado en que está", () => {
    expect(empujonDeToque(petalo({ x: 250, y: 300 }), 200, 300)).toBeGreaterThan(0);
    expect(empujonDeToque(petalo({ x: 150, y: 300 }), 200, 300)).toBeLessThan(0);
  });

  it("empuja más a los que están cerca", () => {
    const cerca = Math.abs(empujonDeToque(petalo({ x: 220, y: 300 }), 200, 300));
    const lejos = Math.abs(empujonDeToque(petalo({ x: 380, y: 700 }), 200, 300));
    expect(cerca).toBeGreaterThan(lejos * 5);
  });
});

describe("brisa", () => {
  it("siempre sopla hacia la derecha, más o menos fuerte", () => {
    for (let t = 0; t < 120; t += 0.7) expect(brisa(t)).toBeGreaterThan(0);
  });
});

describe("rafagaDePetalos", () => {
  it("da un estilo por pétalo, con todas sus variables", () => {
    const r = rafagaDePetalos(5, fijo(0.3));
    expect(r).toHaveLength(5);
    for (const v of ["--y:", "--caida:", "--retraso:", "--tam:", "--vueltas:", "--color:"]) {
      expect(r[0]).toContain(v);
    }
  });

  it("nunca mete comillas: va dentro de un atributo style", () => {
    expect(rafagaDePetalos(20).join("")).not.toMatch(/["<>]/);
  });
});
