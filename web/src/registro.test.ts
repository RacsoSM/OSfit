import { describe, expect, it } from "vitest";
import type { EjercicioBanco, Sesion } from "./datos";
import {
  MAX_CAIDAS,
  textoCardio,
  cierreAutomatico,
  type Borrador,
  agregarBiserie,
  agregarCaida,
  agregarEjercicio,
  agregarRonda,
  agregarSerie,
  cambiarCaida,
  companero,
  quitarBloque,
  quitarCaida,
  quitarRonda,
  unidades,
  borradorDeSesion,
  borradorGuiado,
  cambiarSerie,
  cambiarUnidad,
  leerBorrador,
  nombresDeSesion,
  nuevoBorrador,
  paraEnviar,
  quitarEjercicio,
  quitarSerie,
  resumenSemana,
  resumenSeries,
  ultimasSeries,
  repsDudosas,
  objetivoDeRutina,
} from "./registro";
import { indiceBanco } from "./banco";
import { barrasAKg } from "./barras";

function ej(campos: Partial<EjercicioBanco> = {}): EjercicioBanco {
  return {
    id: "press-banca", nombre: "Press de banca", tipo: "peso",
    musculos: { pecho: 1 }, gifRuta: "ejercicios/press-banca.webp", ...campos,
  };
}
const dominadas = ej({ id: "dominadas", nombre: "Dominadas", tipo: "corporal" });
const plancha = ej({ id: "plancha", nombre: "Plancha", tipo: "tiempo" });

const vacio = () => nuevoBorrador("borrador123", "2026-10-12");

describe("agregarEjercicio", () => {
  it("sin historial pone tantas series vacías como diga la rutina", () => {
    const b = agregarEjercicio(vacio(), ej(), null, 3);
    expect(b.ejercicios).toHaveLength(1);
    expect(b.ejercicios[0]).toMatchObject({ ejercicioId: "press-banca", nombre: "Press de banca", tipo: "peso" });
    expect(b.ejercicios[0].series).toEqual([
      { reps: "", peso: "" }, { reps: "", peso: "" }, { reps: "", peso: "" },
    ]);
  });

  it("sin rutina ni historial arranca con una serie", () => {
    expect(agregarEjercicio(vacio(), ej(), null, null).ejercicios[0].series).toHaveLength(1);
  });

  it("si ya lo había hecho entra sin series: no copia lo de la última vez", () => {
    const b = agregarEjercicio(vacio(), ej(), [{ reps: 10, peso: 40 }, { reps: 8, peso: 42.5 }], 4);
    expect(b.ejercicios[0].series).toEqual([]);
    expect(agregarSerie(b, 0).ejercicios[0].series).toEqual([{ reps: "", peso: "" }]);
  });

  it("agregar uno que ya está no lo duplica", () => {
    const b = agregarEjercicio(agregarEjercicio(vacio(), ej(), null, 1), ej(), null, 1);
    expect(b.ejercicios).toHaveLength(1);
  });
});

describe("editar series", () => {
  it("cambia un campo, agrega copiando la última y quita", () => {
    let b = agregarEjercicio(vacio(), ej(), null, 1);
    b = cambiarSerie(b, 0, 0, "peso", "50");
    b = cambiarSerie(b, 0, 0, "reps", "6");
    b = agregarSerie(b, 0);
    expect(b.ejercicios[0].series).toEqual([{ reps: "6", peso: "50" }, { reps: "6", peso: "50" }]);
    b = quitarSerie(b, 0, 0);
    expect(b.ejercicios[0].series).toHaveLength(1);
  });

  it("no deja un ejercicio sin series: quitar la última la deja vacía", () => {
    let b = cambiarSerie(agregarEjercicio(vacio(), ej(), null, 1), 0, 0, "reps", "5");
    b = quitarSerie(b, 0, 0);
    expect(b.ejercicios[0].series).toEqual([{ reps: "", peso: "" }]);
  });

  it("quita un ejercicio entero", () => {
    const b = agregarEjercicio(agregarEjercicio(vacio(), ej(), null, 1), dominadas, null, 1);
    expect(quitarEjercicio(b, 0).ejercicios.map((e) => e.ejercicioId)).toEqual(["dominadas"]);
  });
});

