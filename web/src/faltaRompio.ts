import type { Asistencia } from "./datos";

/**
 * La única falta pasada que el cliente puede justificar desde la web.
 *
 * GEMELO: `FaltaQueRompioLaRacha` en Kotlin. Si cambia allá, cambia acá.
 *
 * Acotarlo a una sola fecha es lo que impide que revivir la racha sea "justificar cualquier
 * día de mi historial": se repara la rotura más reciente o no se repara nada.
 */

/** Tope de seguridad: sin él, un dato raro haría girar el bucle para siempre. */
const MAXIMO_DIAS_HACIA_ATRAS = 3650;

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

export function faltaQueRompioLaRacha(asistencias: Asistencia[], hoy: string): string | null {
  // El primer registro es el piso del historial: antes de él el cliente no existía para el
  // gimnasio, así que un día hábil sin registro anterior a esa fecha no es una falta suya y
  // no hay nada que reparar. Sin este piso, un cliente nuevo vería como "falta" el día hábil
  // anterior a su alta.
  if (asistencias.length === 0) return null;
  const primerRegistro = asistencias.reduce(
    (min, a) => (a.fecha < min ? a.fecha : min),
    asistencias[0].fecha
  );
  const cuentan = fechasQueCuentan(asistencias);

  // Se camina hacia atrás desde ayer, saltando fines de semana, hasta el primer día hábil
  // que no cuenta: ése es el que cortó la racha. Se sigue caminando por encima de los días
  // que sí cuentan porque la racha viva puede haber arrancado DESPUÉS de la rotura — el caso
  // normal, de hecho: el cliente falta un día y vuelve al siguiente.
  //
  // Empezar en ayer y no en hoy es lo que hace que hoy nunca se devuelva: hoy se justifica
  // por el otro camino, el de "hoy no voy a poder ir".
  let fecha = restarUnDia(hoy);
  let vueltas = 0;
  while (fecha >= primerRegistro && vueltas < MAXIMO_DIAS_HACIA_ATRAS) {
    if (esDiaHabil(fecha) && !cuentan.has(fecha)) return fecha;
    fecha = restarUnDia(fecha);
    vueltas++;
  }
  return null;
}
