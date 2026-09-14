import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const REGION = "us-west1";

// El Admin SDK se inicializa aca y en ningun otro lado: llamar a initializeApp() dos veces
// truena en tiempo de arranque. Como todos los modulos de functions pasan por este, queda
// garantizado que corre una sola vez sin depender de cual funcion se cargue primero.
initializeApp();

/**
 * Firestore perezoso: se resuelve al llamarlo, no al cargar el modulo. Si se exportara la
 * instancia ya construida, getFirestore() correria durante el import y el orden entre este
 * modulo y initializeApp() pasaria a importar.
 */
export const db = () => getFirestore();

/**
 * El `clienteId` del token de sesion, o un error si no hay.
 *
 * Es la unica puerta: ninguna funcion debe aceptar un clienteId que venga en el body, porque
 * eso seria dejar que el navegador diga de quien es la sesion. El claim lo pone `sesion` al
 * canjear el token del link y viaja firmado por Firebase.
 */
export function clienteDeLaSesion(request: CallableRequest): string {
  const clienteId = request.auth?.token?.clienteId;
  if (typeof clienteId !== "string" || clienteId === "") {
    throw new HttpsError("unauthenticated", "sesion_invalida");
  }
  return clienteId;
}

/**
 * Hoy en la zona del gimnasio, nunca la del navegador ni la del servidor.
 *
 * GEMELO: `hoyEnMazatlan()` en `web/src/fecha.ts` y `SincronizadorDiaWeb.hoy()` en Kotlin.
 * Las functions corren en UTC, asi que sin esto un cliente que abre la pagina a las 7pm
 * estaria escribiendo sobre el dia de manana.
 *
 * `en-CA` da AAAA-MM-DD, que es justo el formato ISO que usa todo el repo. No se importa el
 * gemelo de la web porque `functions/` y `web/` son dos proyectos npm separados.
 */
export function hoyEnMazatlan(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mazatlan" });
}
