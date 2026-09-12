/**
 * La unica falta pasada que el cliente puede justificar desde la web.
 *
 * Acotarlo a una sola fecha es lo que impide que revivir la racha sea "justificar cualquier
 * dia de mi historial": se repara la rotura mas reciente o no se repara nada.
 *
 * GEMELO: `FaltaQueRompioLaRacha.kt` en Kotlin y `web/src/faltaRompio.ts`. Son tres copias del
 * mismo algoritmo; si cambia una, cambian las otras dos. Se duplica a proposito: `functions/` y
 * `web/` son proyectos npm separados, y lo que no puede pasar es que el servidor confie en la
 * fecha que mande la pagina, asi que esta copia es la que manda.
 */

/** Lo minimo que necesita el calculo de un registro de asistencia. */
export interface AsistenciaParaRacha {
  fecha: string;
  asistio: boolean;
  justificada: boolean;
}

/** Tope de seguridad: sin el, un dato raro haria girar el bucle para siempre. */
const MAXIMO_DIAS_HACIA_ATRAS = 3650;

/**
 * Las fechas se manejan como strings ISO y se pasan por un Date fijado al mediodia UTC solo
 * para restar dias. El mediodia evita que un corrimiento de zona mueva el dia, y comparar
 * strings ISO es exacto sin volver a parsear.
 */
function restarUnDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function esDiaHabil(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return dia !== 0 && dia !== 6;
}

/**
 * Fechas que cuentan para la racha: las asistidas y las faltas justificadas ("soborno"), que
 * valen igual que una asistencia. Mismo criterio que `RachaCalculator.fechasQueCuentan`.
 */
function fechasQueCuentan(asistencias: AsistenciaParaRacha[]): Set<string> {
  return new Set(asistencias.filter((a) => a.asistio || a.justificada).map((a) => a.fecha));
}

export function faltaQueRompioLaRacha(
  asistencias: AsistenciaParaRacha[],
  hoy: string
): string | null {
  // El primer registro es el piso del historial: antes de el el cliente no existia para el
  // gimnasio, asi que un dia habil sin registro anterior a esa fecha no es una falta suya y no
  // hay nada que reparar. Sin este piso, un cliente nuevo veria como "falta" el dia habil
  // anterior a su alta.
  if (asistencias.length === 0) return null;
  const primerRegistro = asistencias.reduce(
    (min, a) => (a.fecha < min ? a.fecha : min),
    asistencias[0].fecha
  );
  const cuentan = fechasQueCuentan(asistencias);

  // Se camina hacia atras desde ayer, saltando fines de semana, hasta el primer dia habil que
  // no cuenta: ese es el que corto la racha. Se sigue caminando por encima de los dias que si
  // cuentan porque la racha viva puede haber arrancado DESPUES de la rotura — el caso normal,
  // de hecho: el cliente falta un dia y vuelve al siguiente.
  //
  // Empezar en ayer y no en hoy es lo que hace que hoy nunca se devuelva: hoy se justifica por
  // el otro camino, el de "hoy no voy a poder ir".
  let fecha = restarUnDia(hoy);
  let vueltas = 0;
  while (fecha >= primerRegistro && vueltas < MAXIMO_DIAS_HACIA_ATRAS) {
    if (esDiaHabil(fecha) && !cuentan.has(fecha)) return fecha;
    fecha = restarUnDia(fecha);
    vueltas++;
  }
  return null;
}
