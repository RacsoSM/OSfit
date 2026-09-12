import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

/**
 * Las tres escrituras que puede hacer el cliente. Nadie más llama a `httpsCallable`: el día
 * que cambie la firma de una función hay un solo sitio que tocar, y la página nunca escribe
 * en Firestore por su cuenta — las reglas la dejan en solo lectura a propósito.
 */

export const cambiarDia = httpsCallable<
  { diaIndex: number; motivo: string },
  { ok: true; diaIndex: number }
>(functions, "cambiarDia");

export const revivirRacha = httpsCallable<
  { fecha: string },
  { ok: true; disponibles: number }
>(functions, "revivirRacha");

/**
 * Avisar que hoy no se puede. No lleva argumentos: la fecha la pone el servidor, porque el
 * aviso es siempre sobre hoy.
 */
export const avisarFalta = httpsCallable<
  Record<string, never>,
  { ok: true; fecha: string }
>(functions, "avisarFalta");