describe("paraEnviar", () => {
  it("convierte a números, acepta coma decimal y salta las series en blanco", () => {
    let b = agregarEjercicio(vacio(), ej(), null, 3);
    b = cambiarSerie(b, 0, 0, "reps", "10");
    b = cambiarSerie(b, 0, 0, "peso", "42,5");
    b = cambiarSerie(b, 0, 1, "reps", "8");
    b = cambiarSerie(b, 0, 1, "peso", "45");
    expect(paraEnviar(b)).toEqual({
      ok: true,
      datos: { id: "borrador123", ejercicios: [{ ejercicioId: "press-banca", series: [{ reps: 10, peso: 42.5 }, { reps: 8, peso: 45 }] }] },
    });
  });

  it("corporales sin lastre y de tiempo van sin peso", () => {
    let b = agregarEjercicio(agregarEjercicio(vacio(), dominadas, null, 1), plancha, null, 1);
    b = cambiarSerie(b, 0, 0, "reps", "6");
    b = cambiarSerie(b, 1, 0, "reps", "45");
    const r = paraEnviar(b);
    expect(r.ok && r.datos.ejercicios.map((e) => e.series)).toEqual([[{ reps: 6, peso: null }], [{ reps: 45, peso: null }]]);
  });

  it("explica qué falta en vez de mandar algo que el servidor va a rechazar", () => {
    let b = agregarEjercicio(vacio(), ej(), null, 1);
    b = cambiarSerie(b, 0, 0, "peso", "40");
    expect(paraEnviar(b)).toEqual({ ok: false, error: "Press de banca, serie 1: faltan las repeticiones." });
    b = cambiarSerie(cambiarSerie(b, 0, 0, "reps", "8"), 0, 0, "peso", "");
    expect(paraEnviar(b)).toEqual({ ok: false, error: "Press de banca, serie 1: falta el peso." });
    expect(paraEnviar(cambiarSerie(b, 0, 0, "peso", "abc")))
      .toEqual({ ok: false, error: "Press de banca, serie 1: el peso no es un número." });
  });

  it("un ejercicio con todas sus series en blanco no se manda, y sin nada no hay qué guardar", () => {
    const b = agregarEjercicio(vacio(), ej(), null, 2);
    expect(paraEnviar(b)).toEqual({ ok: false, error: "Anota al menos una serie antes de guardar." });
  });
});

describe("ultimasSeries", () => {
  const sesiones: Sesion[] = [
    { id: "s2", fecha: "2026-10-10", origen: "manual", ejercicios: [{ ejercicioId: "dominadas", nombre: "Dominadas", series: [{ reps: 5, peso: null }] }] },
    { id: "s1", fecha: "2026-10-08", origen: "manual", ejercicios: [{ ejercicioId: "press-banca", nombre: "Press", series: [{ reps: 10, peso: 40 }] }] },
  ];

  it("toma la sesión más reciente que tenga ese ejercicio", () => {
    expect(ultimasSeries(sesiones, "press-banca")).toEqual([{ reps: 10, peso: 40 }]);
    expect(ultimasSeries(sesiones, "plancha")).toBeNull();
  });
});

describe("leerBorrador", () => {
  it("recupera uno guardado y descarta basura", () => {
    const b = agregarEjercicio(vacio(), ej(), null, 1);
    expect(leerBorrador(JSON.stringify(b))).toEqual(b);
    expect(leerBorrador("{no es json")).toBeNull();
    expect(leerBorrador(JSON.stringify({ id: 3 }))).toBeNull();
    expect(leerBorrador(null)).toBeNull();
  });
});

describe("hora de inicio", () => {
  it("el entrenamiento manda la hora en que se inició", () => {
    let b = agregarEjercicio(nuevoBorrador("borrador123", "2026-10-12", 1_760_000_000_000), ej(), null, 1);
    b = cambiarSerie(cambiarSerie(b, 0, 0, "reps", "8"), 0, 0, "peso", "40");
    const r = paraEnviar(b);
    expect(r.ok && r.datos.iniciadaEn).toBe(1_760_000_000_000);
  });

  it("un borrador viejo sin hora se manda igual, sin ella", () => {
    let b = agregarEjercicio(vacio(), ej(), null, 1);
    b = cambiarSerie(cambiarSerie(b, 0, 0, "reps", "8"), 0, 0, "peso", "40");
    const r = paraEnviar(b);
    expect(r.ok && "iniciadaEn" in r.datos).toBe(false);
  });
});

