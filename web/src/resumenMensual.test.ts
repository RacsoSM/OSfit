import { describe, expect, it } from "vitest";
import type { Asistencia, EjercicioBanco, Sesion } from "./datos";
import {
  compararFuerza, formatoKg, formatoMinutos, mesAnterior, mesesConActividad, nombreMes, resumenDelMes,
  ultimoDiaDe, type EntradaResumen,
} from "./resumenMensual";

const asis = (fecha: string, x: Partial<Asistencia> = {}): Asistencia =>
  ({ fecha, asistio: false, justificada: false, ...x }) as Asistencia;

const banco: EjercicioBanco[] = [
  { id: "banca", nombre: "Press de banca", tipo: "peso", musculos: { pecho: 1, triceps: 0.5 },
    estandares: { H: [0.5, 0.625, 0.75, 0.875, 1, 1.137, 1.275, 1.665], M: [0.25, 0.375, 0.5, 0.625, 0.75, 0.8, 0.85, 1.244] } },
  { id: "curl", nombre: "Curl con mancuernas", tipo: "peso", musculos: { biceps: 1 },
    estandares: { H: [0.1, 0.14, 0.18, 0.23, 0.27, 0.3, 0.33, 0.41], M: [0.05, 0.08, 0.1, 0.13, 0.16, 0.18, 0.2, 0.3] } },
  { id: "lagartijas", nombre: "Lagartijas", tipo: "corporal", musculos: { pecho: 1 },
    estandares: { H: [3, 9, 15, 22, 30, 34, 38, 62], M: [1, 3, 5, 10, 15, 20, 24, 38] } },
  { id: "caminadora", nombre: "Caminadora", tipo: "cardio", musculos: {} },
  { id: "plancha", nombre: "Plancha", tipo: "tiempo", musculos: { abdomen: 1 } },
];

const sesion = (fecha: string, ejercicios: Sesion["ejercicios"]): Sesion =>
  ({ id: fecha, fecha, origen: "manual", ejercicios }) as Sesion;

function entrada(x: Partial<EntradaResumen> = {}): EntradaResumen {
  return {
    mes: "2026-10", corte: "2026-10-31", asistencias: [], sesiones: [], banco,
    perfil: { sexo: "H", peso: 73, porcentajeGrasa: null, anioNacimiento: 2004, nombresDias: ["Pecho", "Brazo", "Pierna"] },
    ...x,
  };
}

describe("asistencia del mes", () => {
  it("cuenta entrenó, justificadas (también las de la ruleta) y faltas, con el porcentaje", () => {
    const asistencias = [
      ...["01", "02", "05", "06", "07", "08", "09", "12", "13", "14"].map((d) => asis(`2026-10-${d}`, { asistio: true })),
      ...["15", "16", "19", "20", "21", "22"].map((d) => asis(`2026-10-${d}`, { justificada: true })),
      asis("2026-10-23", { justificada: true, ganadaEnRuleta: true }),
      asis("2026-10-26"), asis("2026-10-27"),
    ];
    const a = resumenDelMes(entrada({ asistencias })).asistencia;
    expect([a.entreno, a.justificadas, a.faltas, a.porcentaje]).toEqual([10, 7, 2, 53]);
    expect(a.dias["01"]).toBe("e");
    expect(a.dias["23"]).toBe("j");
    expect(a.dias["26"]).toBe("f");
  });

  it("deja fuera los registros de otro mes y los posteriores al corte", () => {
    const asistencias = [asis("2026-09-30", { asistio: true }), asis("2026-10-27", { asistio: true }), asis("2026-10-29", { asistio: true })];
    const a = resumenDelMes(entrada({ asistencias, corte: "2026-10-28" })).asistencia;
    expect(a.entreno).toBe(1);
    expect(Object.keys(a.dias)).toEqual(["27"]);
  });

  it("la racha que viene del mes anterior cuenta desde el día 1, y el fin de semana no la corta", () => {
    const asistencias = [
      ...["2026-09-28", "2026-09-29", "2026-09-30"].map((f) => asis(f, { asistio: true })),
      // Jue 1, vie 2, (sáb 3 y dom 4 sin registro), lun 5 justificada, mar 6 falta.
      asis("2026-10-01", { asistio: true }), asis("2026-10-02", { asistio: true }),
      asis("2026-10-05", { justificada: true }), asis("2026-10-06"),
    ];
    expect(resumenDelMes(entrada({ asistencias })).asistencia.rachaMasLarga).toBe(3);
  });

  it("suma solo los minutos cronometrados de los días que entrenó", () => {
    const asistencias = [
      asis("2026-10-01", { asistio: true, duracionMinutos: 84 }),
      asis("2026-10-02", { asistio: true }),
      asis("2026-10-05", { asistio: true, duracionMinutos: 157 }),
      asis("2026-10-06", { justificada: true, duracionMinutos: 30 }),
    ];
    const a = resumenDelMes(entrada({ asistencias })).asistencia;
    expect([a.minutos, a.visitasConMinutos]).toEqual([241, 2]);
  });

  it("el fin de semana no cuenta para el porcentaje, pero sí en días entrenados y en el calendario", () => {
    const asistencias = [
      asis("2026-10-01", { asistio: true }), asis("2026-10-02"), // jueves y viernes: 1 de 2
      asis("2026-10-03", { asistio: true }), asis("2026-10-04", { asistio: true }), // sábado y domingo
    ];
    const a = resumenDelMes(entrada({ asistencias })).asistencia;
    expect(a.porcentaje).toBe(50);
    expect(a.entreno).toBe(3);
    expect(a.dias["03"]).toBe("e");
  });

  it("sin registros, el porcentaje es 0", () => {
    expect(resumenDelMes(entrada()).asistencia.porcentaje).toBe(0);
  });
});

