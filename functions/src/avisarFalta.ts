import { FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";

/**
 * Tema de FCM al que se suscriben los telefonos del entrenador al abrir la app.
 *
 * Es un tema y no una lista de tokens a proposito: los dos telefonos (el del entrenador y el
 * del co-gestor) comparten cuenta y quieren el mismo aviso, y un tema no obliga a guardar ni
 * a limpiar tokens muertos en Firestore. Instalar la app en un telefono mas lo suscribe solo.
 *
 * GEMELO: `TEMA_ENTRENADOR` en `app/.../notificaciones/Notificaciones.kt`.
 */
const TEMA_ENTRENADOR = "entrenador";

/**
 * Canal de Android donde cae la notificacion. Tiene que existir en el telefono antes de que
 * llegue el primer mensaje; lo crea la app al arrancar.
 *
 * GEMELO: `CANAL_AVISOS` en `app/.../notificaciones/Notificaciones.kt`.
 */
const CANAL_AVISOS = "avisos_falta";

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

  const doc = db().collection("avisosFalta").doc(`${clienteId}_${hoy}`);

  // Se mira ANTES de escribir para saber si el aviso es nuevo. La escritura de abajo es
  // idempotente, pero el push no lo seria: sin esto, un doble toque —o una recarga con el
  // boton todavia en pantalla— mandaria dos notificaciones por el mismo aviso.
  const esNuevo = !(await doc.get()).exists;

  await doc.set({
    clienteId,
    fecha: hoy,
    creado: FieldValue.serverTimestamp(),
  });

  if (esNuevo) {
    await notificarAlEntrenador(clienteId);
  }

  return { ok: true, fecha: hoy };
});

/**
 * Manda el push, y si falla no pasa nada.
 *
 * El `catch` es la pieza importante: la fuente de verdad del aviso es el documento que se
 * acaba de escribir —de ahi sale el nombre en amarillo en la app—, y el push es un extra
 * encima. Si FCM esta caido o el nombre no se pudo leer, el aviso de la clienta tiene que
 * quedar registrado igual; lo que no puede pasar es que su boton le devuelva un error.
 */
async function notificarAlEntrenador(clienteId: string): Promise<void> {
  try {
    const cliente = await db().collection("clientes").doc(clienteId).get();
    const nombre = cliente.get("nombre") || "Una clienta";

    await getMessaging().send({
      topic: TEMA_ENTRENADOR,
      notification: {
        title: "No va hoy",
        body: `${nombre} avisó que hoy no va a poder ir.`,
      },
      android: {
        priority: "high",
        notification: { channelId: CANAL_AVISOS },
      },
    });
  } catch (error) {
    logger.error("No se pudo notificar el aviso de falta", { clienteId, error });
  }
}
