import type { Asistencia } from "./datos";

/**
 * GEMELO: `RachaCalculator` en Kotlin. Se duplica porque es corto y autocontenido; a
 * diferencia del día de rutina, acá no hay ancla ni historial que interpretar.
 */

function esDiaHabil(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00`).getUTCDay();
  return dia !== 0 && dia !== 6;
}

function restarUnDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Las justificadas ("soborno") valen igual que una asistencia para la racha. */
function fechasQueCuentan(asistencias: Asistencia[]): Set<string> {
  return new Set(asistencias.filter((a) => a.asistio || a.justificada).map((a) => a.fecha));
}

export function rachaActual(asistencias: Asistencia[], hoy: string): number {
  const cuentan = fechasQueCuentan(asistencias);
  let fecha = hoy;

  // Día de gracia: si hoy es hábil y todavía no hay registro, no corta la racha.
  if (esDiaHabil(fecha) && !cuentan.has(fecha)) fecha = restarUnDia(fecha);

  let racha = 0;
  // Tope de seguridad: sin él, un dato raro colgaría la pestaña del cliente.
  // Entre semana, faltar corta. El fin de semana es opcional (2026-10-17): si vino suma, si
  // no vino se salta sin cortar.
  for (let i = 0; i < 3650; i++) {
    if (cuentan.has(fecha)) racha++;
    else if (esDiaHabil(fecha)) break;
    fecha = restarUnDia(fecha);
  }
  return racha;
}

/** Tope hacia atrás desde el último registro, igual que en el servidor: un año con typo no cuelga la página. */
const TOPE_DIAS_HISTORIA = 3650 * 3;

/**
 * La racha más larga de todo su historial. Con ella se decide el revive extra (ver
 * `maximoPorMes` en `cupo.ts`).
 *
 * GEMELO: `rachaMasLarga` en `functions/src/rachas.ts` y `RachaCalculator.calcularRachaMasLarga`.
 */
export function rachaMasLarga(asistencias: Asistencia[]): number {
  const cuentan = fechasQueCuentan(asistencias);
  if (cuentan.size === 0) return 0;
  const fechas = [...cuentan].sort();
  const fin = fechas[fechas.length - 1];
  let primero = fin;
  for (let i = 0; i < TOPE_DIAS_HISTORIA && primero > fechas[0]; i++) primero = restarUnDia(primero);
  let mejor = 0;
  let actual = 0;
  for (let fecha = primero; fecha <= fin; fecha = sumarUnDia(fecha)) {
    if (cuentan.has(fecha)) {
      actual++;
      if (actual > mejor) mejor = actual;
    } else if (esDiaHabil(fecha)) {
      actual = 0;
    }
  }
  return mejor;
}

function sumarUnDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function promedioMinutos(asistencias: Asistencia[]): number | null {
  // Se exige que sea un numero, no solo que no sea null: las asistencias anteriores al
  // cronometro llegan sin el campo (Firestore omite lo que nunca se escribio, igual que con
  // `justificadaPorCliente`), y `undefined` pasaba el filtro y volvia NaN todo el promedio.
  const duraciones = asistencias
    .map((a) => (a.asistio ? a.duracionMinutos : null))
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d));
  if (duraciones.length === 0) return null;
  return Math.round(duraciones.reduce((s, d) => s + d, 0) / duraciones.length);
}
