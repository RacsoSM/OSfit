import { describe, expect, it } from "vitest";
import { mesesConActividad, resumenDelMes, ultimoDiaDe, mesAnterior, nombreMes, type EntradaResumen } from "./resumenMensual";
import * as web from "../../web/src/resumenMensual";

/** El gemelo tiene que dar exactamente lo mismo que la web con los mismos datos. */
describe("gemelo de web/src/resumenMensual.ts", () => {
  const banco = [
    { id: "banca", nombre: "Press de banca", tipo: "peso" as const, musculos: { pecho: 1, triceps: 0.5 },
      estandares: { H: [0.5, 0.625, 0.75, 0.875, 1, 1.137, 1.275, 1.665], M: [0.25, 0.375, 0.5, 0.625, 0.75, 0.8, 0.85, 1.244] } },
    // Con lista: el cruce no pinta pecho mientras haya banca (va de respaldo).
    { id: "cruce", nombre: "Cruce de poleas", tipo: "peso" as const, musculos: { pecho: 1 }, pinta: [] as string[],
      estandares: { H: [0.234, 0.292, 0.351, 0.409, 0.468, 0.532, 0.597, 0.779], M: [0.117, 0.176, 0.234, 0.292, 0.351, 0.374, 0.398, 0.582] } },
    { id: "curl", nombre: "Curl con mancuernas", tipo: "peso" as const, musculos: { biceps: 1 },
      estandares: { H: [0.1, 0.14, 0.18, 0.23, 0.27, 0.3, 0.33, 0.41], M: [0.05, 0.08, 0.1, 0.13, 0.16, 0.18, 0.2, 0.3] } },
    { id: "lagartijas", nombre: "Lagartijas", tipo: "corporal" as const, musculos: { pecho: 1 },
      estandares: { H: [3, 9, 15, 22, 30, 34, 38, 62], M: [1, 3, 5, 10, 15, 20, 24, 38] } },
    { id: "caminadora", nombre: "Caminadora", tipo: "cardio" as const, musculos: {}, estandares: null },
  ];
  const sesiones = [
    { fecha: "2026-09-20", ejercicios: [{ ejercicioId: "curl", nombre: "Curl", series: [{ reps: 6, peso: 20 }] }] },
    { fecha: "2026-10-13", ejercicios: [
      { ejercicioId: "banca", nombre: "Banca", series: [{ reps: 4, peso: 100, caidas: [{ reps: 8, peso: 70 }] }, { reps: 8, peso: 80 }] },
      { ejercicioId: "cruce", nombre: "Cruce", series: [{ reps: 8, peso: 40.5 }] },
      { ejercicioId: "caminadora", nombre: "Caminadora", series: [{ reps: 20, peso: null }] },
    ] },
    { fecha: "2026-10-20", ejercicios: [
      { ejercicioId: "lagartijas", nombre: "Lagartijas", series: [{ reps: 25, peso: null }] },
      { ejercicioId: "banca", nombre: "Banca", series: [{ reps: 6, peso: 90 }] },
      { ejercicioId: "desconocido", nombre: "Algo nuevo", series: [{ reps: 10, peso: 15 }] },
    ] },
  ];
  const asistencias = [
    { fecha: "2026-09-30", asistio: true, justificada: false },
    { fecha: "2026-10-01", asistio: true, justificada: false, duracionMinutos: 90, diaRutinaRealizado: 0 },
    { fecha: "2026-10-02", asistio: false, justificada: true },
    { fecha: "2026-10-05", asistio: false, justificada: false },
    { fecha: "2026-10-10", asistio: true, justificada: false, duracionMinutos: 60 }, // sábado
    { fecha: "2026-10-13", asistio: true, justificada: false, duracionMinutos: 120, diaRutinaRealizado: 1 },
    { fecha: "2026-10-20", asistio: true, justificada: false, diaRutinaRealizado: 1 },
  ];
  const casos: EntradaResumen[] = [
    { mes: "2026-10", corte: "2026-10-31", asistencias, sesiones, banco,
      perfil: { sexo: "H", peso: 73, porcentajeGrasa: null, anioNacimiento: 2004, nombresDias: ["Pecho", "Brazo"] } },
    { mes: "2026-10", corte: "2026-10-15", asistencias, sesiones, banco,
      perfil: { sexo: "M", peso: 60, porcentajeGrasa: 32, anioNacimiento: 1982, nombresDias: [] } },
    { mes: "2026-09", corte: "2026-09-30", asistencias, sesiones, banco,
      perfil: { sexo: null, peso: null, porcentajeGrasa: null, anioNacimiento: null, nombresDias: [] } },
  ];

  it.each(casos.map((c, i) => [i, c] as const))("caso %i: el mismo resumen", (_i, c) => {
    // Los tipos de la web son más anchos (Sesion trae id y origen); el cálculo no los usa.
    expect(resumenDelMes(c)).toEqual(web.resumenDelMes(c as unknown as web.EntradaResumen));
  });

  it("los mismos meses y fechas", () => {
    expect(mesesConActividad(asistencias, sesiones))
      .toEqual(web.mesesConActividad(asistencias as never, sesiones as never));
    for (const mes of ["2026-01", "2026-02", "2024-02", "2026-12"]) {
      expect([ultimoDiaDe(mes), mesAnterior(mes), nombreMes(mes)])
        .toEqual([web.ultimoDiaDe(mes), web.mesAnterior(mes), web.nombreMes(mes)]);
    }
  });

  it("el caso completo tiene de todo (para que la igualdad pruebe algo)", () => {
    const r = resumenDelMes(casos[0]);
    expect(r.asistencia.entreno).toBe(4);
    expect(r.asistencia.porcentaje).toBe(60); // el sábado no cuenta: 3 de 5 hábiles
    expect(r.entrenamiento.kg).toBeGreaterThan(0);
    expect(r.fuerza?.musculos.pecho).toBeGreaterThan(0);
    expect(r.marcas.length).toBeGreaterThan(1);
    expect(r.entrenamiento.diaFavorito?.nombre).toBe("Brazo");
  });
});
