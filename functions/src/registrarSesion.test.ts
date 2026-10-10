import { describe, expect, it } from "vitest";
import { sesionValida, type DelBanco } from "./registrarSesion";

const banco = new Map<string, DelBanco>([
  ["press-banca", { nombre: "Press de banca", tipo: "peso" }],
  ["dominadas", { nombre: "Dominadas", tipo: "corporal" }],
  ["plancha", { nombre: "Plancha", tipo: "tiempo" }],
]);

const ID = "a1b2c3d4e5f6";

describe("sesionValida", () => {
  it("acepta una sesión normal y copia el nombre del banco", () => {
    const r = sesionValida({
      id: ID,
      ejercicios: [
        { ejercicioId: "press-banca", series: [{ reps: 10, peso: 40 }, { reps: 8, peso: 42.5 }] },
        { ejercicioId: "dominadas", series: [{ reps: 6, peso: null }] },
        { ejercicioId: "plancha", series: [{ reps: 45, peso: null }] },
      ],
    }, banco);
    expect(r).toEqual({
      id: ID,
      ejercicios: [
        { ejercicioId: "press-banca", nombre: "Press de banca", series: [{ reps: 10, peso: 40 }, { reps: 8, peso: 42.5 }] },
        { ejercicioId: "dominadas", nombre: "Dominadas", series: [{ reps: 6, peso: null }] },
        { ejercicioId: "plancha", nombre: "Plancha", series: [{ reps: 45, peso: null }] },
      ],
    });
  });

  it("rechaza un ejercicio que no está en el banco", () => {
    expect(sesionValida({ id: ID, ejercicios: [{ ejercicioId: "inventado", series: [{ reps: 5, peso: 1 }] }] }, banco))
      .toBe("ejercicio_desconocido");
  });

  it("los de peso exigen peso entre 0 y 500", () => {
    const con = (peso: unknown) => sesionValida({ id: ID, ejercicios: [{ ejercicioId: "press-banca", series: [{ reps: 5, peso }] }] }, banco);
    expect(con(null)).toBe("serie_invalida");
    expect(con(501)).toBe("serie_invalida");
    expect(con(-1)).toBe("serie_invalida");
    expect(con(0)).not.toBeTypeOf("string");
  });

  it("los corporales aceptan lastre opcional; los de tiempo no llevan peso", () => {
    expect(sesionValida({ id: ID, ejercicios: [{ ejercicioId: "dominadas", series: [{ reps: 5, peso: 10 }] }] }, banco))
      .not.toBeTypeOf("string");
    expect(sesionValida({ id: ID, ejercicios: [{ ejercicioId: "plancha", series: [{ reps: 30, peso: 5 }] }] }, banco))
      .toBe("serie_invalida");
  });

  it("reps enteras: 1 a 100, o hasta 3600 segundos en los de tiempo", () => {
    const reps = (id: string, r: unknown) => sesionValida({ id: ID, ejercicios: [{ ejercicioId: id, series: [{ reps: r, peso: id === "press-banca" ? 10 : null }] }] }, banco);
    expect(reps("press-banca", 0)).toBe("serie_invalida");
    expect(reps("press-banca", 101)).toBe("serie_invalida");
    expect(reps("press-banca", 8.5)).toBe("serie_invalida");
    expect(reps("plancha", 600)).not.toBeTypeOf("string");
    expect(reps("plancha", 3601)).toBe("serie_invalida");
  });

  it("pone tope de 30 ejercicios y 20 series, y pide al menos uno de cada", () => {
    const serie = { reps: 5, peso: 10 };
    expect(sesionValida({ id: ID, ejercicios: [] }, banco)).toBe("sesion_vacia");
    expect(sesionValida({ id: ID, ejercicios: [{ ejercicioId: "press-banca", series: [] }] }, banco)).toBe("serie_invalida");
    expect(sesionValida({ id: ID, ejercicios: Array(31).fill({ ejercicioId: "press-banca", series: [serie] }) }, banco)).toBe("sesion_muy_larga");
    expect(sesionValida({ id: ID, ejercicios: [{ ejercicioId: "press-banca", series: Array(21).fill(serie) }] }, banco)).toBe("serie_invalida");
  });

  it("exige un id del borrador usable como id de documento", () => {
    const ejercicios = [{ ejercicioId: "press-banca", series: [{ reps: 5, peso: 10 }] }];
    expect(sesionValida({ ejercicios }, banco)).toBe("id_invalido");
    expect(sesionValida({ id: "a/b", ejercicios }, banco)).toBe("id_invalido");
    expect(sesionValida(null, banco)).toBe("id_invalido");
  });
});
