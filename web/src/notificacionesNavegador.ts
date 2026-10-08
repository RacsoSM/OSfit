import { app } from "./firebase";
import { registrarDispositivo } from "./acciones";
import { plataforma, type EntornoNotificaciones, type Permiso } from "./notificaciones";
import { tokenEnLaUrl } from "./sesion";

/**
 * Clave pública VAPID del proyecto (consola de Firebase → Cloud Messaging → Certificados de
 * push web). Es pública, como `firebaseConfig`: identifica al remitente, no da permisos.
 */
const CLAVE_VAPID = "PEGAR_CLAVE_VAPID";

export function entornoDelNavegador(): EntornoNotificaciones {
  const tienePush =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const permiso: Permiso = "Notification" in window ? Notification.permission : "sin-api";
  const instalada =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    ua: navigator.userAgent,
    instalada,
    tienePush,
    permiso,
    tokenEnRuta: tokenEnLaUrl(location.pathname) !== null,
  };
}

/**
 * Lo que hace el botón "Activar notificaciones".
 *
 * `requestPermission` va PRIMERO, antes de cualquier otro `await`: iOS solo muestra el
 * diálogo si la llamada sale directo del toque, y un `await` previo (registrar el service
 * worker, importar el SDK) lo deja sin gesto. Ahí falla en silencio y la clienta cree que el
 * botón no hace nada.
 */
export async function activarNotificaciones(): Promise<
  "activadas" | "bloqueadas" | "sin-respuesta" | "error"
> {
  const permiso = await Notification.requestPermission();
  if (permiso === "denied") return "bloqueadas";
  if (permiso !== "granted") return "sin-respuesta";
  try {
    await sincronizarToken();
    return "activadas";
  } catch {
    return "error";
  }
}

/**
 * Saca el token de este teléfono y lo guarda en el servidor. Se llama al activar y en cada
 * carga con el permiso ya dado: FCM puede rotar el token y así el servidor siempre tiene el
 * vigente.
 *
 * El SDK de messaging se importa aquí y no arriba: pesa, y solo hace falta a quien activa.
 * La carga inicial de la página no lo paga (ver punto 5 de `docs/backlog-2.md`).
 */
export async function sincronizarToken(): Promise<void> {
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("messaging_no_soportado");
  await navigator.serviceWorker.register("/sw.js");
  const registro = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), {
    vapidKey: CLAVE_VAPID,
    serviceWorkerRegistration: registro,
  });
  await registrarDispositivo({ token, plataforma: plataforma(navigator.userAgent) });
}
