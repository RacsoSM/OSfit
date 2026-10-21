import { describe, expect, it } from "vitest";
import { armarBatalla, puntajeDe, type EjercicioBatallaBanco } from "./batalla";

const estandares = { H: [0.5, 0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5], M: [0.25, 0.4, 0.5, 0.6, 0.75, 0.85, 1, 1.2] };
const banco: EjercicioBatallaBanco[] = [
  { id: "press-banca", nombre: "Press de banca", tipo: "peso", musculos: { pecho: 1, triceps: 0.5 }, estandares },
  { id: "lagartijas", nombre: "Lagartijas", tipo: "corporal", musculos: { pecho: 1 }, estandares: { H: [1, 2, 3, 4, 5, 6, 7, 40], M: [1, 2, 3, 4, 5, 6, 7, 20] } },
  { id: "plancha", nombre: "Plancha", tipo: "tiempo", musculos: { abdomen: 1 } },
  { id: "caminadora", nombre: "Caminadora", tipo: "cardio", musculos: { cuadriceps: 0.5 } },
  { id: "curl", nombre: "Curl", tipo: "peso", musculos: { biceps: 1 }, pesoPorMancuerna: true },
];
const said = { nombre: "Said", sexo: "H" as const, peso: 75, edad: 30 };
const caro = { nombre: "Caro", sexo: "M" as const, peso: 60, edad: 30 };
const ses = (...ejercicios: { ejercicioId: string; series: { reps: number; peso: number | null }[] }[]) => [{ ejercicios }];

describe("puntajeDe", () => {
  it("en los de peso es el 1RM entre su peso, sobre el Élite de su sexo", () => {
    // 60 × (1 + 10/30) = 80 kg; 80 / 75 = 1.0667; ÷ 1.5 = 0.711.
    expect(puntajeDe(banco[0], { reps: 10, peso: 60 }, said)).toBeCloseTo(0.711, 3);
    // Una mujer de 60 kg con 40 × 10: 53.3 / 60 = 0.889; ÷ 1.2 = 0.741, le gana.
    expect(puntajeDe(banco[0], { reps: 10, peso: 40 }, caro)).toBeCloseTo(0.741, 3);
  });

  it("los corporales cuentan reps y los de tiempo segundos, sin ajuste por edad", () => {
    expect(puntajeDe(banco[1], { reps: 20, peso: null }, said)).toBeCloseTo(0.5, 5);
    expect(puntajeDe(banco[2], { reps: 90, peso: null }, { ...said, edad: 60 })).toBe(90);
  });

  it("la edad sube la marca, como en el mapa", () => {
    expect(puntajeDe(banco[0], { reps: 10, peso: 60 }, { ...said, edad: 60 }))
      .toBeGreaterThan(puntajeDe(banco[0], { reps: 10, peso: 60 }, said));
  });

  it("una serie sin peso en un ejercicio de peso no cuenta", () => {
    expect(puntajeDe(banco[0], { reps: 10, peso: null }, said)).toBe(0);
  });
});

describe("armarBatalla", () => {
  it("solo los ejercicios que las dos tienen, con su mejor serie, sin cardio", () => {
    const a = ses(
      { ejercicioId: "press-banca", series: [{ reps: 10, peso: 50 }, { reps: 5, peso: 70 }] },
      { ejercicioId: "plancha", series: [{ reps: 60, peso: null }] },
      { ejercicioId: "caminadora", series: [{ reps: 30, peso: null }] },
      { ejercicioId: "curl", series: [{ reps: 10, peso: 10 }] },
    );
    const b = ses(
      { ejercicioId: "press-banca", series: [{ reps: 10, peso: 40 }] },
      { ejercicioId: "plancha", series: [{ reps: 45, peso: null }] },
      { ejercicioId: "caminadora", series: [{ reps: 30, peso: null }] },
    );
    const r = armarBatalla(said, caro, a, b, banco);
    expect(r.a).toEqual({ nombre: "Said", sexo: "H" });
    expect(r.ejercicios.map((e) => e.id)).toEqual(["plancha", "press-banca"]);
    const press = r.ejercicios[1];
    // 70 × 5 → 81.7 kg le gana a 50 × 10 → 66.7 kg.
    expect(press.a).toMatchObject({ reps: 5, peso: 70, unoRm: 81.7 });
    expect(press.b).toMatchObject({ reps: 10, peso: 40, unoRm: 53.3 });
    expect(press.musculos).toEqual(["pecho"]);
    expect(r.ejercicios[0].a).toMatchObject({ reps: 60, peso: null, unoRm: null, puntaje: 60 });
  });

  it("junta las series de todo el historial, no solo de una sesión", () => {
    const a = [...ses({ ejercicioId: "curl", series: [{ reps: 8, peso: 8 }] }), ...ses({ ejercicioId: "curl", series: [{ reps: 8, peso: 12 }] })];
    const r = armarBatalla(said, caro, a, ses({ ejercicioId: "curl", series: [{ reps: 8, peso: 6 }] }), banco);
    expect(r.ejercicios[0].a.peso).toBe(12);
    expect(r.ejercicios[0].pesoPorMancuerna).toBe(true);
  });
});
