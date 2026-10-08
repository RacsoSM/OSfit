/**
 * Qué ofrecerle a la clienta sobre las notificaciones. Puro: el navegador entra por
 * `EntornoNotificaciones`, que arma `notificacionesNavegador.ts`, así que esto se prueba con
 * datos y sin DOM.
 *
 * La regla que lo ordena todo es de Apple, no nuestra: en iPhone una página web solo recibe
 * notificaciones si está instalada en la pantalla de inicio (iOS 16.4 o más) y se abrió
 * desde ese ícono. Ver docs/superpowers/specs/2026-10-08-notificaciones-web-pwa-design.md.
 */

export type Permiso = "default" | "granted" | "denied" | "sin-api";

export interface EntornoNotificaciones {
  ua: string;
  /** Abierta desde el ícono de la pantalla de inicio (`display-mode: standalone`). */
  instalada: boolean;
  /** Existen `serviceWorker`, `PushManager` y `Notification`. */
  tienePush: boolean;
  permiso: Permiso;
  /** La ruta es `/c/<token>`. Sin token, la página instalada no tendría con qué entrar. */
  tokenEnRuta: boolean;
}

export type EstadoNotificaciones =
  | "no-habilitada"
  | "instalar"
  | "instalar-desde-link"
  | "no-soportado"
  | "pedir-permiso"
  | "activadas"
  | "bloqueadas";

export function versionIos(ua: string): [number, number] | null {
  const m = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)_(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function plataforma(ua: string): "ios" | "android" | "otro" {
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "otro";
}

export function estadoNotificaciones(
  habilitada: boolean,
  e: EntornoNotificaciones
): EstadoNotificaciones {
  if (!habilitada) return "no-habilitada";
  const ios = versionIos(e.ua);
  if (ios && (ios[0] < 16 || (ios[0] === 16 && ios[1] < 4))) return "no-soportado";
  // En iPhone sin instalar no se pregunta por la API: en Safari no existe y dentro de
  // WhatsApp tampoco. Lo único que sirve ahí es explicar cómo instalarla.
  if (ios && !e.instalada) return e.tokenEnRuta ? "instalar" : "instalar-desde-link";
  if (!e.tienePush || e.permiso === "sin-api") return "no-soportado";
  if (e.permiso === "granted") return "activadas";
  if (e.permiso === "denied") return "bloqueadas";
  return "pedir-permiso";
}