describe("entrenamiento del mes", () => {
  it("kg con las bajadas del dropset, sin cardio ni tiempo; los corporales suman series y reps pero no kg", () => {
    const sesiones = [sesion("2026-10-13", [
      { ejercicioId: "banca", nombre: "Banca", series: [{ reps: 10, peso: 60, caidas: [{ reps: 5, peso: 40 }] }, { reps: 8, peso: 70 }] },
      { ejercicioId: "lagartijas", nombre: "Lagartijas", series: [{ reps: 20, peso: null }] },
      { ejercicioId: "caminadora", nombre: "Caminadora", series: [{ reps: 30, peso: null }] },
      { ejercicioId: "plancha", nombre: "Plancha", series: [{ reps: 60, peso: null }] },
    ])];
    const t = resumenDelMes(entrada({ sesiones })).entrenamiento;
    expect(t.kg).toBe(600 + 200 + 560);
    expect(t.series).toBe(3);
    expect(t.reps).toBe(10 + 5 + 8 + 20);
    expect(t.sesiones).toBe(1);
  });

  it("el top cuenta entrenamientos; empata por series y luego por nombre; máximo 5", () => {
    const ej = (ejercicioId: string, n = 1) => ({ ejercicioId, nombre: ejercicioId, series: Array.from({ length: n }, () => ({ reps: 5, peso: 10 })) });
    const sesiones = [
      sesion("2026-10-01", [ej("curl"), ej("banca", 3), ej("a"), ej("b"), ej("c"), ej("d")]),
      sesion("2026-10-02", [ej("curl"), ej("banca")]),
      sesion("2026-10-03", [ej("curl")]),
    ];
    const top = resumenDelMes(entrada({ sesiones })).entrenamiento.top;
    expect(top.map((t) => t.ejercicioId)).toEqual(["curl", "banca", "a", "b", "c"]);
    expect(top[0]).toEqual({ ejercicioId: "curl", nombre: "Curl con mancuernas", veces: 3 });
  });

  it("el día favorito es el más entrenado, con el nombre de su rutina", () => {
    const asistencias = [
      asis("2026-10-01", { asistio: true, diaRutinaRealizado: 1 }),
      asis("2026-10-02", { asistio: true, diaRutinaRealizado: 1 }),
      asis("2026-10-05", { asistio: true, diaRutinaRealizado: 0 }),
      asis("2026-10-06", { justificada: true, diaRutinaRealizado: 2 }),
    ];
    expect(resumenDelMes(entrada({ asistencias })).entrenamiento.diaFavorito).toEqual({ indice: 1, nombre: "Brazo", veces: 2 });
    expect(resumenDelMes(entrada()).entrenamiento.diaFavorito).toBeNull();
  });
});

