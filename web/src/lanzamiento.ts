/**
 * La ventana emergente del resumen mensual en Inicio ("Tu resumen de <mes> ya está listo") y que
 * la notificación del resumen lleve a ella se encienden el día del lanzamiento (entrenador,
 * 2026-11-24: "que no llegue ninguna notificación ni nada hasta el 1 de diciembre"). El diseño
 * nuevo del resumen (las historias) ya está activo para todos los meses desde antes.
 *
 * Es la fecha en Mazatlán, como `hoy` en toda la página: el 1 de diciembre a las 00:00 de allá.
 * Ese día, a las 00:30, `cerrarMes` guarda el resumen de noviembre y a las 9:00 sale su aviso.
 *
 * Pasada la fecha, esto se puede quitar.
 */
export const LANZAMIENTO_AVISO_RESUMEN = "2026-12-01";

export function avisoResumenActivo(hoy: string): boolean {
  return hoy >= LANZAMIENTO_AVISO_RESUMEN;
}
