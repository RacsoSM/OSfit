import { describe, expect, it } from "vitest";
import { marcarDescanso } from "./descanso";
import { paraEnviar, type Borrador, type EjercicioBorrador } from "./registro";

function ej(series: { reps: string; peso: string }[], extra: Partial<EjercicioBorrador> = {}): EjercicioBorrador {
  return { ejercicioId: "press", nombre: "Press", tipo: "peso", gifRuta: null, series, ...extra };
}

function borrador(ejercicios: EjercicioBorrador[], extra: Partial<Borrador> = {}): Borrador {
  return { id: "b1", fecha: "2026-10-31", iniciado: 0, ejercicios, ...extra };
}

describe("marcarDescanso", () => {
  it("la primera serie arranca el descanso sin anotar uno", () => {
    const b = marcarDescanso(borrador([ej([{ reps: "10", peso: "40" }])]), 0, 0, 1_000);
    expect(b.ultimaSerie).toBe(1_000);
    expect(b.ejercicios[0].series[0].hecha).toBe(1_000);
    expect(b.ejercicios[0].series[0].descanso).toBeUndefined();
  });

  it("la siguiente anota lo que descansó desde la anterior y reinicia", () => {
    let b = borrador([ej([{ reps: "10", peso: "40" }, { reps: "8", peso: "40" }])]);
    b = marcarDescanso(b, 0, 0, 1_000);
    b = marcarDescanso(b, 0, 1, 91_000);
    expect(b.ejercicios[0].series[1].descanso).toBe(90_000);
    expect(b.ultimaSerie).toBe(91_000);
  });

  it("corregir una serie ya contada no reinicia el descanso", () => {
    const b = marcarDescanso(borrador([ej([{ reps: "10", peso: "40" }])]), 0, 0, 1_000);
    expect(marcarDescanso(b, 0, 0, 50_000)).toBe(b);
  });

  it("una serie en blanco, una a medio llenar o el cardio no cuentan", () => {
    const enBlanco = borrador([ej([{ reps: "", peso: "" }])]);
    expect(marcarDescanso(enBlanco, 0, 0, 1)).toBe(enBlanco);
    const aMedias = borrador([ej([{ reps: "", peso: "40" }])]);
    expect(marcarDescanso(aMedias, 0, 0, 1)).toBe(aMedias);
    const cardio = borrador([ej([{ reps: "20", peso: "" }], { tipo: "cardio" })]);
    expect(marcarDescanso(cardio, 0, 0, 1)).toBe(cardio);
  });

  it("no corre al corregir un entrenamiento pasado", () => {
    const b = borrador([ej([{ reps: "10", peso: "40" }])], { edicion: true });
    expect(marcarDescanso(b, 0, 0, 1)).toBe(b);
  });

  it("en una biserie, la B reinicia pero el descanso se anota entre rondas, en la A", () => {
    let b = borrador([
      ej([{ reps: "10", peso: "40" }, { reps: "10", peso: "40" }], { biserie: "b1" }),
      ej([{ reps: "12", peso: "20" }, { reps: "12", peso: "20" }], { ejercicioId: "remo", biserie: "b1" }),
    ]);
    b = marcarDescanso(b, 0, 0, 0);
    b = marcarDescanso(b, 1, 0, 30_000);
    expect(b.ejercicios[1].series[0].descanso).toBeUndefined();
    b = marcarDescanso(b, 0, 1, 150_000);
    expect(b.ejercicios[0].series[1].descanso).toBe(120_000);
  });

  it("los tiempos de descanso no se envían con la sesión", () => {
    let b = borrador([ej([{ reps: "10", peso: "40" }, { reps: "8", peso: "40" }])]);
    b = marcarDescanso(marcarDescanso(b, 0, 0, 1_000), 0, 1, 91_000);
    const r = paraEnviar(b);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/descanso|hecha|ultimaSerie/);
  });
});
