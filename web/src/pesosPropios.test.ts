import { describe, expect, it } from "vitest";
import type { Ejercicio } from "./datos";
import { claveEjercicio, conPesosPropios } from "./pesosPropios";

function ejercicio(nombre: string, pesoONota = ""): Ejercicio {
  return { nombre, series: 4, repeticiones: "10", pesoONota };
}

describe("conPesosPropios", () => {
  it("sin pesos propios devuelve los de la plantilla", () => {
    const ejercicios = [ejercicio("Press banca", "30 kg")];
    expect(conPesosPropios(ejercicios, {})).toEqual(ejercicios);
  });

  it("el peso propio pisa al de la plantilla", () => {
    const resultado = conPesosPropios([ejercicio("Press banca", "30 kg")], {
      "press banca": "40 kg",
    });
    expect(resultado[0].pesoONota).toBe("40 kg");
  });

  it("solo cambia el ejercicio que tiene peso propio", () => {
    const resultado = conPesosPropios(
      [ejercicio("Press banca", "30 kg"), ejercicio("Remo", "25 kg")],
      { "press banca": "40 kg" }
    );
    expect(resultado[0].pesoONota).toBe("40 kg");
    expect(resultado[1].pesoONota).toBe("25 kg");
  });

  it("la búsqueda ignora mayúsculas y espacios de sobra", () => {
    const resultado = conPesosPropios([ejercicio("  Press   Banca ")], {
      "press banca": "40 kg",
    });
    expect(resultado[0].pesoONota).toBe("40 kg");
  });

  it("un peso propio en blanco cae al de la plantilla", () => {
    const resultado = conPesosPropios([ejercicio("Press banca", "30 kg")], {
      "press banca": "   ",
    });
    expect(resultado[0].pesoONota).toBe("30 kg");
  });

  it("un mapa ausente no rompe", () => {
    // Firestore omite los campos que nunca se escribieron.
    const ejercicios = [ejercicio("Press banca", "30 kg")];
    expect(conPesosPropios(ejercicios, undefined)).toEqual(ejercicios);
  });

  it("reordenar la plantilla no despega los pesos", () => {
    const propios = { "press banca": "40 kg" };
    const reordenada = [ejercicio("Remo"), ejercicio("Press banca")];
    expect(conPesosPropios(reordenada, propios)[1].pesoONota).toBe("40 kg");
  });

  it("la clave normaliza igual que el gemelo de Kotlin", () => {
    expect(claveEjercicio("  Press   BANCA ")).toBe("press banca");
  });
});
