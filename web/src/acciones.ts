import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import type { Candidato, EleccionAmigos, PersonaComparar } from "./ui/comparar";
import { functions } from "./firebase";
import type { Ranking } from "./datos";
import type { Envio } from "./registro";
import { avisarBloqueo, errorSinDatos, modoSinDatos } from "./sinDatos";

/**
 * Las llamadas a funciones que puede hacer el cliente: las escrituras y la lectura del
 * ranking. Nadie más llama a `httpsCallable`: el día que cambie la firma de una función hay
 * un solo sitio que tocar, y la página nunca escribe en Firestore por su cuenta — las reglas
 * la dejan en solo lectura a propósito.
 */

/**
 * Una función del servidor que, con el modo sin datos puesto (`sinDatos.ts`), falla al
 * instante como sin red en vez de salir a internet. Al ser el único sitio que llama a
 * `httpsCallable`, basta con revisarlo aquí para que ninguna acción gaste datos.
 *
 * `deFondo`: la llama la página sola, no un toque de la clienta. Esas no le ofrecen apagar el
 * modo: sería una franja que sale sin que ella haya hecho nada.
 */
function llamable<A, R>(nombre: string, deFondo = false): (datos: A) => Promise<HttpsCallableResult<R>> {
  const llamar = httpsCallable<A, R>(functions, nombre);
  return (datos) => {
    if (!modoSinDatos()) return llamar(datos);
    if (!deFondo) avisarBloqueo();
    return Promise.reject(errorSinDatos());
  };
}

export const cambiarDia = llamable<
  { diaIndex: number; motivo: string },
  { ok: true; diaIndex: number }
>("cambiarDia");

export const revivirRacha = llamable<
  { fecha: string },
  { ok: true; disponibles: number }
>("revivirRacha");

/**
 * Avisar que hoy no se puede. No lleva argumentos: la fecha la pone el servidor, porque el
 * aviso es siempre sobre hoy.
 */
export const avisarFalta = llamable<
  Record<string, never>,
  { ok: true; fecha: string }
>("avisarFalta");

/**
 * La ruleta. Manda el color apostado y recibe en cuál cayó.
 *
 * El servidor decide el resultado: acá no hay ni un `Math.random()` que valga, porque un
 * sorteo hecho en el navegador se gana siempre desde la consola.
 */
export const jugarRuleta = llamable<
  { color: string },
  { gano: boolean; color: string }
>("jugarRuleta");

/**
 * El ranking de rachas. Es una lectura, pero pasa por una función porque necesita las
 * asistencias de todos, y las reglas solo le dejan al cliente leer las suyas.
 */
export const obtenerRanking = llamable<Record<string, never>, Ranking>("obtenerRanking");

/**
 * Amigos: todas las que tienen algún músculo con rango, con su nivel por músculo. Lo arma
 * el servidor porque cada clienta solo puede leer sus propias sesiones.
 */
export const compararMusculos = llamable<Record<string, never>, { personas: PersonaComparar[]; candidatos: Candidato[] }>("compararMusculos");

/** Amigos: quién ve sus músculos. `con` solo con "algunos": los ids de las escogidas. */
export const elegirMostrarEnAmigos = llamable<EleccionAmigos, { ok: true }>("elegirMostrarEnAmigos");

/**
 * Guarda el token de notificaciones de este teléfono. Si el entrenador no la habilitó, el
 * servidor responde `failed-precondition` y no guarda nada.
 */
export const registrarDispositivo = llamable<
  { token: string; plataforma: "ios" | "android" | "otro" },
  { ok: true }
>("registrarDispositivo", true);

/**
 * Anota que la página se abrió, con el teléfono, para las "Últimas entradas" de la ficha del
 * entrenador. La página no la espera ni se entera si falla.
 */
export const registrarEntrada = llamable<
  { plataforma: "ios" | "android" | "otro" },
  { ok: true }
>("registrarEntrada", true);

/**
 * Guarda lo que anotó en Registro. El servidor valida contra el banco y pone la fecha; el id
 * viene del borrador, así que reintentar después de un error no duplica la sesión.
 */
export const registrarSesion = llamable<Envio, { ok: true; id: string; fecha: string }>("registrarSesion", true);

/**
 * Marca su asistencia de hoy al iniciar un entrenamiento en Registro, para que el entrenador
 * la vea en su app. La página no la espera; si falla (sin internet), la marca `registrarSesion`
 * cuando llegue el entrenamiento.
 */
export const marcarAsistencia = llamable<Record<string, never>, { ok: true; marcada: boolean }>("marcarAsistencia", true);

/** Corrige un entrenamiento ya guardado; conserva su fecha y sus horas. */
export const editarSesion = llamable<Envio, { ok: true; id: string }>("editarSesion");

/** Borra un entrenamiento de su historial. */
export const borrarSesion = llamable<{ id: string }, { ok: true; id: string }>("borrarSesion");

/** Su peso corporal en kg, para Músculos. El servidor rechaza lo que no sea de 25 a 300 kg. */
export const guardarPeso = llamable<{ peso: number }, { ok: true; peso: number }>("guardarPeso");
