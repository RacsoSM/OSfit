import { describe, expect, it } from "vitest";
import type { EjercicioBanco, Sesion } from "./datos";
import {
  agregarEjercicio,
  agregarSerie,
  borradorDeSesion,
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
} from "./registro";
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

  it("con historial prellena con lo que hizo la última vez", () => {
    const b = agregarEjercicio(vacio(), ej(), [{ reps: 10, peso: 40 }, { reps: 8, peso: 42.5 }], 4);
    expect(b.ejercicios[0].series).toEqual([{ reps: "10", peso: "40" }, { reps: "8", peso: "42.5" }]);
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

  it("una máquina de placas abre en barras y lo de la última vez se muestra en barras", () => {
    const b = agregarEjercicio(nuevoBorrador("b1", "2026-10-13"), jalon, [{ reps: 10, peso: barrasAKg(6) }], null);
    expect(b.ejercicios[0].unidad).toBe("barras");
    expect(b.ejercicios[0].series[0].peso).toBe("6");
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

