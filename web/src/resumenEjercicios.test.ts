import { describe, expect, it } from "vitest";
import { etiquetaEjercicio, filasDelResumen, seriesCortas } from "./resumen";
import type { EjercicioBanco, Sesion } from "./datos";
import type { EjercicioBorrador, Envio } from "./registro";

const s = (peso: number | null, reps: number) => ({ peso, reps });
const base = { ejercicioId: "hip", tipo: "peso" as const, unidad: "kg" as const };

describe("etiquetaEjercicio", () => {
  it("récord si su mejor serie supera la de siempre (la regla de las marcas)", () => {
    expect(etiquetaEjercicio({ ...base, hoy: [s(100, 8)], ultima: [s(90, 8)], mejorAntes: s(95, 8) }))
      .toEqual({ tipo: "record", texto: "Récord" });
  });
  it("si no es récord: cuánto subió o bajó su serie más pesada contra la última vez, en su unidad", () => {
    expect(etiquetaEjercicio({ ...base, hoy: [s(90, 8)], ultima: [s(80, 8)], mejorAntes: s(120, 5) }))
      .toEqual({ tipo: "sube", texto: "+10 kg" });
    expect(etiquetaEjercicio({ ...base, hoy: [s(77.5, 8)], ultima: [s(80, 8)], mejorAntes: s(120, 5) }))
      .toEqual({ tipo: "baja", texto: "−2.5 kg" });
    // 81.6 kg ≈ 180 lb y 63.5 kg = 140 lb: "+40 lb".
    expect(etiquetaEjercicio({ ...base, unidad: "lb", hoy: [s(81.6, 11)], ultima: [s(63.5, 11)], mejorAntes: s(120, 5) }))
      .toEqual({ tipo: "sube", texto: "+40 lb" });
  });
  it("igual, nuevo, corporal por reps y nada en el cardio", () => {
    expect(etiquetaEjercicio({ ...base, hoy: [s(80, 8)], ultima: [s(80, 10)], mejorAntes: s(80, 10) })).toEqual({ tipo: "igual", texto: "Igual" });
    expect(etiquetaEjercicio({ ...base, hoy: [s(80, 8)], ultima: null, mejorAntes: undefined })).toEqual({ tipo: "nuevo", texto: "Nuevo" });
    expect(etiquetaEjercicio({ ejercicioId: "lag", tipo: "corporal", unidad: "kg", hoy: [s(null, 12)], ultima: [s(null, 15)], mejorAntes: s(null, 20) }))
      .toEqual({ tipo: "baja", texto: "−3 reps" });
    expect(etiquetaEjercicio({ ejercicioId: "bici", tipo: "cardio", unidad: "kg", hoy: [s(null, 20)], ultima: [s(null, 10)], mejorAntes: undefined })).toBeNull();
  });
});

describe("filasDelResumen", () => {
  const banco = [
    { id: "hip", nombre: "Hip thrust", tipo: "peso", musculos: {} },
    { id: "lag", nombre: "Lagartijas", tipo: "corporal", musculos: {} },
  ] as unknown as EjercicioBanco[];
  const borrador = (ejercicioId: string, nombre: string, tipo: "peso" | "corporal", series: [string, string][], unidad?: "kg" | "lb"): EjercicioBorrador =>
    ({ ejercicioId, nombre, tipo, gifRuta: `${ejercicioId}.gif`, series: series.map(([peso, reps]) => ({ peso, reps })), unidad } as EjercicioBorrador);
  const envio = { id: "x", ejercicios: [
    { ejercicioId: "hip", series: [{ peso: 81.6, reps: 11 }, { peso: 81.6, reps: 10 }] },
    { ejercicioId: "lag", series: [{ peso: null, reps: 25 }] },
  ] } as unknown as Envio;
  const previas = [
    { id: "a", fecha: "2026-11-20", ejercicios: [{ ejercicioId: "hip", nombre: "", series: [{ peso: 63.5, reps: 11 }] }] },
    { id: "b", fecha: "2026-11-10", ejercicios: [{ ejercicioId: "hip", nombre: "", series: [{ peso: 120, reps: 5 }] }, { ejercicioId: "lag", nombre: "", series: [{ peso: null, reps: 20 }] }] },
  ] as unknown as Sesion[];

  it("una fila por ejercicio con su GIF, sus series como las anotó y su pastilla", () => {
    const filas = filasDelResumen([borrador("hip", "Hip thrust", "peso", [["180", "11"], ["180", "10"]], "lb"), borrador("lag", "Lagartijas", "corporal", [["", "25"]])], envio, previas, banco);
    expect(filas.map((f) => [f.nombre, f.gifRuta, f.series, f.etiqueta?.texto])).toEqual([
      ["Hip thrust", "hip.gif", "180×11 · 180×10", "+40 lb"],
      ["Lagartijas", "lag.gif", "25 reps", "Récord"],
    ]);
  });
  it("seriesCortas ignora las vacías", () => {
    expect(seriesCortas(borrador("hip", "Hip", "peso", [["60", "8"], ["", ""], ["60", "7"]]))).toBe("60×8 · 60×7");
  });
});
