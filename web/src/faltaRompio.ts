import type { Asistencia } from "./datos";

/**
 * La única falta pasada que el cliente puede justificar desde la web.
 *
 * GEMELO: `FaltaQueRompioLaRacha` en Kotlin. Si cambia allá, cambia acá.
 *
 * Acotarlo a una sola fecha es lo que impide que revivir la racha sea "justificar cualquier
 * día de mi historial": se repara la rotura más reciente o no se repara nada.
 */

/**
 * Ventana de reparación: los 2 días **hábiles** anteriores a hoy. Una rotura más vieja ya no
 * se puede revivir.
 *
 * Hábiles y no 48 horas de reloj, y la diferencia importa justo en el caso más común. La
 * página no dibuja acciones en fin de semana, así que con horas de reloj una falta del viernes
 * vencería el domingo — sin que el cliente hubiera tenido nunca un botón que tocar. Contando
 * hábiles, el lunes el viernes sigue siendo "el día hábil anterior" y todavía se repara.
 */
const DIAS_HABILES_REPARABLES = 2;

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

  // Se camina hacia atrás desde ayer, saltando fines de semana, y se miran solo los
  // DIAS_HABILES_REPARABLES más recientes. El primero de ellos que no cuente es el que cortó
  // la racha y es el reparable; si los dos cuentan, o si la rotura quedó más atrás, no hay
  // nada que ofrecer.
  //
  // Empezar en ayer y no en hoy es lo que hace que hoy nunca se devuelva: hoy se justifica
  // por el otro camino, el de "hoy no voy a poder ir".
  let fecha = restarUnDia(hoy);
  let habilesExaminados = 0;
  while (habilesExaminados < DIAS_HABILES_REPARABLES && fecha >= primerRegistro) {
    if (esDiaHabil(fecha)) {
      habilesExaminados++;
      if (!cuentan.has(fecha)) return fecha;
    }
    fecha = restarUnDia(fecha);
  }
  return null;
}
