import type { AsistenciaParaRacha } from "./faltaRompio";

/**
 * Racha actual y racha mas larga de un cliente, para el ranking.
 *
 * GEMELO: `RachaCalculator` en Kotlin (`calcularRachaActual` y `calcularRachaMasLarga`) y
 * `rachaActual` en `web/src/racha.ts`. Si cambia la regla en uno, cambia en los demas. Se
 * duplica porque `functions/` y `web/` son proyectos npm separados y el ranking lo calcula el
 * servidor: la pagina solo puede leer sus propias asistencias.
 *
 * Las fechas son strings ISO pasadas por un Date al mediodia UTC solo para mover dias, igual
 * que en `faltaRompio.ts`: el mediodia evita que un corrimiento de zona cambie el dia.
 */

function esDiaHabil(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return dia !== 0 && dia !== 6;
}

function moverDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Las justificadas ("soborno") valen igual que una asistencia para la racha. */
export function fechasQueCuentan(asistencias: AsistenciaParaRacha[]): Set<string> {
  return new Set(asistencias.filter((a) => a.asistio || a.justificada).map((a) => a.fecha));
}

export function rachaActual(cuentan: Set<string>, hoy: string): number {
  let fecha = hoy;
  // Dia de gracia: si hoy es habil y todavia no hay registro, no corta la racha.
  if (esDiaHabil(fecha) && !cuentan.has(fecha)) fecha = moverDias(fecha, -1);

  let racha = 0;
  // Tope de seguridad, igual que en la web: un dato raro no debe colgar la funcion.
  for (let i = 0; i < 3650; i++) {
    if (esDiaHabil(fecha)) {
      if (!cuentan.has(fecha)) break;
      racha++;
    }
    fecha = moverDias(fecha, -1);
  }
  return racha;
}

/**
 * Tope de dias hacia atras desde el ultimo registro, igual de generoso que el de `rachaActual`
 * (~27 años). Sin esto, una fecha con formato valido pero un typo de año (ej. "0026-09-08" en
 * vez de "2026-09-08") hacia que el rango "primero a ultimo registro" abarcara miles de años:
 * no tronaba, pero bloqueaba la funcion varios segundos por cada registro asi, y
 * `armarRanking` recorre a TODOS los clientes en la misma llamada.
 */
const TOPE_DIAS_HISTORIA = 3650 * 3;

/** La corrida mas larga de dias habiles contados, del primer al ultimo registro. */
export function rachaMasLarga(cuentan: Set<string>): number {
  if (cuentan.size === 0) return 0;
  const fechas = [...cuentan].sort();
  const fin = fechas[fechas.length - 1];
  // El recorte es al inicio, nunca al final: la racha viva vive junto al ultimo registro, asi
  // que acotar por ahi es lo que arriesgaria el resultado.
  const primero = moverDias(fin, -TOPE_DIAS_HISTORIA);
  const inicio = fechas[0] > primero ? fechas[0] : primero;
  let mejor = 0;
  let actual = 0;
  for (let fecha = inicio; fecha <= fin; fecha = moverDias(fecha, 1)) {
    if (!esDiaHabil(fecha)) continue;
    if (cuentan.has(fecha)) {
      actual++;
      if (actual > mejor) mejor = actual;
    } else {
      actual = 0;
    }
  }
  return mejor;
}
