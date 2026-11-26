import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";

/** Las semanas del bloque del ciclo de RPE (`web/src/ciclo.ts`): 1 base, 2 carga, 3 fuerza, 4 descarga. */
export const SEMANAS_DEL_BLOQUE = 4;

/** El lunes (AAAA-MM-DD) de la semana de `fecha`. GEMELO de `lunesDe` en `web/src/ciclo.ts`. */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

export function semanaValida(x: unknown): number | null {
  const s = (x as { semana?: unknown } | null | undefined)?.semana;
  return typeof s === "number" && Number.isInteger(s) && s >= 1 && s <= SEMANAS_DEL_BLOQUE ? s : null;
}

/**
 * La clienta cambia en qué semana del bloque va (entrenador, 2026-11-26): desde la explicación
 * del RPE, con una confirmación que le recomienda decidirlo con su coach. Se guarda como
 * `cicloAjuste` en su documento: esta semana (su lunes) es la `semana` elegida, y de ahí el
 * ciclo sigue contando como siempre (avanza con cada semana de 3 días o más). Uno nuevo pisa al
 * anterior. Queda además en `cambiosSemana` para que el entrenador lo vea.
 */
export const cambiarSemana = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const semana = semanaValida(request.data);
  if (semana === null) throw new HttpsError("invalid-argument", "semana_invalida");
  const hoy = hoyEnMazatlan();
  const lunes = lunesDe(hoy);
  const firestore = db();
  const lote = firestore.batch();
  lote.update(firestore.collection("clientes").doc(clienteId), { cicloAjuste: { semana, lunes } });
  lote.set(firestore.collection("cambiosSemana").doc(`${clienteId}_${hoy}`), {
    clienteId, fecha: hoy, semana, creado: FieldValue.serverTimestamp(),
  });
  await lote.commit();
  return { ok: true as const, semana, lunes };
});
