import type { DocumentReference } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "./comun";
import {
  avisoDesdeDoc,
  clienteParaAvisoDesdeDoc,
  destinatarias,
  enTandas,
  esTokenMuerto,
} from "./notificaciones";

/**
 * Region del trigger. No es `REGION` (`us-west1`): un trigger de Firestore tiene que vivir
 * donde vive la base. La base esta en `nam5` (multirregion de EE. UU.), y para `nam5` los
 * triggers van en `us-central1`.
 */
const REGION_FIRESTORE = "us-central1";

/**
 * Cuanto espera FCM a un telefono apagado antes de tirar el aviso. Cuatro horas: un "ya
 * llegamos" que llega al dia siguiente confunde mas de lo que avisa.
 */
const TTL_SEGUNDOS = "14400";

/**
 * Manda el aviso que la app acaba de escribir en `notificaciones/{id}`.
 *
 * Un trigger y no una callable porque la app no tiene el SDK de Functions: todo lo que hace
 * el entrenador es escribir en Firestore, y si esta sin senal la escritura espera en la cola
 * local y sale sola al volver la red.
 *
 * Mensajes solo de datos: el service worker de la pagina arma la notificacion. Si viajara
 * tambien `notification`, algunos navegadores la mostrarian por su cuenta y se veria doble.
 */
export const enviarNotificacion = onDocumentCreated(
  { document: "notificaciones/{id}", region: REGION_FIRESTORE },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const ref = snap.ref;

    // Los triggers pueden correr mas de una vez para el mismo documento. Se toma el aviso
    // pasandolo de "pendiente" a "enviando" en una transaccion: la segunda corrida ya no lo
    // encuentra pendiente y no manda nada. Sin esto, la clienta recibiria el aviso dos veces.
    const tomado = await db().runTransaction(async (tx) => {
      const actual = await tx.get(ref);
      if (actual.get("estado") !== "pendiente") return false;
      tx.update(ref, { estado: "enviando" });
      return true;
    });
    if (!tomado) return;

    const aviso = avisoDesdeDoc(snap.data());
    if (!aviso) {
      await ref.update({ estado: "error", enviadas: 0, fallidas: 0 });
      return;
    }

    try {
      const clientesSnap = await db().collection("clientes").where("notificacionesWeb", "==", true).get();
      const clientes = clientesSnap.docs.map((d) => clienteParaAvisoDesdeDoc(d.id, d.data()));
      const ids = destinatarias(clientes, aviso);

      const dispositivos = (
        await Promise.all(
          ids.map((id) => db().collection("clientes").doc(id).collection("dispositivos").get())
        )
      ).flatMap((s) => s.docs)
        .map((d) => ({ token: d.get("token"), ref: d.ref }))
        .filter((d): d is { token: string; ref: DocumentReference } =>
          typeof d.token === "string" && d.token !== "");

      let enviadas = 0;
      let fallidas = 0;
      for (const tanda of enTandas(dispositivos)) {
        const respuesta = await getMessaging().sendEachForMulticast({
          tokens: tanda.map((d) => d.token),
          data: { titulo: aviso.titulo, texto: aviso.texto },
          webpush: { headers: { TTL: TTL_SEGUNDOS, Urgency: "high" } },
        });
        await Promise.all(
          respuesta.responses.map(async (r, i) => {
            if (r.success) {
              enviadas += 1;
              return;
            }
            fallidas += 1;
            if (esTokenMuerto(r.error?.code)) await tanda[i].ref.delete();
          })
        );
      }

      await ref.update({ estado: "enviada", enviadas, fallidas });
    } catch (error) {
      logger.error("No se pudo enviar el aviso", { id: ref.id, error });
      await ref.update({ estado: "error" });
    }
  }
);