describe("fuerza y marcas", () => {
  it("la fuerza de cierre usa las 8 semanas que terminan el último día del mes", () => {
    const vieja = sesion("2026-08-01", [{ ejercicioId: "curl", nombre: "Curl", series: [{ reps: 6, peso: 40 }] }]);
    const delMes = sesion("2026-10-13", [{ ejercicioId: "banca", nombre: "Banca", series: [{ reps: 4, peso: 100 }] }]);
    const despues = sesion("2026-11-02", [{ ejercicioId: "curl", nombre: "Curl", series: [{ reps: 6, peso: 40 }] }]);
    const f = resumenDelMes(entrada({ sesiones: [vieja, delMes, despues] })).fuerza!;
    expect(Object.keys(f.musculos)).toEqual(["pecho"]);
    expect(f.general).toBe(f.musculos.pecho);
  });

  it("sin peso o sin sexo no hay fuerza ni marcas", () => {
    const sesiones = [sesion("2026-10-13", [{ ejercicioId: "banca", nombre: "Banca", series: [{ reps: 4, peso: 100 }] }])];
    const sinPeso = resumenDelMes(entrada({ sesiones, perfil: { ...entrada().perfil, peso: null } }));
    const sinSexo = resumenDelMes(entrada({ sesiones, perfil: { ...entrada().perfil, sexo: null } }));
    expect([sinPeso.fuerza, sinSexo.fuerza]).toEqual([null, null]);
    expect([sinPeso.marcas, sinSexo.marcas]).toEqual([[], []]);
  });

  it("marcas: la mejor serie de cada ejercicio, sin bajadas, ordenadas por nivel", () => {
    const sesiones = [
      sesion("2026-10-13", [
        { ejercicioId: "banca", nombre: "Banca", series: [{ reps: 4, peso: 100, caidas: [{ reps: 20, peso: 90 }] }, { reps: 10, peso: 60 }] },
        { ejercicioId: "curl", nombre: "Curl", series: [{ reps: 6, peso: 8 }] },
        { ejercicioId: "lagartijas", nombre: "Lagartijas", series: [{ reps: 30, peso: null }] },
        { ejercicioId: "plancha", nombre: "Plancha", series: [{ reps: 90, peso: null }] },
      ]),
    ];
    const marcas = resumenDelMes(entrada({ sesiones })).marcas;
    expect(marcas.map((m) => m.ejercicioId)).toEqual(["banca", "lagartijas", "curl"]);
    expect(marcas[0]).toMatchObject({ nombre: "Press de banca", reps: 4, peso: 100, tipo: "peso" });
    expect(marcas[1]).toMatchObject({ reps: 30, peso: null, tipo: "corporal" });
    expect(marcas[0].nivel).toBeGreaterThan(marcas[1].nivel);
  });
});

describe("meses y formatos", () => {
  it("meses con actividad: entrenó o registró, del más nuevo al más viejo; faltas solas no cuentan", () => {
    const asistencias = [asis("2026-08-04", { asistio: true }), asis("2026-07-01"), asis("2026-09-01", { justificada: true })];
    const sesiones = [sesion("2026-10-13", [])];
    expect(mesesConActividad(asistencias, sesiones)).toEqual(["2026-10", "2026-08"]);
  });

  it("fechas y nombres", () => {
    expect(ultimoDiaDe("2026-02")).toBe("2026-02-28");
    expect(ultimoDiaDe("2026-10")).toBe("2026-10-31");
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(nombreMes("2026-10")).toBe("octubre");
  });

  it("compara contra el mes anterior solo los músculos que tenían nivel", () => {
    const actual = { general: 7, musculos: { pecho: 8, biceps: 7 } };
    expect(compararFuerza(actual, { general: 6, musculos: { pecho: 7.5 } })).toEqual({ pecho: 0.5 });
    expect(compararFuerza(actual, null)).toBeNull();
  });

  it("formatos de tiempo y kg", () => {
    expect(formatoMinutos(1044)).toBe("17 h 24 min");
    expect(formatoMinutos(45)).toBe("45 min");
    expect(formatoMinutos(120)).toBe("2 h");
    expect(formatoKg(59123)).toBe("59,123");
    expect(formatoKg(950)).toBe("950");
    expect(formatoKg(1234567)).toBe("1,234,567");
  });
});
