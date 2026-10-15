import { describe, expect, it } from "vitest";
import {
  NOMBRES_MUSCULO, edadEn, factorEdad, factorPeso, fuerzaPorMusculo, pesoParaFuerza, indiceRango, marcaPara, nivelDe, rangoGeneral, repartoRangos,
  siguienteRango, nombreMusculo, nombreRango, percentilDe,
  percentilEntrenanDe, rangoDe, unoRm,
} from "./fuerza";
import type { EjercicioBanco, Sesion } from "./datos";
import type { FuerzaMusculo } from "./fuerza";
import modelo from "../../docs/estandares-fuerza/percentiles.json";
import frenteH from "../public/mapa-muscular-frente.svg?raw";
import espaldaH from "../public/mapa-muscular-espalda.svg?raw";
import frenteM from "../public/mapa-muscular-frente-mujer.svg?raw";
import espaldaM from "../public/mapa-muscular-espalda-mujer.svg?raw";

describe("rangoDe", () => {
  it("cada rango empieza al alcanzar su estándar", () => {
    expect(rangoDe(0).nombre).toBe("Principiante");
    expect(rangoDe(1.99).nombre).toBe("Principiante");
    expect(rangoDe(2).nombre).toBe("Novato");
    expect(rangoDe(3).nombre).toBe("En forma");
    expect(rangoDe(4.5).nombre).toBe("Intermedio");
    expect(rangoDe(5).nombre).toBe("Atlético");
    expect(rangoDe(6).nombre).toBe("Fuerte");
    expect(rangoDe(7.99).nombre).toBe("Avanzado");
    expect(rangoDe(8).nombre).toBe("Élite");
  });

  it("fuera de la escala se queda en sus orillas", () => {
    expect(rangoDe(-3).nombre).toBe("Principiante");
    expect(rangoDe(12).nombre).toBe("Élite");
  });
});

describe("indiceRango", () => {
  it("el número de su rango, de 0 (Principiante) a 7 (Élite)", () => {
    expect([0, 1.5, 2, 3, 4, 5, 6, 7, 8, 10].map(indiceRango)).toEqual([0, 0, 1, 2, 3, 4, 5, 6, 7, 7]);
  });
});

describe("nombreRango", () => {
  it("Atlético va en femenino para ellas; los demás no cambian", () => {
    expect(nombreRango(5, "M")).toBe("Atlética");
    expect(nombreRango(5, "H")).toBe("Atlético");
    expect(nombreRango(8, "M")).toBe("Élite");
  });
});

describe("percentilDe (contra toda la población)", () => {
  it("en cada estándar da su porcentaje", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(percentilDe)).toEqual([1, 38, 60, 72, 82, 88, 90, 93, 97]);
  });

  it("los porcentajes son los del modelo de docs/estandares-fuerza (percentiles.json)", () => {
    const [, ...poblacion] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(percentilDe);
    const [, ...entrenan] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(percentilEntrenanDe);
    expect(poblacion).toEqual(modelo.poblacion);
    expect(entrenan).toEqual(modelo.entrenan);
  });

  it("entre estándares interpola", () => {
    expect(percentilDe(5.5)).toBe(89);
  });

  it("nunca 0 % ni 100 %", () => {
    expect(percentilDe(-1)).toBe(1);
    expect(percentilDe(99)).toBe(97);
  });

  it("sube siempre con el nivel", () => {
    for (let n = 0; n < 8; n += 0.25) expect(percentilDe(n + 0.25)).toBeGreaterThanOrEqual(percentilDe(n));
  });
});

describe("percentilEntrenanDe (contra quienes entrenan)", () => {
  it("en cada estándar da su porcentaje", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(percentilEntrenanDe)).toEqual([1, 3, 12, 25, 42, 57, 65, 72, 90]);
  });

  it("siempre por debajo del de toda la población", () => {
    for (let n = 0.5; n <= 8; n += 0.5) expect(percentilEntrenanDe(n)).toBeLessThan(percentilDe(n));
  });
});

