import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithCustomToken,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "PEGAR_DESDE_LA_CONSOLA",
  authDomain: "osfit-cccfe.firebaseapp.com",
  projectId: "osfit-cccfe",
  storageBucket: "osfit-cccfe.firebasestorage.app",
  messagingSenderId: "PEGAR_DESDE_LA_CONSOLA",
  appId: "PEGAR_DESDE_LA_CONSOLA",
};

const URL_SESION = "PEGAR_LA_URL_DE_LA_FUNCION_SESION";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
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
