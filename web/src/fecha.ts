/**
 * Zona del gimnasio (Culiacán, GMT-7). Se fija a propósito en vez de usar la del
 * dispositivo: la app calcula el día en la zona del entrenador, y si el navegador usara
 * otra, el cliente vería un día distinto del que ve él.
 *
 * GEMELO: `SincronizadorDiaWeb.ZONA` en Kotlin.
 */
const ZONA = "America/Mazatlan";

/** Fecha de hoy en formato ISO (AAAA-MM-DD) según la zona del gimnasio. */
export function hoyEnMazatlan(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Hora actual (HH:MM) en la zona del gimnasio. La usa la línea de confirmación del cambio de
 * día: si mostrara la hora del dispositivo, un cliente de viaje vería una hora que no
 * corresponde con el día que acaba de cambiar.
 */
export function horaEnMazatlan(): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}
