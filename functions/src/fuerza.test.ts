import { describe, expect, it } from "vitest";
import { nivelesPorMusculo, pesoParaFuerza, edadEn } from "./fuerza";
import * as web from "../../web/src/fuerza";

/** El gemelo tiene que dar exactamente lo mismo que la web con los mismos datos. */
describe("gemelo de web/src/fuerza.ts", () => {
  const banco = [
    { id: "press-banca", nombre: "Press", tipo: "peso" as const, musculos: { pecho: 1, triceps: 0.5, hombro: 0.5 },
      estandares: { H: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25], M: [0.25, 0.4, 0.55, 0.7, 0.85, 1, 1.15, 1.3] } },
    { id: "fondos", nombre: "Fondos", tipo: "corporal" as const, musculos: { triceps: 1, pecho: 0.5 },
      estandares: { H: [1, 3, 6, 10, 15, 20, 25, 30], M: [1, 2, 4, 6, 9, 12, 15, 20] } },
    // Con lista: fondos no pinta tríceps, salvo que no haya otro (aquí no hay: va de respaldo).
    { id: "fondos-lista", nombre: "Fondos", tipo: "corporal" as const, musculos: { triceps: 1 }, pinta: [] as string[],
      estandares: { H: [1, 3, 6, 10, 15, 20, 25, 30], M: [1, 2, 4, 6, 9, 12, 15, 20] } },
    { id: "curl", nombre: "Curl", tipo: "peso" as const, musculos: { biceps: 1 },
      estandares: { H: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5], M: [0.05, 0.08, 0.1, 0.13, 0.16, 0.2, 0.24, 0.3] } },
    { id: "plancha", nombre: "Plancha", tipo: "tiempo" as const, musculos: { abdomen: 1 }, estandares: null },
  ];
  const sesiones = [
    { id: "a", fecha: "2026-10-10", origen: "manual" as const, ejercicios: [
      { ejercicioId: "press-banca", nombre: "x", series: [{ reps: 8, peso: 50 }, { reps: 12, peso: 45 }] },
      { ejercicioId: "fondos", nombre: "x", series: [{ reps: 9, peso: null }] },
      { ejercicioId: "fondos-lista", nombre: "x", series: [{ reps: 25, peso: null }] },
      { ejercicioId: "plancha", nombre: "x", series: [{ reps: 60, peso: null }] },
    ] },
    { id: "b", fecha: "2026-09-01", origen: "manual" as const, ejercicios: [
      { ejercicioId: "curl", nombre: "x", series: [{ reps: 10, peso: 12 }] },
    ] },
    { id: "viejo", fecha: "2026-06-01", origen: "manual" as const, ejercicios: [
      { ejercicioId: "curl", nombre: "x", series: [{ reps: 10, peso: 40 }] },
    ] },
  ];
  for (const [sexo, peso, grasa, anio] of [["H", 80, null, 1990], ["M", 58, 32, 1972], ["M", 70, null, null]] as const) {
    it(`da lo mismo (${sexo}, ${peso} kg)`, () => {
      const hoy = "2026-10-14";
      const edad = edadEn(anio, hoy);
      const p = pesoParaFuerza(peso, sexo, grasa);
      expect(p).toBe(web.pesoParaFuerza(peso, sexo, grasa));
      const deWeb = Object.fromEntries(Object.entries(web.fuerzaPorMusculo(sesiones, banco, sexo, p, hoy, edad)).map(([m, f]) => [m, f.nivel]));
      expect(nivelesPorMusculo(sesiones, banco, sexo, p, hoy, edad)).toEqual(deWeb);
      expect(Object.keys(deWeb).length).toBeGreaterThan(2);
    });
  }
});