describe("unoRm", () => {
  it("Epley: 40 kg × 8 ≈ 50.7 kg", () => {
    expect(unoRm(40, 8)).toBeCloseTo(50.67, 1);
  });

  it("con 1 repetición es el peso tal cual", () => {
    expect(unoRm(100, 1)).toBe(100);
  });

  it("las reps se topan en 12", () => {
    expect(unoRm(20, 30)).toBe(unoRm(20, 12));
  });
});

describe("nivelDe", () => {
  const e = [1, 2, 3, 4, 5, 6, 7, 8];

  it("en cada estándar da su nivel, y en medio, en proporción", () => {
    expect(nivelDe(1, e)).toBe(1);
    expect(nivelDe(4, e)).toBe(4);
    expect(nivelDe(4.5, e)).toBe(4.5);
  });

  it("por debajo del primero va desde 0", () => {
    expect(nivelDe(0.5, e)).toBe(0.5);
    expect(nivelDe(0, e)).toBe(0);
  });

  it("arriba del último se queda en 8", () => {
    expect(nivelDe(20, e)).toBe(8);
  });
});

describe("fuerzaPorMusculo", () => {
  const banca: EjercicioBanco = {
    id: "press-banca", nombre: "Press de banca", tipo: "peso",
    musculos: { pecho: 1, triceps: 0.5 },
    estandares: { H: [0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.3, 1.7], M: [0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 0.85, 1.3] },
  };
  const lagartijas: EjercicioBanco = {
    id: "lagartijas", nombre: "Lagartijas", tipo: "corporal",
    musculos: { pecho: 1, abdomen: 0.5 },
    estandares: { H: [3, 9, 15, 22, 30, 34, 38, 55], M: [1, 3, 5, 10, 15, 18, 20, 34] },
  };
  const plancha: EjercicioBanco = {
    id: "plancha", nombre: "Plancha", tipo: "tiempo", musculos: { abdomen: 1 },
  };
  const banco = [banca, lagartijas, plancha];
  const sesion = (fecha: string, ejercicios: Sesion["ejercicios"]): Sesion =>
    ({ id: fecha, fecha, origen: "manual", ejercicios });

  it("el mejor 1RM entre su peso, contra los estándares de su sexo", () => {
    // 60 kg × 1 = 60 kg de 1RM; ÷ 75 kg = 0.8 → entre 0.75 (nivel 3) y 0.9 (nivel 4).
    const f = fuerzaPorMusculo(
      [sesion("2026-10-10", [{ ejercicioId: "press-banca", nombre: "", series: [
        { reps: 1, peso: 60 }, { reps: 5, peso: 40 },
      ] }])],
      banco, "H", 75, "2026-10-11"
    );
    expect(f.pecho.nivel).toBeCloseTo(3 + 0.05 / 0.15, 5);
    // El tríceps solo lo trabaja de lado: no se pinta de rebote.
    expect(f.triceps).toBeUndefined();
  });

  it("por músculo se queda con el máximo de sus ejercicios", () => {
    const f = fuerzaPorMusculo(
      [sesion("2026-10-10", [
        { ejercicioId: "press-banca", nombre: "", series: [{ reps: 1, peso: 15 }] },
        { ejercicioId: "lagartijas", nombre: "", series: [{ reps: 15, peso: null }] },
      ])],
      banco, "M", 60, "2026-10-11"
    );
    expect(f.pecho.nivel).toBe(5);
    // Las lagartijas trabajan el abdomen de lado (× 0.5): no lo pintan.
    expect(f.abdomen).toBeUndefined();
  });

  it("solo pinta el trabajo directo: los secundarios no cuentan nunca", () => {
    const curl: EjercicioBanco = {
      id: "curl", nombre: "Curl", tipo: "peso", musculos: { biceps: 1 },
      estandares: { H: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.1], M: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.9] },
    };
    const jalon: EjercicioBanco = {
      id: "jalon", nombre: "Jalón", tipo: "peso", musculos: { dorsal: 1, biceps: 0.5 },
      estandares: { H: [0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.3, 1.7], M: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.2] },
    };
    const b = [curl, jalon];
    // Jalón en Élite (2 × peso) → bíceps 8 × 0.5 = 4. Curl de 22.5 kg ÷ 75 = 0.3 → nivel 2.
    const ambos = fuerzaPorMusculo(
      [sesion("2026-10-10", [
        { ejercicioId: "jalon", nombre: "", series: [{ reps: 1, peso: 150 }] },
        { ejercicioId: "curl", nombre: "", series: [{ reps: 1, peso: 22.5 }] },
      ])],
      b, "H", 75, "2026-10-11"
    );
    expect(ambos.biceps.nivel).toBeCloseTo(2, 5);
    expect(ambos.biceps.origen?.ejercicioId).toBe("curl");
    expect(ambos.dorsal.nivel).toBe(8);

    // Sin curl, el jalón tampoco le da color al bíceps (antes salía a la mitad, de rebote).
    const soloJalon = fuerzaPorMusculo(
      [sesion("2026-10-10", [{ ejercicioId: "jalon", nombre: "", series: [{ reps: 1, peso: 150 }] }])],
      b, "H", 75, "2026-10-11"
    );
    expect(soloJalon.biceps).toBeUndefined();
    expect(soloJalon.dorsal.nivel).toBe(8);
  });

  it("solo cuentan las últimas 8 semanas", () => {
    const vieja = sesion("2026-08-01", [{ ejercicioId: "press-banca", nombre: "", series: [{ reps: 1, peso: 100 }] }]);
    expect(fuerzaPorMusculo([vieja], banco, "H", 75, "2026-10-11")).toEqual({});
  });

  it("sin datos no aparece: los de tiempo, sin estándar o desconocidos no pintan", () => {
    const f = fuerzaPorMusculo(
      [sesion("2026-10-10", [
        { ejercicioId: "plancha", nombre: "", series: [{ reps: 60, peso: null }] },
        { ejercicioId: "nada", nombre: "", series: [{ reps: 10, peso: 50 }] },
      ])],
      banco, "H", 75, "2026-10-11"
    );
    expect(f).toEqual({});
  });

  it("sin peso corporal no hay nada que medir", () => {
    const s = sesion("2026-10-10", [{ ejercicioId: "press-banca", nombre: "", series: [{ reps: 1, peso: 60 }] }]);
    expect(fuerzaPorMusculo([s], banco, "H", 0, "2026-10-11")).toEqual({});
  });
});

