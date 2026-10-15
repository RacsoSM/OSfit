import { describe, expect, it } from "vitest";
import type { EjercicioBanco } from "./datos";
import { armarResumen, sesionDeEnvio } from "./resumen";

const banco: EjercicioBanco[] = [
  { id: "press-banca", nombre: "Press de banca", tipo: "peso", musculos: { pecho: 1, triceps: 0.5, hombro: 0.5 } },
  { id: "fondos", nombre: "Fondos", tipo: "corporal", musculos: { triceps: 1, pecho: 0.5 } },
];
const envio = {
  id: "abc12345",
  origen: "guiado" as const,
  ejercicios: [
    { ejercicioId: "press-banca", series: [{ reps: 10, peso: 40 }, { reps: 8, peso: 42.5 }] },
    { ejercicioId: "fondos", series: [{ reps: 12, peso: null }] },
  ],
};
const base = { envio, banco, fuerzaAntes: {}, fuerzaDespues: {}, enTelefono: false, guiado: true, terminado: 50 * 60_000 };

describe("armarResumen", () => {
  it("cuenta duración, ejercicios, series y kilos", () => {
    const r = armarResumen({ ...base, iniciado: 2 * 60_000 });
    expect(r).toMatchObject({ minutos: 48, ejercicios: 2, series: 3, kilos: 740 });
  });
  it("sin hora de inicio no inventa la duración", () => {
    expect(armarResumen(base).minutos).toBeNull();
  });
  it("los músculos principales van primero, sin repetir", () => {
    const r = armarResumen(base);
    expect(r.musculos.filter((m) => m.principal).map((m) => m.musculo).sort()).toEqual(["pecho", "triceps"]);
    expect(r.musculos.map((m) => m.musculo)).toHaveLength(3);
    expect(r.musculos.at(-1)).toMatchObject({ musculo: "hombro", principal: false });
  });
  it("celebra los músculos que subieron de rango, y los que estrenan rango", () => {
    const r = armarResumen({
      ...base,
      fuerzaAntes: { pecho: { nivel: 3.2 }, triceps: { nivel: 4.5 } },
      fuerzaDespues: { pecho: { nivel: 4.1 }, triceps: { nivel: 4.9 }, hombro: { nivel: 2.3 } },
    });
    expect(r.subidas.map((s) => [s.musculo, s.antes, s.despues])).toEqual([["pecho", 2, 3], ["hombro", null, 1]]);
  });
});

describe("sesionDeEnvio", () => {
  it("arma la sesión con los nombres del banco", () => {
    const s = sesionDeEnvio(envio, "2026-10-14", banco);
    expect(s).toMatchObject({ id: "abc12345", fecha: "2026-10-14", origen: "guiado" });
    expect(s.ejercicios[0].nombre).toBe("Press de banca");
  });
});
