import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithCustomToken,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

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
export const db = getFirestore(app);

/**
 * La región tiene que ser la misma con la que se desplegaron las funciones (`REGION` en
 * `functions/src/comun.ts`). Si no coincide, el callable le pega a un endpoint que no existe
 * y el error que ve el cliente es un CORS incomprensible en vez de un fallo de la acción.
 */
export const functions = getFunctions(app, "us-west1");

const auth = getAuth(app);

/**
 * Devuelve el clienteId de la sesión, canjeando el token del link si la URL lo trae.
 *
 * Después de canjear reemplaza la URL por `/mi`: el token deja de estar a la vista apenas
 * se usa, así no queda en una captura de pantalla ni se comparte sin querer al pasar la
 * dirección. La sesión persiste, así que las próximas visitas entran sin el link.
 */
export async function iniciarSesion(): Promise<string | null> {
  await setPersistence(auth, browserLocalPersistence);

  const enLaUrl = location.pathname.match(/^\/c\/([A-Za-z0-9]+)$/);
  if (enLaUrl) {
    const respuesta = await fetch(URL_SESION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: enLaUrl[1] }),
    });
    if (!respuesta.ok) return null;
    const { customToken } = await respuesta.json();
    await signInWithCustomToken(auth, customToken);
    history.replaceState(null, "", "/mi");
  }

  return auth.currentUser?.uid ?? null;
}