describe("resumenSeries", () => {
  it("resume lo anotado para la fila comprimida", () => {
    let b = agregarEjercicio(vacio(), ej(), null, 3);
    b = cambiarSerie(cambiarSerie(b, 0, 0, "peso", "40"), 0, 0, "reps", "10");
    b = cambiarSerie(cambiarSerie(b, 0, 1, "peso", "42,5"), 0, 1, "reps", "8");
    expect(resumenSeries(b.ejercicios[0])).toBe("2 series · 40 kg × 10, 42.5 kg × 8");
  });

  it("sin nada anotado lo dice; corporales sin lastre y de tiempo en su forma", () => {
    expect(resumenSeries(agregarEjercicio(vacio(), ej(), null, 3).ejercicios[0])).toBe("Sin anotar");
    let b = agregarEjercicio(agregarEjercicio(vacio(), dominadas, null, 1), plancha, null, 1);
    b = cambiarSerie(cambiarSerie(b, 0, 0, "reps", "6"), 1, 0, "reps", "45");
    expect(resumenSeries(b.ejercicios[0])).toBe("1 serie · × 6");
    expect(resumenSeries(b.ejercicios[1])).toBe("1 serie · 45 s");
  });
});

describe("resumenSemana", () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) }) as unknown as Sesion["creada"];
  const sesion = (fecha: string, series: number, minutos?: number): Sesion => ({
    id: fecha, fecha, origen: "manual",
    ...(minutos === undefined ? {} : {
      iniciada: ts(`${fecha}T13:00:00Z`),
      creada: ts(new Date(Date.parse(`${fecha}T13:00:00Z`) + minutos * 60_000).toISOString()),
    }),
    ejercicios: [{ ejercicioId: "x", nombre: "X", series: Array.from({ length: series }, () => ({ reps: 10, peso: 20 })) }],
  });

  it("cuenta solo la semana de hoy, de lunes a domingo", () => {
    const r = resumenSemana([
      sesion("2026-10-18", 2, 30), // domingo: esta semana
      sesion("2026-10-12", 4, 52), // lunes: esta semana
      sesion("2026-10-11", 9, 60), // domingo anterior: fuera
    ], "2026-10-14");
    expect(r.dias.map((d) => d.fecha)).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
    expect(r.dias.map((d) => d.letra).join("")).toBe("LMMJVSD");
    expect(r.dias.filter((d) => d.entreno).map((d) => d.numero)).toEqual([12, 18]);
    expect(r.dias.find((d) => d.esHoy)?.fecha).toBe("2026-10-14");
    expect(r.entrenamientos).toBe(2);
    expect(r.series).toBe(6);
    expect(r.minutos).toBe(82);
  });

  it("en domingo, la semana sigue siendo la que abrió el lunes anterior", () => {
    expect(resumenSemana([], "2026-10-18").dias[0].fecha).toBe("2026-10-12");
  });

  it("sin horas no inventa una duración", () => {
    const r = resumenSemana([sesion("2026-10-13", 3)], "2026-10-13");
    expect(r.minutos).toBeNull();
    expect(r.entrenamientos).toBe(1);
  });
});

describe("nombresDeSesion", () => {
  const con = (...nombres: string[]): Sesion => ({
    id: "s", fecha: "2026-10-13", origen: "manual",
    ejercicios: nombres.map((nombre) => ({ ejercicioId: nombre, nombre, series: [] })),
  });

  it("resume los nombres sin hacer filas largas", () => {
    expect(nombresDeSesion(con())).toBe("Sin ejercicios");
    expect(nombresDeSesion(con("Sentadilla"))).toBe("Sentadilla");
    expect(nombresDeSesion(con("Sentadilla", "Prensa"))).toBe("Sentadilla y Prensa");
    expect(nombresDeSesion(con("Sentadilla", "Prensa", "Curl", "Hip thrust"))).toBe("Sentadilla, Prensa y 2 más");
  });
});