describe("nombreMusculo", () => {
  it("todo grupo de los cuatro mapas tiene nombre", () => {
    const grupos = new Set(
      [frenteH, espaldaH, frenteM, espaldaM].flatMap((s) =>
        [...s.matchAll(/data-musculo="([^"]+)"/g)].map((m) => m[1]))
    );
    for (const g of grupos) expect(NOMBRES_MUSCULO[g], g).toBeTruthy();
  });

  it("uno desconocido se muestra tal cual", () => {
    expect(nombreMusculo("nada")).toBe("nada");
  });
});

describe("repartoRangos", () => {
  it("contra toda la población, casi todos en Principiante", () => {
    expect(repartoRangos("todos")).toEqual([60, 12, 10, 6, 2, 3, 4, 3]);
  });

  it("contra quienes entrenan, con la forma de la curva del modelo", () => {
    expect(repartoRangos("entrenan")).toEqual([12, 13, 17, 15, 8, 7, 18, 10]);
  });

  it("los dos suman 100", () => {
    for (const c of ["todos", "entrenan"] as const) {
      expect(repartoRangos(c).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });
});

describe("marcaPara", () => {
  const e = [0.5, 0.625, 0.75, 0.875, 1, 1.137, 1.275, 1.7];

  it("es lo contrario de nivelDe", () => {
    for (const n of [0.4, 1, 1.5, 2, 3.25, 7, 7.9, 8]) expect(nivelDe(marcaPara(n, e), e)).toBeCloseTo(n, 6);
  });

  it("en cada nivel entero, su estándar", () => {
    expect(marcaPara(2, e)).toBe(0.625);
    expect(marcaPara(8, e)).toBe(1.7);
  });
});

describe("siguienteRango", () => {
  const banca = [0.5, 0.625, 0.75, 0.875, 1, 1.137, 1.275, 1.7];
  const conOrigen = (nivel: number, origen: Partial<NonNullable<FuerzaMusculo["origen"]>> = {}): FuerzaMusculo => ({
    nivel,
    origen: {
      ejercicioId: "press-banca", nombre: "Press de banca", tipo: "peso", cuanto: 1,
      serie: { reps: 8, peso: 30 }, estandares: banca, pesoPorMancuerna: false, ...origen,
    },
  });

  it("en los de peso: el peso a sus mismas reps, redondeado hacia arriba a 0.5 kg", () => {
    // 30 × 8 ≈ 38 kg de 1RM ÷ 75 = 0.507 → nivel 1.05, Principiante. Novato pide 0.625 × 75 =
    // 46.9 kg de 1RM, que a 8 reps son 37.006 kg: 37.5 (con 37 no le alcanza).
    const s = siguienteRango(conOrigen(1.05), 75);
    expect(s).toMatchObject({ tipo: "falta", rango: 1, objetivo: { reps: 8, peso: 37.5 }, mejor: { reps: 8, peso: 30 } });
    if (s.tipo === "falta") expect(s.avance).toBeCloseTo(0.525, 3);
  });

  it("en los corporales: las reps que pide el siguiente", () => {
    const lagartijas = [1, 3, 5, 10, 15, 18, 20, 34];
    const s = siguienteRango(conOrigen(4.4, { tipo: "corporal", nombre: "Lagartijas", serie: { reps: 12, peso: null }, estandares: lagartijas }), 60);
    expect(s).toMatchObject({ tipo: "falta", rango: 4, objetivo: { reps: 15, peso: null } });
  });

  it("si su nivel sale de un ejercicio secundario que no alcanza, le sugiere otro", () => {
    expect(siguienteRango(conOrigen(4.2, { cuanto: 0.5 }), 75)).toMatchObject({ tipo: "otroEjercicio", rango: 4 });
  });

  it("con factor por edad, el objetivo es lo que tiene que mover a su edad", () => {
    // Mismo caso que arriba, a los 52 (× 1.162): Novato pide 46.9 kg ÷ 1.162 = 40.3 kg de
    // 1RM, que a 8 reps son 31.8 kg → 32.
    const s = siguienteRango(conOrigen(1.2, { edad: 52, factorEdad: factorEdad(52) }), 75);
    expect(s).toMatchObject({ tipo: "falta", objetivo: { reps: 8, peso: 32 } });
  });

  it("con factor por peso, el objetivo se corrige igual", () => {
    // A 75 kg pedía 37.5 kg; con × 1.1 pide 46.9 ÷ 1.1 = 42.6 kg de 1RM → 33.7 a 8 reps → 34.
    const s = siguienteRango(conOrigen(1.2, { factorPeso: 1.1 }), 75);
    expect(s).toMatchObject({ tipo: "falta", objetivo: { reps: 8, peso: 34 } });
  });

  it("el objetivo usa el mismo peso con que se midió (la masa magra, si hubo)", () => {
    // Medido contra 60 kg en vez de 75: Novato pide 0.625 × 60 = 37.5 kg de 1RM → 29.6 a 8 reps → 30.
    const s = siguienteRango(conOrigen(1.2, { pesoUsado: 60, serie: { reps: 8, peso: 25 } }), 75);
    expect(s).toMatchObject({ tipo: "falta", objetivo: { reps: 8, peso: 30 } });
  });

  it("en Élite ya no hay siguiente", () => {
    expect(siguienteRango(conOrigen(8), 75)).toEqual({ tipo: "maximo" });
  });

  it("fuerzaPorMusculo le dice de qué ejercicio y serie sale cada músculo", () => {
    const b: EjercicioBanco = {
      id: "press-banca", nombre: "Press de banca", tipo: "peso", musculos: { pecho: 1, triceps: 0.5 },
      estandares: { H: banca, M: banca }, pesoPorMancuerna: false,
    };
    const f = fuerzaPorMusculo(
      [{ id: "a", fecha: "2026-10-10", origen: "manual", ejercicios: [{ ejercicioId: "press-banca", nombre: "", series: [
        { reps: 8, peso: 30 }, { reps: 3, peso: 32 },
      ] }] }],
      [b], "H", 75, "2026-10-11"
    );
    expect(f.pecho.origen).toMatchObject({ nombre: "Press de banca", cuanto: 1, serie: { reps: 8, peso: 30 } });
    expect(f.triceps).toBeUndefined();
  });
});

describe("rangoGeneral", () => {
  it("el promedio del nivel de los músculos con rango", () => {
    expect(rangoGeneral({ pecho: { nivel: 3 }, biceps: { nivel: 5 }, cuadriceps: { nivel: 7 } }))
      .toEqual({ nivel: 5, musculos: 3 });
  });

  it("sin ningún músculo con rango no hay rango general", () => {
    expect(rangoGeneral({})).toBeNull();
  });
});

describe("factorEdad y edadEn", () => {
  it("1 de los 23 a los 40 y sin edad; sube de grande y de muy joven", () => {
    expect(factorEdad(null)).toBe(1);
    expect(factorEdad(25)).toBe(1);
    expect(factorEdad(40)).toBe(1);
    expect(factorEdad(50)).toBe(1.13);
    expect(factorEdad(52)).toBeCloseTo(1.162, 3);
    expect(factorEdad(60)).toBe(1.31);
    expect(factorEdad(16)).toBe(1.13);
  });

  it("fuera de la tabla se queda en la orilla", () => {
    expect(factorEdad(10)).toBe(1.23);
    expect(factorEdad(95)).toBe(1.85);
  });

  it("nunca baja al crecer después de los 23", () => {
    const f = Array.from({ length: 60 }, (_, i) => factorEdad(23 + i));
    expect(f.every((x, i) => i === 0 || x >= f[i - 1])).toBe(true);
  });

  it("la edad sale del año de nacimiento; un año imposible no cuenta", () => {
    expect(edadEn(1974, "2026-10-14")).toBe(52);
    expect(edadEn(null, "2026-10-14")).toBeNull();
    expect(edadEn(2024, "2026-10-14")).toBeNull();
    expect(edadEn(1900, "2026-10-14")).toBeNull();
  });

  it("fuerzaPorMusculo aplica el factor a la marca", () => {
    const banca: EjercicioBanco = {
      id: "press-banca", nombre: "Press de banca", tipo: "peso", musculos: { pecho: 1 },
      estandares: { H: [0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.3, 1.7], M: [0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 0.85, 1.3] },
    };
    const sesiones: Sesion[] = [{ id: "s", fecha: "2026-10-10", origen: "manual", ejercicios: [
      { ejercicioId: "press-banca", nombre: "", series: [{ reps: 1, peso: 37.5 }] },
    ] }];
    // 37.5 ÷ 75 = 0.5 → nivel 1. A los 50 (× 1.13) = 0.565 → entre 0.5 y 0.6.
    expect(fuerzaPorMusculo(sesiones, [banca], "H", 75, "2026-10-11").pecho.nivel).toBeCloseTo(1, 5);
    const conEdad = fuerzaPorMusculo(sesiones, [banca], "H", 75, "2026-10-11", 50).pecho;
    expect(conEdad.nivel).toBeCloseTo(1.65, 5);
    expect(conEdad.origen).toMatchObject({ edad: 50, factorEdad: 1.13 });
  });
});

describe("factorPeso", () => {
  it("1 en el peso de referencia (75 kg ellos, 60 kg ellas); raíz cúbica alrededor", () => {
    expect(factorPeso(75, "H")).toBe(1);
    expect(factorPeso(60, "M")).toBe(1);
    expect(factorPeso(87, "H")).toBeCloseTo(1.0507, 4);
    expect(factorPeso(65, "H")).toBeCloseTo(0.9534, 4);
    expect(factorPeso(70, "M")).toBeCloseTo(1.0527, 4);
  });

  it("se topa en 0.85 y 1.25", () => {
    expect(factorPeso(30, "H")).toBe(0.85);
    expect(factorPeso(250, "H")).toBe(1.25);
    expect(factorPeso(0, "H")).toBe(1);
  });

  it("dos igual de entrenados con distinto peso quedan parecidos; con la división a secas, no", () => {
    const banca: EjercicioBanco = {
      id: "press-banca", nombre: "Press de banca", tipo: "peso", musculos: { pecho: 1 },
      estandares: { H: [0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.3, 1.7], M: [0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 0.85, 1.3] },
    };
    const con = (peso: number): Sesion[] => [{ id: "s", fecha: "2026-10-10", origen: "manual", ejercicios: [
      { ejercicioId: "press-banca", nombre: "", series: [{ reps: 1, peso }] },
    ] }];
    // 75 kg → 75 kg de banca (1.0 ×). 100 kg → 75 × (100/75)^⅔ ≈ 90.9 kg: igual de fuerte.
    const ligero = fuerzaPorMusculo(con(75), [banca], "H", 75, "2026-10-11").pecho.nivel;
    const pesado = fuerzaPorMusculo(con(90.9), [banca], "H", 100, "2026-10-11").pecho.nivel;
    expect(pesado).toBeCloseTo(ligero, 1);
  });

  it("no corrige los corporales: ya cargan su propio cuerpo", () => {
    const lagartijas: EjercicioBanco = {
      id: "lagartijas", nombre: "Lagartijas", tipo: "corporal", musculos: { pecho: 1 },
      estandares: { H: [3, 9, 15, 22, 30, 34, 38, 55], M: [1, 3, 5, 10, 15, 18, 20, 34] },
    };
    const s: Sesion[] = [{ id: "s", fecha: "2026-10-10", origen: "manual", ejercicios: [
      { ejercicioId: "lagartijas", nombre: "", series: [{ reps: 15, peso: null }] },
    ] }];
    const f = fuerzaPorMusculo(s, [lagartijas], "H", 100, "2026-10-11").pecho;
    expect(f.nivel).toBe(3);
    expect(f.origen?.factorPeso).toBe(1);
  });
});

describe("pesoParaFuerza", () => {
  it("sin medición de grasa, su peso tal cual", () => {
    expect(pesoParaFuerza(90, "H", null)).toBe(90);
    expect(pesoParaFuerza(90, "H", undefined)).toBe(90);
  });

  it("con el % típico (20 ellos, 28 ellas) tampoco cambia", () => {
    expect(pesoParaFuerza(90, "H", 20)).toBeCloseTo(90, 5);
    expect(pesoParaFuerza(65, "M", 28)).toBeCloseTo(65, 5);
  });

  it("con mucha grasa se le mide contra menos peso; muy marcado, contra un poco más", () => {
    // 90 kg al 35 %: 58.5 kg magros, que al 20 % típico serían 73.1 kg.
    expect(pesoParaFuerza(90, "H", 35)).toBeCloseTo(73.125, 3);
    expect(pesoParaFuerza(90, "H", 12)).toBeCloseTo(99, 3);
  });

  it("un porcentaje fuera de 3 a 60 no cuenta", () => {
    expect(pesoParaFuerza(90, "H", 80)).toBe(90);
    expect(pesoParaFuerza(90, "H", 1)).toBe(90);
  });
});
