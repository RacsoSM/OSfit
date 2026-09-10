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
  for (let i = 0; i < 3650; i++) {
    if (esDiaHabil(fecha)) {
      if (!cuentan.has(fecha)) break;
      racha++;
    }
    fecha = restarUnDia(fecha);
  }
  return racha;
}

export function promedioMinutos(asistencias: Asistencia[]): number | null {
  const duraciones = asistencias
    .filter((a) => a.asistio && a.duracionMinutos !== null)
    .map((a) => a.duracionMinutos as number);
  if (duraciones.length === 0) return null;
  return Math.round(duraciones.reduce((s, d) => s + d, 0) / duraciones.length);
}
