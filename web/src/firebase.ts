import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import {
  almacenesDelNavegador,
  lecturaDelStatus,
  memoriaToken,
  resolverSesion,
} from "./sesion";
import type { ResultadoSesion } from "./sesion";

const firebaseConfig = {
  apiKey: "AIzaSyD-VnmxHFK1ptLWFKgAd80caa7EkiD0PZA",
  authDomain: "osfit-cccfe.firebaseapp.com",
  projectId: "osfit-cccfe",
  storageBucket: "osfit-cccfe.firebasestorage.app",
  messagingSenderId: "754891137796",
  appId: "1:754891137796:web:79f6422b58e8217de82651",
};

const URL_SESION = "https://sesion-cuzhc6pwiq-uw.a.run.app";

export const app = initializeApp(firebaseConfig);
/**
 * Firestore con caché en IndexedDB en vez del caché en memoria por defecto.
 *
 * Es lo que hace que la segunda visita pinte de inmediato: `onSnapshot` entrega primero lo
 * que ya tiene guardado del viaje anterior y recién después lo que llega del servidor, así
 * que la clienta ve su página mientras la red todavía está negociando. De paso baja la
 * cuenta de lecturas, porque el SDK solo pide lo que cambió.
 *
 * `initializeFirestore` y no `getFirestore`: la configuración solo se acepta antes de que
 * exista la instancia, y este módulo es el único lugar donde se crea.
 *
 * Va sin gestor multipestaña a propósito: medido, cuesta 3.5 kB gzip más en un bundle que ya
 * está en el camino crítico, y solo serviría si la clienta abriera su página en dos pestañas
 * a la vez, que en un teléfono no pasa. Cuando pasa, el SDK cae solo al caché en memoria en
 * esa pestaña.
 *
 * Ese mismo respaldo cubre lo demás: si IndexedDB no está disponible —modo privado, cuota
 * llena, o el navegador interno de WhatsApp— avisa por consola y sigue en memoria. Se pierde
 * la ventaja, nunca la página.
 */
export const db = initializeFirestore(app, { localCache: persistentLocalCache() });
export const storage = getStorage(app);

/**
 * La región tiene que ser la misma con la que se desplegaron las funciones (`REGION` en
 * `functions/src/comun.ts`). Si no coincide, el callable le pega a un endpoint que no existe
 * y el error que ve el cliente es un CORS incomprensible en vez de un fallo de la acción.
 */
export const functions = getFunctions(app, "us-west1");

/**
 * Sin `setPersistence`: `getAuth` ya deja la sesión guardada, y forzarla la empeoraba.
 *
 * El default de `getAuth` es la jerarquía `[IndexedDB, localStorage, sessionStorage]` —las
 * tres sobreviven a cerrar el navegador— y se queda con la primera que el navegador ofrezca.
 * O sea que el `setPersistence(auth, browserLocalPersistence)` que había acá no compraba la
 * persistencia: ya la teníamos. Lo único que hacía era *angostar* la jerarquía a
 * `localStorage`.
 *
 * Y eso cobraba caro. `setPersistence` migra: lee al usuario del almacén actual, **lo borra
 * de ahí** y recién entonces lo escribe en el nuevo. Como el SDK arranca cada carga eligiendo
 * IndexedDB y devolviéndolo a su lugar, cada visita hacía el viaje de ida y vuelta completo:
 * IndexedDB → borrar → localStorage, y a la siguiente al revés. Un borrado y una escritura
 * cruzando dos almacenes, en cada carga, sobre la única copia de la sesión. Si en Safari
 * falla la mitad de atrás de ese viaje —IndexedDB en WKWebView es de fallar sola— la sesión
 * se queda borrada de un lado sin haber llegado al otro, y la clienta despierta en `/mi` sin
 * sesión.
 *
 * Quitándolo, la sesión se queda quieta donde el SDK la puso.
 */
const auth = getAuth(app);

/**
 * Mete a la clienta a su sesión y devuelve en qué quedó el intento.
 *
 * El orden en que se intenta y qué se olvida cuándo vive en `resolverSesion`, con sus
 * tests; acá solo se le enchufa el navegador y el SDK.
 *
 * `authStateReady` y no `currentUser` a secas: el SDK restaura la sesión guardada de forma
 * asíncrona, así que preguntar antes es leer `null` sin que eso signifique que no hay
 * sesión.
 */
