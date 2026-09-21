/**
 * Interpretación del trío que denormaliza la app Android.
 *
 * GEMELO: `RutinaProgressCalculator.interpretar` en Kotlin. Si cambia allá, cambia acá.
 * Toda la lógica difícil (ancla, historial, clientes anteriores al corte) queda del lado
 * de Kotlin a propósito: acá solo se interpreta el resultado.
 *
 * Dos diferencias deliberadas con el gemelo, las dos por la misma razón —la página necesita
 * distinguir casos que a Kotlin le daba igual colapsar:
 *  1. Sin rutina, Kotlin devuelve `SinRutina` y acá se devuelve `null`, porque la página elige
 *     qué tarjeta mostrar con eso.
 *  2. El descanso es el literal `DESCANSO` y no un tipo sellado, porque `null` ya estaba
 *     tomado por el caso anterior.
 */

/** Hoy no hay día que hacer: ya completó el ciclo de la semana. */
export const DESCANSO = "descanso" as const;

export type DiaQueToca = number | null | typeof DESCANSO;

export interface DiaDenormalizado {
  dia: number | null | undefined;
  fecha: string | null | undefined;
  esAncla: boolean | undefined;
}

/**
 * Lunes de la semana en la que cae [fecha].
 *
 * GEMELO: `SemanaDeRutina.lunesDe` en Kotlin.
 *
 * Construye la fecha a mediodía UTC y lee `getUTCDay`, igual que `esFinDeSemana`: con la hora
 * local, un navegador al este o al oeste de UTC puede caer en el día de al lado y responder
 * una semana distinta de la que responde Kotlin.
 */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  const diaSemana = d.getUTCDay(); // 0 = domingo
  const retroceso = diaSemana === 0 ? 6 : diaSemana - 1;
  d.setUTCDate(d.getUTCDate() - retroceso);
  return d.toISOString().slice(0, 10);
}

/**
 * Domingo anterior al lunes de la semana de [fecha].
 *
 * GEMELO: `SemanaDeRutina.domingoAnterior` en Kotlin. Es la fecha del ancla del reinicio, y
 * es domingo y no lunes porque el ancla es exclusiva.
 */
export function domingoAnterior(fecha: string): string {
  const d = new Date(`${lunesDe(fecha)}T12:00:00`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function interpretar(
  valor: DiaDenormalizado,
  totalDias: number,
  fecha: string,
  reinicioSemanal = false
): DiaQueToca {
  // `== null` a proposito, no `===`: Firestore omite los campos que nunca se escribieron,
  // asi que un cliente anterior a la denormalizacion llega con `undefined` y no con `null`.
  // Con `===` se colaba hasta `Math.max(undefined, 0)`, que da NaN, y NaN tampoco lo
  // atrapaba el `indice === null` de quien llama: terminaba indexando `dias[NaN]`.
  if (valor.dia == null || totalDias <= 0) return null;
  const acotado = Math.min(Math.max(valor.dia, 0), totalDias - 1);

  // Antes que el ancla: con reinicio, un ancla de la semana pasada también se reinicia.
  // Los dos comparadores son los del gemelo Kotlin: el ancla con `<` y la asistencia con
  // `<=`. **No truncar las dos fechas a lunes**: en ISO el domingo pertenece a la semana que
  // abrió el lunes anterior, y las anclas se fechan en domingo a propósito, así que truncar
  // reiniciaría un ancla de esta semana — y la clienta que cambia su día un lunes vería el
  // día 1 en la web mientras la app le muestra el 3.
  if (reinicioSemanal && valor.fecha != null) {
    const domingo = domingoAnterior(fecha);
    if (valor.esAncla && valor.fecha < domingo) return 0;
    if (!valor.esAncla && valor.fecha <= domingo) return 0;
  }

  if (valor.esAncla) return acotado;
  if (valor.fecha === fecha) return acotado;
  if (reinicioSemanal && acotado + 1 >= totalDias) return DESCANSO;
  return acotado + 1 >= totalDias ? 0 : acotado + 1;
}
