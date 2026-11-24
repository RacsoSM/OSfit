import { FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";

/**
 * Quejas y sugerencias (entrenador, 2026-11-24): la clienta escribe un texto en la ventana
 * "Quejas y sugerencias" de la web, se guarda en `sugerencias/{id}` y al entrenador le llega
 * una notificación a su app, por el mismo tema FCM que el aviso de falta (`avisarFalta`).
 * Va con su nombre: el entrenador necesita saber de quién es para poder responder.
 */

export const LARGO_MAXIMO_SUGERENCIA = 1000;
/** Tope por clienta y día: suficiente para escribir de verdad, no para llenar de avisos el teléfono. */
export const MAXIMO_POR_DIA = 5;
/** Lo que cabe en la notificación; el texto completo queda en Firestore. */
const LARGO_NOTIFICACION = 300;

const TEMA_ENTRENADOR = "entrenador";
/** El canal que ya crea la app (`Notificaciones.CANAL_AVISOS`); con otro, Android la callaría. */
const CANAL_AVISOS = "avisos_falta";

/** El texto limpio, o null si está vacío o es demasiado largo. */
export function textoSugerencia(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const t = x.trim();
  return t === "" || t.length > LARGO_MAXIMO_SUGERENCIA ? null : t;
}

/** "Valeria: <texto>", recortado para la notificación. */
export function cuerpoNotificacion(nombre: string, texto: string): string {
  const todo = `${nombre}: ${texto.replace(/\s+/g, " ")}`;
  return todo.length <= LARGO_NOTIFICACION ? todo : `${todo.slice(0, LARGO_NOTIFICACION - 1).trimEnd()}…`;
}

export const enviarSugerencia = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const texto = textoSugerencia((request.data as { texto?: unknown } | undefined)?.texto);
  if (texto === null) throw new HttpsError("invalid-argument", "texto_invalido");

  const firestore = db();
  const hoy = hoyEnMazatlan();
  const deHoy = await firestore.collection("sugerencias")
    .where("clienteId", "==", clienteId).where("fecha", "==", hoy).get();
  if (deHoy.size >= MAXIMO_POR_DIA) throw new HttpsError("resource-exhausted", "limite");

  const cliente = await firestore.collection("clientes").doc(clienteId).get();
  const nombre = (cliente.get("nombre") as string | undefined)?.trim() || "Una clienta";

  await firestore.collection("sugerencias").add({
    clienteId, nombre, texto, fecha: hoy, creada: FieldValue.serverTimestamp(), leida: false,
  });

  // Si el push falla, la sugerencia ya quedó guardada: la fuente de verdad es Firestore.
  try {
    await getMessaging().send({
      topic: TEMA_ENTRENADOR,
      notification: { title: "Nueva queja o sugerencia", body: cuerpoNotificacion(nombre, texto) },
      android: { priority: "high", notification: { channelId: CANAL_AVISOS } },
    });
  } catch (error) {
    logger.error("No se pudo notificar la sugerencia", { clienteId, error });
  }
  return { ok: true };
});