describe("unidad: barras o kg", () => {
  const jalon = ej({ id: "jalon-al-pecho", nombre: "Jalón al pecho" });

  it("una máquina de placas abre en barras", () => {
    const b = agregarEjercicio(nuevoBorrador("b1", "2026-10-13"), jalon, [{ reps: 10, peso: barrasAKg(6) }], null);
    expect(b.ejercicios[0].unidad).toBe("barras");
  });

  it("lo que no es máquina abre en kg", () => {
    const b = agregarEjercicio(nuevoBorrador("b1", "2026-10-13"), ej(), null, null);
    expect(b.ejercicios[0].unidad).toBe("kg");
  });

  it("al guardar, las barras se mandan en kg", () => {
    let b = agregarEjercicio(nuevoBorrador("b1", "2026-10-13"), jalon, null, null);
    b = cambiarSerie(b, 0, 0, "peso", "5");
    b = cambiarSerie(b, 0, 0, "reps", "12");
    const r = paraEnviar(b);
    expect(r.ok && r.datos.ejercicios[0].series[0]).toEqual({ reps: 12, peso: barrasAKg(5) });
  });

  it("cambiar de unidad convierte lo que ya escribió", () => {
    let b = agregarEjercicio(nuevoBorrador("b1", "2026-10-13"), jalon, null, null);
    b = cambiarSerie(b, 0, 0, "peso", "6");
    b = cambiarUnidad(b, 0, "kg");
    expect(b.ejercicios[0].unidad).toBe("kg");
    expect(b.ejercicios[0].series[0].peso).toBe(String(barrasAKg(6)));
    b = cambiarUnidad(b, 0, "barras");
    expect(b.ejercicios[0].series[0].peso).toBe("6");
  });

  it("el resumen dice barras", () => {
    let b = agregarEjercicio(nuevoBorrador("b1", "2026-10-13"), jalon, null, null);
    b = cambiarSerie(b, 0, 0, "peso", "6");
    b = cambiarSerie(b, 0, 0, "reps", "10");
    expect(resumenSeries(b.ejercicios[0])).toBe("1 serie · 6 barras × 10");
  });

  it("un borrador viejo sin unidad se manda tal cual, en kg", () => {
    let b = agregarEjercicio(nuevoBorrador("b1", "2026-10-13"), ej(), null, null);
    b = { ...b, ejercicios: b.ejercicios.map(({ unidad: _, ...x }) => x) };
    b = cambiarSerie(b, 0, 0, "peso", "40");
    b = cambiarSerie(b, 0, 0, "reps", "8");
    const r = paraEnviar(b);
    expect(r.ok && r.datos.ejercicios[0].series[0]).toEqual({ reps: 8, peso: 40 });
  });
});

describe("borradorDeSesion", () => {
  const guardada: Sesion = {
    id: "sesion123abc", fecha: "2026-10-10", origen: "manual",
    ejercicios: [
      { ejercicioId: "press-banca", nombre: "Press viejo", series: [{ reps: 10, peso: 42.5 }, { reps: 8, peso: 45 }] },
      { ejercicioId: "dominadas", nombre: "Dominadas", series: [{ reps: 6, peso: null }] },
    ],
  };

  it("conserva id y fecha, va en kg, toma nombre y GIF del banco y marca la edición", () => {
    const b = borradorDeSesion(guardada, [ej(), dominadas]);
    expect(b.id).toBe("sesion123abc");
    expect(b.fecha).toBe("2026-10-10");
    expect(b.edicion).toBe(true);
    expect(b.ejercicios[0]).toMatchObject({
      nombre: "Press de banca", tipo: "peso", unidad: "kg", gifRuta: "ejercicios/press-banca.webp",
      series: [{ reps: "10", peso: "42.5" }, { reps: "8", peso: "45" }],
    });
    expect(b.ejercicios[1].series).toEqual([{ reps: "6", peso: "" }]);
  });

  it("sin cambios, se envía igual que como estaba guardado", () => {
    const envio = paraEnviar(borradorDeSesion(guardada, [ej(), dominadas]));
    expect(envio).toEqual({ ok: true, datos: {
      id: "sesion123abc",
      ejercicios: [
        { ejercicioId: "press-banca", series: [{ reps: 10, peso: 42.5 }, { reps: 8, peso: 45 }] },
        { ejercicioId: "dominadas", series: [{ reps: 6, peso: null }] },
      ],
    } });
  });

  it("un ejercicio que ya no está en el banco se queda con su nombre", () => {
    const b = borradorDeSesion(guardada, [dominadas]);
    expect(b.ejercicios[0]).toMatchObject({ nombre: "Press viejo", gifRuta: null });
  });

  it("leerBorrador conserva la marca de edición", () => {
    const b = borradorDeSesion(guardada, [ej(), dominadas]);
    expect(leerBorrador(JSON.stringify(b))?.edicion).toBe(true);
  });
});

describe("repsDudosas", () => {
  it("pregunta arriba de 20 reps", () => {
    expect(repsDudosas("21", "peso")).toBe(21);
    expect(repsDudosas(" 86 ", "corporal")).toBe(86);
  });

  it("20 o menos, vacío o algo que no es número no pregunta", () => {
    expect(repsDudosas("20", "peso")).toBeNull();
    expect(repsDudosas("8", "peso")).toBeNull();
    expect(repsDudosas("", "peso")).toBeNull();
    expect(repsDudosas("abc", "peso")).toBeNull();
  });

  it("en los de tiempo son segundos: no pregunta", () => {
    expect(repsDudosas("60", "tiempo")).toBeNull();
  });
});


