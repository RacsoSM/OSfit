import { describe, expect, it } from "vitest";
import { fechaValida, idSesion, inicioValido, origenValido, sesionValida, terminadaValida, type DelBanco } from "./registrarSesion";

const banco = new Map<string, DelBanco>([
  ["press-banca", { nombre: "Press de banca", tipo: "peso" }],
  ["dominadas", { nombre: "Dominadas", tipo: "corporal" }],
  ["plancha", { nombre: "Plancha", tipo: "tiempo" }],
  ["caminadora", { nombre: "Caminadora", tipo: "cardio" }],
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

describe("sesionValida: dropsets y biseries", () => {
  const sesion = (ejercicios: unknown[]) => sesionValida({ id: ID, ejercicios }, banco);

  it("guarda las bajadas de un dropset dentro de su serie", () => {
    const r = sesion([{ ejercicioId: "press-banca", series: [{ reps: 10, peso: 40, caidas: [{ reps: 8, peso: 30 }, { reps: 6, peso: 20 }] }] }]);
    expect(r).not.toBeTypeOf("string");
    expect((r as { ejercicios: { series: unknown[] }[] }).ejercicios[0].series[0])
      .toEqual({ reps: 10, peso: 40, caidas: [{ reps: 8, peso: 30 }, { reps: 6, peso: 20 }] });
  });

  it("una lista de bajadas vacía es una serie normal", () => {
    const r = sesion([{ ejercicioId: "press-banca", series: [{ reps: 10, peso: 40, caidas: [] }] }]);
    expect((r as { ejercicios: { series: unknown[] }[] }).ejercicios[0].series[0]).toEqual({ reps: 10, peso: 40 });
  });

  it("valida cada bajada como una serie, con tope de 5 y nunca en los de tiempo", () => {
    const con = (caidas: unknown, ejercicioId = "press-banca") =>
      sesion([{ ejercicioId, series: [{ reps: 10, peso: ejercicioId === "plancha" ? null : 40, caidas }] }]);
    expect(con([{ reps: 8, peso: null }])).toBe("serie_invalida");
    expect(con([{ reps: 0, peso: 20 }])).toBe("serie_invalida");
    expect(con("mucho")).toBe("serie_invalida");
    expect(con(Array.from({ length: 6 }, () => ({ reps: 5, peso: 10 })))).toBe("serie_invalida");
    expect(con([{ reps: 20, peso: null }], "plancha")).toBe("serie_invalida");
  });

  it("una biserie son dos ejercicios seguidos con la misma marca", () => {
    const r = sesion([
      { ejercicioId: "press-banca", biserie: "b1", series: [{ reps: 10, peso: 40 }] },
      { ejercicioId: "dominadas", biserie: "b1", series: [{ reps: 8, peso: null }] },
      { ejercicioId: "plancha", series: [{ reps: 30, peso: null }] },
    ]);
    expect(r).not.toBeTypeOf("string");
    expect((r as { ejercicios: { biserie?: string }[] }).ejercicios.map((e) => e.biserie)).toEqual(["b1", "b1", undefined]);
  });

  it("rechaza biseries de uno, de tres, separadas o con marca rara", () => {
    const p = { ejercicioId: "press-banca", series: [{ reps: 10, peso: 40 }] };
    const d = { ejercicioId: "dominadas", series: [{ reps: 8, peso: null }] };
    const t = { ejercicioId: "plancha", series: [{ reps: 30, peso: null }] };
    expect(sesion([{ ...p, biserie: "b1" }, d])).toBe("biserie_invalida");
    expect(sesion([{ ...p, biserie: "b1" }, { ...d, biserie: "b1" }, { ...t, biserie: "b1" }])).toBe("biserie_invalida");
    expect(sesion([{ ...p, biserie: "b1" }, t, { ...d, biserie: "b1" }])).toBe("biserie_invalida");
    expect(sesion([{ ...p, biserie: "<script>" }, { ...d, biserie: "<script>" }])).toBe("biserie_invalida");
  });
});

describe("inicioValido", () => {
  const AHORA = Date.UTC(2026, 9, 12, 18, 0);

  it("acepta un inicio de hace un rato", () => {
    expect(inicioValido(AHORA - 90 * 60_000, AHORA)).toBe(AHORA - 90 * 60_000);
  });

  it("descarta lo que no es una hora razonable: más de un día atrás, futuro o basura", () => {
    expect(inicioValido(AHORA - 25 * 3_600_000, AHORA)).toBeNull();
    expect(inicioValido(AHORA + 10 * 60_000, AHORA)).toBeNull();
    expect(inicioValido("ayer", AHORA)).toBeNull();
    expect(inicioValido(undefined, AHORA)).toBeNull();
  });
});

describe("idSesion", () => {
  it("acepta el id de un borrador y rechaza lo que no sirve de id de documento", () => {
    expect(idSesion({ id: ID })).toBe(ID);
    expect(idSesion({ id: "a/b/c/d/e/f" })).toBeNull();
    expect(idSesion({ id: "corto" })).toBeNull();
    expect(idSesion({})).toBeNull();
    expect(idSesion(null)).toBeNull();
  });
});

describe("terminadaValida", () => {
  const AHORA = Date.UTC(2026, 9, 14, 18, 0);
  it("acepta hasta una semana de atraso (hecho sin internet)", () => {
    expect(terminadaValida(AHORA - 2 * 24 * 3_600_000, AHORA)).toBe(AHORA - 2 * 24 * 3_600_000);
  });
  it("más de una semana, del futuro o basura no sirve", () => {
    expect(terminadaValida(AHORA - 8 * 24 * 3_600_000, AHORA)).toBeNull();
    expect(terminadaValida(AHORA + 10 * 60_000, AHORA)).toBeNull();
    expect(terminadaValida("ayer", AHORA)).toBeNull();
    expect(terminadaValida(undefined, AHORA)).toBeNull();
  });
});

describe("fechaValida", () => {
  it("acepta hoy y hasta 7 días atrás", () => {
    expect(fechaValida("2026-10-14", "2026-10-14")).toBe("2026-10-14");
    expect(fechaValida("2026-10-13", "2026-10-14")).toBe("2026-10-13");
    expect(fechaValida("2026-10-07", "2026-10-14")).toBe("2026-10-07");
  });
  it("del futuro, más de una semana o mal escrita no sirve", () => {
    expect(fechaValida("2026-10-15", "2026-10-14")).toBeNull();
    expect(fechaValida("2026-10-06", "2026-10-14")).toBeNull();
    expect(fechaValida("14/10/2026", "2026-10-14")).toBeNull();
    expect(fechaValida(undefined, "2026-10-14")).toBeNull();
  });
});


describe("origenValido", () => {
  it("solo acepta guiado; lo demás es manual", () => {
    expect(origenValido("guiado")).toBe("guiado");
    expect(origenValido("manual")).toBe("manual");
    expect(origenValido(undefined)).toBe("manual");
    expect(origenValido("otra cosa")).toBe("manual");
  });
});

describe("sesionValida con cardio", () => {
  const con = (serie: unknown, mas: unknown[] = []) =>
    sesionValida({ id: ID, ejercicios: [{ ejercicioId: "caminadora", series: [serie, ...mas] }] }, banco);

  it("guarda minutos, inclinación y velocidad, con el nombre del banco", () => {
    expect(con({ reps: 25, peso: null, inclinacion: 8, velocidad: 5.5 })).toEqual({
      id: ID, ejercicios: [{ ejercicioId: "caminadora", nombre: "Caminadora", series: [{ reps: 25, peso: null, inclinacion: 8, velocidad: 5.5 }] }],
    });
  });

  it("la inclinación y la velocidad son opcionales", () => {
    expect(con({ reps: 30, peso: null })).toMatchObject({ ejercicios: [{ series: [{ reps: 30, peso: null }] }] });
  });

  it("minutos enteros de 1 a 300, sin peso", () => {
    expect(con({ reps: 0, peso: null })).toBe("serie_invalida");
    expect(con({ reps: 301, peso: null })).toBe("serie_invalida");
    expect(con({ reps: 12.5, peso: null })).toBe("serie_invalida");
    expect(con({ reps: 20, peso: 10 })).toBe("serie_invalida");
  });

  it("rechaza inclinación o velocidad fuera de rango, y más de una anotación o bajadas", () => {
    expect(con({ reps: 20, peso: null, inclinacion: 31 })).toBe("serie_invalida");
    expect(con({ reps: 20, peso: null, velocidad: -1 })).toBe("serie_invalida");
    expect(con({ reps: 20, peso: null, velocidad: "5" })).toBe("serie_invalida");
    expect(con({ reps: 20, peso: null }, [{ reps: 10, peso: null }])).toBe("serie_invalida");
    expect(con({ reps: 20, peso: null, caidas: [{ reps: 5, peso: null }] })).toBe("serie_invalida");
  });

  it("los demás tipos no guardan inclinación ni velocidad", () => {
    const r = sesionValida({ id: ID, ejercicios: [{ ejercicioId: "plancha", series: [{ reps: 40, peso: null, velocidad: 5 }] }] }, banco);
    expect(r).toMatchObject({ ejercicios: [{ series: [{ reps: 40, peso: null }] }] });
    expect(JSON.stringify(r)).not.toContain("velocidad");
  });
});

