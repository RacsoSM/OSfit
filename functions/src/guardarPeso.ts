import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db } from "./comun";

/**
 * Músculos: la clienta anota su peso corporal, que es contra lo que se mide su fuerza (1RM ÷
 * peso). Sin él la ventana no deja pasar. Escribe `clientes/{cid}.peso`, el mismo campo
 * "Peso (kg)" que el entrenador edita en "Editar cliente": los dos ven y cambian el mismo.
 *
 * Pasa por una función como todo lo que escribe la página: las reglas la dejan en solo lectura.
 */

export const PESO_MIN = 25;
export const PESO_MAX = 300;

/** El peso en kg con un decimal, o null si no es un peso de persona. */
export function pesoCorporalValido(x: unknown): number | null {
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  if (x < PESO_MIN || x > PESO_MAX) return null;
  return Math.round(x * 10) / 10;
}

export const guardarPeso = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const peso = pesoCorporalValido((request.data as { peso?: unknown } | null)?.peso);
  if (peso === null) throw new HttpsError("invalid-argument", "peso_invalido");
  await db().collection("clientes").doc(clienteId).update({ peso });
  return { ok: true, peso };
});