describe("borradorGuiado", () => {
  const banco = [ej({ alias: ["press banca"] }), dominadas, plancha];
  const dia = {
    nombreDia: " Pecho y espalda ",
    ejercicios: [
      { nombre: "Press banca", series: 4, repeticiones: "10-12", pesoONota: "30 kg" },
      { nombre: "Dominadas", series: 3, repeticiones: "al fallo", pesoONota: "" },
      { nombre: "Pec deck raro", series: 3, repeticiones: "12", pesoONota: "" },
      { nombre: "press banca", series: 2, repeticiones: "8", pesoONota: "" },
    ],
  };

  it("carga los ejercicios del día en orden, con las series de la rutina y lo que pide", () => {
    const b = borradorGuiado("guiado123", "2026-10-12", 1000, dia, indiceBanco(banco), []);
    expect(b.iniciado).toBe(1000);
    expect(b.ejercicios.map((e) => e.ejercicioId)).toEqual(["press-banca", "dominadas"]);
    expect(b.ejercicios[0].series).toHaveLength(4);
    expect(b.ejercicios[0].objetivo).toBe("4 × 10-12 · 30 kg");
    expect(b.ejercicios[1].series).toHaveLength(3);
    expect(b.guiado).toEqual({ nombreDia: "Pecho y espalda", sinLigar: ["Pec deck raro"] });
  });

  it("lo que ya había hecho entra sin series", () => {
    const sesion = {
      id: "s1", fecha: "2026-10-10", origen: "manual",
      ejercicios: [{ ejercicioId: "press-banca", nombre: "Press de banca", series: [{ reps: 8, peso: 40 }] }],
    } as unknown as Sesion;
    const b = borradorGuiado("guiado123", "2026-10-12", 1000, dia, indiceBanco(banco), [sesion]);
    expect(b.ejercicios[0].series).toEqual([]);
  });

  it("se envía como guiado", () => {
    let b = borradorGuiado("guiado123", "2026-10-12", 1000, dia, indiceBanco(banco), []);
    b = cambiarSerie(b, 0, 0, "reps", "10");
    b = cambiarSerie(b, 0, 0, "peso", "30");
    const r = paraEnviar(b);
    expect(r.ok && r.datos.origen).toBe("guiado");
    const manual = paraEnviar(cambiarSerie(cambiarSerie(agregarEjercicio(vacio(), ej(), null, 1), 0, 0, "reps", "5"), 0, 0, "peso", "20"));
    expect(manual.ok && manual.datos.origen).toBeUndefined();
  });
});

describe("objetivoDeRutina", () => {
  it("arma series × reps y la nota", () => {
    expect(objetivoDeRutina({ nombre: "x", series: 4, repeticiones: "10", pesoONota: "" })).toBe("4 × 10");
    expect(objetivoDeRutina({ nombre: "x", series: 3, repeticiones: "", pesoONota: "ligero" })).toBe("3 series · ligero");
    expect(objetivoDeRutina({ nombre: "x", series: 0, repeticiones: "", pesoONota: "" })).toBe("");
  });
});

