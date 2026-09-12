import { FieldValue } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";

/**
 * "Hoy no voy a poder ir": el cliente avisa, y ya.
 *
 * NO gasta revive y NO toca `asistencias`. Avisar y justificar son dos cosas distintas y
 * antes eran la misma: el boton llamaba a `revivirRacha`, asi que quien avisaba con
 * educacion pagaba uno de sus 3 del mes por hacerlo. Ahora avisar es gratis; si ademas
 * quiere salvar la racha, para eso esta "Revivir mi racha", que sigue cobrando.
 *
 * La fecha la pone el servidor: el aviso es siempre sobre hoy, asi que no hay nada que
 * mandar desde el navegador y nada que revalidar.
 *
 * Doc id: "<clienteId>_<fecha>" — un solo aviso por cliente y dia. Avisar dos veces es
 * idempotente, que es justo lo que hace falta para que el boton pueda desaparecer el resto
 * del dia sin que un doble toque escriba dos documentos.
 */
export const avisarFalta = onCall({ region: REGION }, async (request) => {
  const clienteId = clienteDeLaSesion(request);
  const hoy = hoyEnMazatlan();

  await db().collection("avisosFalta").doc(`${clienteId}_${hoy}`).set({
    clienteId,
    fecha: hoy,
    creado: FieldValue.serverTimestamp(),
  });

  return { ok: true, fecha: hoy };
});