export function iniciarSesion(): Promise<ResultadoSesion> {
  return resolverSesion({
    rutaActual: () => location.pathname,
    canjear,
    sesionGuardada: async () => {
      await auth.authStateReady();
      return auth.currentUser?.uid ?? null;
    },
    /*
     * Ya no se esconde el token: la dirección se queda en `/c/<token>`.
     *
     * Esto sigue leyendo el `#` porque las clientas que entraron mientras el token se
     * escondía ahí pueden tener esa dirección guardada —en una pestaña, en la pantalla de
     * inicio— y esa también tiene que abrirles.
     */
    tokenEscondido: () => location.hash.replace(/^#/, "") || null,
    olvidarEscondido: () => history.replaceState(null, "", "/mi"),
    memoria: memoriaToken(almacenesDelNavegador()),
  });
}

/**
 * Espera a que la credencial exista antes de que nadie le pida datos a Firestore.
 *
 * `iniciarSesion` promete que la clienta entró, no que el cliente de Firestore ya se enteró:
 * la credencial le llega por el evento de cambio de token, que es asíncrono. Pedir datos en
 * ese hueco sale sin credencial y vuelve como `permission-denied` —visto en un iPhone,
 * denegando hasta el documento del cliente, que tiene la regla más simple de todas—.
 * `getIdToken` cierra el hueco: cuando resuelve, el token existe y ya se anunció.
 */
export async function credencialLista(): Promise<void> {
  await auth.authStateReady();
  await auth.currentUser?.getIdToken();
}

/**
 * Consigue una credencial nueva cuando la que hay ya no sirve.
 *
 * Dos escalones, del más barato al más caro. Primero forzar la renovación del token, que es
 * lo que arregla el caso normal: los tokens duran una hora, y una página que la clienta dejó
 * abierta —o un navegador que no pudo renovar solo— se queda con uno vencido. Si eso falla,
 * volver a canjear desde cero: el token del link sigue en la dirección, así que se puede
 * armar una sesión nueva sin que ella toque nada.
 *
 * Reintentar la lectura sin esto no sirve de nada: la misma credencial vencida da denegado
 * las veces que haga falta.
 */
export async function renovarCredencial(): Promise<boolean> {
  try {
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
      return true;
    }
  } catch {
    /* Renovar falló: queda el canje de abajo, que no depende del token viejo. */
  }
  const resultado = await iniciarSesion();
  return resultado.estado === "lista";
}

/**
 * Qué trae la sesión en el momento en que Firestore dijo que no.
 *
 * Todas las reglas —Firestore y Storage— cuelgan de lo mismo: el claim `clienteId` del token
 * tiene que ser igual al id del documento. Denegado el documento del cliente, las tres
 * posibilidades son que no haya usuario, que el token no traiga el claim, o que el claim no
 * coincida con el uid, y se arreglan en lugares distintos: la primera acá, la segunda en la
 * función `sesion`, la tercera en las reglas.
 *
 * Los ids salen recortados a cuatro caracteres: alcanzan para comparar y no llenan la
 * pantalla de la clienta con identificadores.
 */
export async function huellaDeLaSesion(): Promise<string> {
  const usuario = auth.currentUser;
  if (!usuario) return "sin-usuario";
  try {
    const token = await usuario.getIdTokenResult();
    const claim = typeof token.claims.clienteId === "string" ? token.claims.clienteId : null;
    const minutos = Math.round((Date.parse(token.expirationTime) - Date.now()) / 60000);
    return `u:${usuario.uid.slice(0, 4)} c:${claim ? claim.slice(0, 4) : "sin-claim"} ${
      claim === usuario.uid ? "=" : "!="
    } exp:${minutos}m`;
  } catch (error) {
    return `huella:${(error as { code?: string }).code ?? "error"}`;
  }
}

/** Canjea un token por una sesión de Firebase. No tira: cada falla vuelve como un estado. */
async function canjear(token: string): Promise<ResultadoSesion> {
  let respuesta: Response;
  try {
    respuesta = await fetch(URL_SESION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    // `fetch` solo rechaza cuando la petición no llegó a ningún lado: sin señal, DNS caído,
    // la función sin desplegar. Nada de eso dice nada sobre el token.
    return { estado: "sin-conexion" };
  }

  const lectura = lecturaDelStatus(respuesta.status);
  if (lectura !== "canjeado") return { estado: lectura };

  try {
    const { customToken } = await respuesta.json();
    const credencial = await signInWithCustomToken(auth, customToken);
    return { estado: "lista", clienteId: credencial.user.uid };
  } catch (error) {
    // El custom token ya salió bueno, así que lo único que puede fallar acá es el viaje a
    // Identity Toolkit. Si fue la red, se puede reintentar; si el token expiró en el camino
    // (duran una hora), un canje nuevo lo arregla y ese también pasa por acá.
    return { estado: esFalloDeRed(error) ? "sin-conexion" : "sin-acceso" };
  }
}

function esFalloDeRed(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "auth/network-request-failed"
  );
}