describe("dropset", () => {
  const conPress = () =>
    cambiarSerie(cambiarSerie(agregarEjercicio(vacio(), ej(), null, 1), 0, 0, "reps", "10"), 0, 0, "peso", "40");

  it("agrega, edita y quita bajadas; sin bajadas la serie vuelve a ser normal", () => {
    let b = agregarCaida(conPress(), 0, 0);
    b = cambiarCaida(b, 0, 0, 0, "peso", "30");
    b = cambiarCaida(b, 0, 0, 0, "reps", "8");
    expect(b.ejercicios[0].series[0]).toEqual({ reps: "10", peso: "40", caidas: [{ reps: "8", peso: "30" }] });
    expect(quitarCaida(b, 0, 0, 0).ejercicios[0].series[0]).toEqual({ reps: "10", peso: "40" });
  });

  it("tope de bajadas por serie", () => {
    let b = conPress();
    for (let k = 0; k < MAX_CAIDAS + 2; k++) b = agregarCaida(b, 0, 0);
    expect(b.ejercicios[0].series[0].caidas).toHaveLength(MAX_CAIDAS);
  });

  it("la serie nueva copia el peso de la anterior pero no sus bajadas", () => {
    const b = agregarSerie(agregarCaida(conPress(), 0, 0), 0);
    expect(b.ejercicios[0].series[1]).toEqual({ reps: "10", peso: "40" });
  });

  it("se envían en kg y se saltan las bajadas en blanco", () => {
    let b = agregarCaida(agregarCaida(conPress(), 0, 0), 0, 0);
    b = cambiarCaida(cambiarCaida(b, 0, 0, 0, "peso", "30"), 0, 0, 0, "reps", "8");
    const r = paraEnviar(b);
    expect(r.ok && r.datos.ejercicios[0].series).toEqual([{ reps: 10, peso: 40, caidas: [{ reps: 8, peso: 30 }] }]);
  });

  it("una bajada a medias se reclama con su número", () => {
    const b = cambiarCaida(agregarCaida(conPress(), 0, 0), 0, 0, 0, "peso", "30");
    expect(paraEnviar(b)).toEqual({ ok: false, error: "Press de banca, serie 1, bajada 1: faltan las repeticiones." });
  });

  it("en barras, las bajadas se convierten igual que la serie", () => {
    let b = agregarCaida(cambiarUnidad(conPress(), 0, "barras"), 0, 0);
    b = cambiarCaida(cambiarCaida(b, 0, 0, 0, "peso", "4"), 0, 0, 0, "reps", "8");
    const r = paraEnviar(b);
    expect(r.ok && r.datos.ejercicios[0].series[0].caidas).toEqual([{ reps: 8, peso: barrasAKg(4) }]);
  });

  it("el resumen comprimido las muestra pegadas a su serie", () => {
    let b = agregarCaida(conPress(), 0, 0);
    b = cambiarCaida(cambiarCaida(b, 0, 0, 0, "peso", "30"), 0, 0, 0, "reps", "8");
    expect(resumenSeries(b.ejercicios[0])).toBe("1 serie · 40 kg × 10 ↓ 30 kg × 8");
  });

  it("una sesión guardada se corrige con sus bajadas", () => {
    const previas = [{ reps: 10, peso: 40, caidas: [{ reps: 8, peso: 30 }] }];
    const s: Sesion = { id: "s1", fecha: "2026-10-12", origen: "manual", ejercicios: [{ ejercicioId: "press-banca", nombre: "Press de banca", series: previas }] };
    expect(borradorDeSesion(s, [ej()]).ejercicios[0].series[0].caidas).toEqual([{ reps: "8", peso: "30" }]);
  });
});

