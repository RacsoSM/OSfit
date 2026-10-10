import { describe, expect, it } from "vitest";
import type { EjercicioBanco, Sesion } from "./datos";
import {
  agregarEjercicio,
  agregarSerie,
  cambiarSerie,
  leerBorrador,
  nuevoBorrador,
  paraEnviar,
  quitarEjercicio,
  quitarSerie,
  resumenSeries,
  ultimasSeries,
} from "./registro";

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
