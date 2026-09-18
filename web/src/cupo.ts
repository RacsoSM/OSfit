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
 *
 * Desde la ruleta (2026-09-18) el máximo del mes ya no es fijo: perder la ruleta un mes le
 * quita un revive al siguiente. El castigo tampoco se guarda como número — se deduce del
 * documento `ruletas/{cliente}_{mes anterior}`, así que borrar ese documento devuelve el cupo
 * solo, igual que desmarcar una justificada.
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

/**
 * Lo que le queda al cliente este mes.
 *
 * [castigo] son los revives que perdió por fallar la ruleta el mes pasado (0 o 1). Entra como
 * parámetro y no se lee acá adentro a propósito: esta función es pura y se prueba en Node,
 * donde no hay Firestore. Quien la llama ya tiene el documento de la tirada.
 */
export function disponiblesEnElMes(
  asistencias: Asistencia[],
  mes: string,
  castigo = 0
): number {
  return Math.max(MAXIMO_POR_MES - castigo - gastadosEnElMes(asistencias, mes), 0);
}