describe("biserie", () => {
  const remo = ej({ id: "remo", nombre: "Remo con barra" });
  const conBiserie = () => agregarBiserie(
    agregarEjercicio(vacio(), plancha, null, 1),
    { e: ej(), previas: null, seriesRutina: 3 },
    { e: remo, previas: null, seriesRutina: 2 },
  );

  it("agrega los dos seguidos, con la misma marca e igualados en rondas", () => {
    const b = conBiserie();
    expect(b.ejercicios.map((e) => [e.ejercicioId, e.biserie])).toEqual([["plancha", undefined], ["press-banca", "b1"], ["remo", "b1"]]);
    expect(b.ejercicios[1].series).toHaveLength(3);
    expect(b.ejercicios[2].series).toHaveLength(3);
    expect(unidades(b)).toEqual([[0], [1, 2]]);
    expect(companero(b, 2)).toBe(1);
    expect(companero(b, 0)).toBeNull();
  });

  it("la segunda biserie lleva otra marca, y no se agrega lo que ya está", () => {
    const b = conBiserie();
    const otra = agregarBiserie(b, { e: dominadas, previas: null, seriesRutina: 1 }, { e: ej({ id: "curl", nombre: "Curl" }), previas: null, seriesRutina: 1 });
    expect(otra.ejercicios.slice(-2).map((e) => e.biserie)).toEqual(["b2", "b2"]);
    expect(agregarBiserie(b, { e: ej(), previas: null, seriesRutina: 1 }, { e: dominadas, previas: null, seriesRutina: 1 })).toBe(b);
  });

  it("las rondas se agregan y se quitan para los dos", () => {
    const b = agregarRonda(conBiserie(), 2);
    expect([b.ejercicios[1].series.length, b.ejercicios[2].series.length]).toEqual([4, 4]);
    const c = quitarRonda(b, 1, 0);
    expect([c.ejercicios[1].series.length, c.ejercicios[2].series.length]).toEqual([3, 3]);
  });

  it("quitar la biserie saca a los dos; quitar uno deja al otro suelto", () => {
    expect(quitarBloque(conBiserie(), 1).ejercicios.map((e) => e.ejercicioId)).toEqual(["plancha"]);
    const suelto = quitarEjercicio(conBiserie(), 1);
    expect(suelto.ejercicios.map((e) => [e.ejercicioId, e.biserie])).toEqual([["plancha", undefined], ["remo", undefined]]);
  });

  it("se envía con su marca; si solo se anotó uno, va suelto", () => {
    let b = conBiserie();
    b = cambiarSerie(cambiarSerie(b, 2, 0, "peso", "30"), 2, 0, "reps", "12");
    b = cambiarSerie(cambiarSerie(b, 1, 0, "peso", "40"), 1, 0, "reps", "10");
    b = cambiarSerie(b, 0, 0, "reps", "30");
    const r = paraEnviar(b);
    expect(r.ok && r.datos.ejercicios.map((e) => [e.ejercicioId, e.biserie])).toEqual([["plancha", undefined], ["press-banca", "b1"], ["remo", "b1"]]);
    // Del press hoy no anotó nada: el remo se guarda suelto.
    let c = conBiserie();
    c = cambiarSerie(cambiarSerie(c, 2, 0, "peso", "30"), 2, 0, "reps", "12");
    const soloUno = paraEnviar(c);
    expect(soloUno.ok && soloUno.datos.ejercicios).toEqual([{ ejercicioId: "remo", series: [{ reps: 12, peso: 30 }] }]);
  });

  it("una sesión guardada se corrige con su biserie", () => {
    const s: Sesion = {
      id: "s1", fecha: "2026-10-12", origen: "manual", ejercicios: [
        { ejercicioId: "press-banca", nombre: "Press de banca", biserie: "b1", series: [{ reps: 10, peso: 40 }] },
        { ejercicioId: "remo", nombre: "Remo con barra", biserie: "b1", series: [{ reps: 12, peso: 30 }] },
      ],
    };
    expect(unidades(borradorDeSesion(s, [ej(), remo]))).toEqual([[0, 1]]);
  });
});

describe("cierre automático a las 3 horas", () => {
  const HORA = 3_600_000;
  const inicio = Date.UTC(2026, 9, 20, 15, 0);
  const borrador = (campos: Partial<Borrador> = {}): Borrador => ({
    id: "b1234567", fecha: "2026-10-20", iniciado: inicio,
    ejercicios: [
      {
        ejercicioId: "press-banca", nombre: "Press de banca", tipo: "peso", gifRuta: null, unidad: "kg",
        series: [{ reps: "10", peso: "40" }, { reps: "8", peso: "" }, { reps: "", peso: "" }],
      },
      { ejercicioId: "plancha", nombre: "Plancha", tipo: "tiempo", gifRuta: null, series: [{ reps: "", peso: "" }] },
    ],
    ...campos,
  });

  it("antes de las 3 horas no hace nada", () => {
    expect(cierreAutomatico(borrador(), inicio + 3 * HORA - 1)).toBeNull();
  });

  it("a las 3 horas lo manda con lo completo y deja fuera la serie a medio llenar", () => {
    const r = cierreAutomatico(borrador({ anotado: inicio + 50 * 60_000 }), inicio + 3 * HORA);
    expect(r?.tipo).toBe("enviar");
    if (r?.tipo !== "enviar") return;
    expect(r.datos.ejercicios).toEqual([{ ejercicioId: "press-banca", series: [{ reps: 10, peso: 40 }] }]);
    expect(r.datos.fecha).toBe("2026-10-20");
    expect(r.datos.iniciadaEn).toBe(inicio);
  });

  it("lo da por terminado a la hora de su última anotación", () => {
    const r = cierreAutomatico(borrador({ anotado: inicio + 50 * 60_000 }), inicio + 5 * HORA);
    expect(r?.tipo === "enviar" && r.datos.terminadaEn).toBe(inicio + 50 * 60_000);
  });

  it("si nunca anotó después de iniciar, a las 3 horas justas", () => {
    const r = cierreAutomatico(borrador(), inicio + 5 * HORA);
    expect(r?.tipo === "enviar" && r.datos.terminadaEn).toBe(inicio + 3 * HORA);
  });

  it("sin ninguna serie completa se descarta", () => {
    const vacio = borrador({ ejercicios: [{ ejercicioId: "press-banca", nombre: "Press de banca", tipo: "peso", gifRuta: null, series: [{ reps: "8", peso: "" }] }] });
    expect(cierreAutomatico(vacio, inicio + 3 * HORA)).toEqual({ tipo: "descartar" });
  });

  it("una corrección de un entrenamiento pasado, o uno sin hora de inicio, no se cierra solo", () => {
    expect(cierreAutomatico(borrador({ edicion: true }), inicio + 9 * HORA)).toBeNull();
    expect(cierreAutomatico(borrador({ iniciado: undefined }), inicio + 9 * HORA)).toBeNull();
  });

  it("se queda la bajada completa y se va la incompleta", () => {
    const b = borrador({ ejercicios: [{
      ejercicioId: "press-banca", nombre: "Press de banca", tipo: "peso", gifRuta: null,
      series: [{ reps: "10", peso: "40", caidas: [{ reps: "8", peso: "30" }, { reps: "6", peso: "" }] }],
    }] });
    const r = cierreAutomatico(b, inicio + 3 * HORA);
    expect(r?.tipo === "enviar" && r.datos.ejercicios[0].series).toEqual([{ reps: 10, peso: 40, caidas: [{ reps: 8, peso: 30 }] }]);
  });
});

