/**
 * El resumen mensual nuevo (las historias a pantalla completa, la ventana emergente de Inicio y
 * que la notificación del resumen lleve a ella) se publicó antes de tiempo y se enciende solo
 * el día del lanzamiento (entrenador, 2026-11-24: "que les aparezca a las clientas cuando
 * termine el mes"). Antes de esa fecha se ve el diseño anterior (`ui/resumenMensualAnterior.ts`).
 *
 * Es la fecha en Mazatlán, como `hoy` en toda la página: el 1 de diciembre a las 00:00 de allá.
 * Ese día, a las 00:30, `cerrarMes` guarda el resumen de noviembre y a las 9:00 sale su aviso.
 *
 * Pasada la fecha, esto y el diseño anterior se pueden quitar.
 */
export const LANZAMIENTO_RESUMEN = "2026-12-01";

export function resumenNuevoActivo(hoy: string): boolean {
  return hoy >= LANZAMIENTO_RESUMEN;
}
