import type { Asistencia } from "./datos";

/**
 * Cupo mensual de revives del cliente.
 *
 * GEMELO: `CupoRevivesCalculator` en Kotlin. Si cambia allá, cambia acá.
 *
 * No hay contador en ningún lado: se cuenta consultando las asistencias del mes. Se prefiere
 * contar antes que mantener un contador porque si el entrenador desmarca una justificada
 * desde su app, el cupo se le devuelve al cliente solo; un contador se quedaría viejo y
 * habría que acordarse de corregirlo en un lugar que nadie mira.
 */

export const MAXIMO_POR_MES = 3;

/**
 * [mes] en formato `AAAA-MM`. Las fechas son strings ISO, así que comparar por prefijo es
 * exacto y no necesita parsear nada.
 *
 * Exige las dos banderas: `justificadaPorCliente` marca quién la pidió, y `justificada` si
 * sigue vigente. El entrenador puede desmarcar la segunda sin borrar la primera, y en ese
 * caso el revive no debe seguir contando como gastado.
 */
export function gastadosEnElMes(asistencias: Asistencia[], mes: string): number {
  return asistencias.filter(
    (a) => a.justificadaPorCliente === true && a.justificada && a.fecha.startsWith(`${mes}-`)
  ).length;
}

export function disponiblesEnElMes(asistencias: Asistencia[], mes: string): number {
  return Math.max(MAXIMO_POR_MES - gastadosEnElMes(asistencias, mes), 0);
}
