import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, type Timestamp } from "firebase-admin/firestore";
import { sesionVigente } from "./corteAcceso";

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
 * El `clienteId` del token de sesion, o un error si no hay o si su acceso fue revocado.
 *
 * Es la unica puerta: ninguna funcion debe aceptar un clienteId que venga en el body, porque
 * eso seria dejar que el navegador diga de quien es la sesion. El claim lo pone `sesion` al
 * canjear el token del link y viaja firmado por Firebase.
 *
 * El claim no basta: una sesion sigue viva aunque el entrenador haya revocado el acceso. Por
 * eso tambien se exige que se haya iniciado despues de `accesoRevocadoEn`, que escribe
 * `alRevocarAcceso` (ver `sesionVigente`). Cuesta una lectura del cliente por llamada.
 */
export async function clienteDeLaSesion(request: CallableRequest): Promise<string> {
  const clienteId = request.auth?.token?.clienteId;
  if (typeof clienteId !== "string" || clienteId === "") {
    throw new HttpsError("unauthenticated", "sesion_invalida");
  }
  const corte = (await db().collection("clientes").doc(clienteId).get())
    .get("accesoRevocadoEn") as Timestamp | undefined;
  if (!sesionVigente(request.auth?.token?.auth_time, corte ? corte.toMillis() : null)) {
    throw new HttpsError("unauthenticated", "acceso_revocado");
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
