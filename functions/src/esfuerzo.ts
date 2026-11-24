import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db } from "./comun";

/**
 * "¿Qué tan pesado estuvo tu entrenamiento?" (entrenador, 2026-11-24): la escala del 1 al 10 del
 * resumen al terminar. Va en `clientes/{id}/esfuerzos/{sesionId}` y no dentro de la sesión: la
 * sesión puede seguir en la cola del teléfono (sin internet) cuando la califica, y escribir en
 * su documento antes de que exista rompería su guardado. Cambiar de número la reescribe.
 */

/** El mismo formato que los ids de las sesiones (`registrarSesion`). */
const ID_VALIDO = /^[A-Za-z0-9_-]{8,40}$/;

export function esfuerzoValido(x: unknown): { sesionId: string; esfuerzo: number } | null {
  const d = x as { sesionId?: unknown; esfuerzo?: unknown } | null | undefined;
  if (!d || typeof d.sesionId !== "string" || !ID_VALIDO.test(d.sesionId)) return null;
  if (typeof d.esfuerzo !== "number" || !Number.isInteger(d.esfuerzo) || d.esfuerzo < 1 || d.esfuerzo > 10) return null;
  return { sesionId: d.sesionId, esfuerzo: d.esfuerzo };
}

export const guardarEsfuerzo = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const e = esfuerzoValido(request.data);
  if (!e) throw new HttpsError("invalid-argument", "esfuerzo_invalido");
  await db().collection("clientes").doc(clienteId).collection("esfuerzos").doc(e.sesionId)
    .set({ esfuerzo: e.esfuerzo, actualizado: FieldValue.serverTimestamp() });
  return { ok: true as const };
});