describe("cardio", () => {
  const caminadora: EjercicioBanco = { id: "caminadora", nombre: "Caminadora", tipo: "cardio", grupo: "cardio", musculos: { cuadriceps: 0.5 }, gifRuta: null };
  const conMinutos = (serie: Record<string, string>) => paraEnviar({
    id: "b1234567", fecha: "2026-10-20",
    ejercicios: [{ ejercicioId: "caminadora", nombre: "Caminadora", tipo: "cardio", gifRuta: null, series: [{ reps: "", peso: "", ...serie }] }],
  });

  it("se manda como una sola anotación: minutos en reps, más inclinación y velocidad", () => {
    expect(conMinutos({ reps: "25", inclinacion: "8", velocidad: "5,5" })).toMatchObject({
      ok: true, datos: { ejercicios: [{ ejercicioId: "caminadora", series: [{ reps: 25, peso: null, inclinacion: 8, velocidad: 5.5 }] }] },
    });
  });

  it("la inclinación y la velocidad son opcionales; los minutos no", () => {
    expect(conMinutos({ reps: "30" })).toMatchObject({ ok: true, datos: { ejercicios: [{ series: [{ reps: 30, peso: null }] }] } });
    expect(conMinutos({ velocidad: "6" })).toEqual({ ok: false, error: "Caminadora: faltan los minutos." });
    expect(conMinutos({ reps: "12.5" })).toEqual({ ok: false, error: "Caminadora: los minutos van en número entero." });
    expect(conMinutos({ reps: "20", velocidad: "rápido" })).toEqual({ ok: false, error: "Caminadora: la velocidad no es un número." });
  });

  it("sin nada escrito no se manda, como una serie en blanco", () => {
    expect(conMinutos({})).toEqual({ ok: false, error: "Anota al menos una serie antes de guardar." });
  });

  it("al elegirla de la lista entra en una sola anotación en blanco, aunque ya la hubiera hecho", () => {
    const b = agregarEjercicio(nuevoBorrador("b1234567", "2026-10-20"), caminadora, [{ reps: 25, peso: null, velocidad: 5.5 }], 4);
    expect(b.ejercicios[0].series).toEqual([{ reps: "", peso: "", inclinacion: "", velocidad: "" }]);
    expect(resumenSeries(b.ejercicios[0])).toBe("Sin anotar");
  });

  it("el texto del historial", () => {
    expect(textoCardio({ reps: 25, inclinacion: 8, velocidad: 5.5 }, "caminadora")).toBe("25 min · inclinación 8 · 5.5 km/h");
    expect(textoCardio({ reps: 30, velocidad: 7 }, "bicicleta")).toBe("30 min · velocidad 7");
  });

  it("Tu semana suma los minutos de cardio", () => {
    const sesiones: Sesion[] = [{ id: "s", fecha: "2026-10-20", origen: "manual", ejercicios: [{ ejercicioId: "caminadora", nombre: "Caminadora", series: [{ reps: 25, peso: null }] }] }];
    expect(resumenSemana(sesiones, "2026-10-20", [caminadora]).minutosCardio).toBe(25);
    expect(resumenSemana(sesiones, "2026-10-20").minutosCardio).toBe(0);
  });
});
