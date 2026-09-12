import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

/**
 * Las dos escrituras que puede hacer el cliente. Nadie más llama a `httpsCallable`: el día
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
