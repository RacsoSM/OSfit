import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { Ranking } from "./datos";

/**
 * Las llamadas a funciones que puede hacer el cliente: cuatro escrituras y la lectura del
 * ranking. Nadie más llama a `httpsCallable`: el día que cambie la firma de una función hay
 * un solo sitio que tocar, y la página nunca escribe en Firestore por su cuenta — las reglas
 * la dejan en solo lectura a propósito.
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

/**
 * La ruleta. Manda el color apostado y recibe en cuál cayó.
 *
 * El servidor decide el resultado: acá no hay ni un `Math.random()` que valga, porque un
 * sorteo hecho en el navegador se gana siempre desde la consola.
 */
export const jugarRuleta = httpsCallable<
  { color: string },
  { gano: boolean; color: string }
>(functions, "jugarRuleta");

/**
 * El ranking de rachas. Es una lectura, pero pasa por una función porque necesita las
 * asistencias de todos, y las reglas solo le dejan al cliente leer las suyas.
 */
export const obtenerRanking = httpsCallable<Record<string, never>, Ranking>(
  functions,
  "obtenerRanking"
);
