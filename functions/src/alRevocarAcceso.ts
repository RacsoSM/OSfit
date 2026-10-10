import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { db } from "./comun";

/** Firestore está en `nam5`: sus triggers van en `us-central1` (ver `enviarNotificacion`). */
const REGION_FIRESTORE = "us-central1";

/**
 * Revocar de verdad. La app solo borra `accesosWeb/{token}`; esto hace el resto.
 * Ver docs/superpowers/specs/2026-10-10-revocar-acceso-design.md.
 *
 * 1. La fecha de corte en el cliente. Va primero porque es lo que la saca al instante: las
 *    reglas y `clienteDeLaSesion` rechazan toda sesión iniciada antes.
 * 2. Anular la renovación de su sesión, para que tampoco pueda renovarse después.
 * 3. Borrar sus teléfonos registrados, para que no le lleguen más avisos. `notificacionesWeb`
 *    no se toca (decisión del entrenador): si recibe un link nuevo, sigue habilitada.
 *
 * Cada paso falla por su cuenta, y repetirlo deja todo igual, así que un reintento de
 * Eventarc no hace daño.
 */
export const alRevocarAcceso = onDocumentDeleted(
  { document: "accesosWeb/{token}", region: REGION_FIRESTORE },
  async (event) => {
    const clienteId = event.data?.get("clienteId");
    if (typeof clienteId !== "string" || clienteId === "") return;
    const cliente = db().collection("clientes").doc(clienteId);

    try {
      await cliente.update({ accesoRevocadoEn: FieldValue.serverTimestamp() });
    } catch (error) {
      logger.error("No se pudo escribir el corte", { clienteId, error });
    }
    try {
      await getAuth().revokeRefreshTokens(clienteId);
    } catch (error) {
      logger.error("No se pudo anular la sesión", { clienteId, error });
    }
    try {
      // Un lote admite 500 escrituras; una clienta tiene pocos teléfonos.
      const dispositivos = await cliente.collection("dispositivos").listDocuments();
      if (dispositivos.length > 0) {
        const lote = db().batch();
        dispositivos.forEach((d) => lote.delete(d));
        await lote.commit();
      }
    } catch (error) {
      logger.error("No se pudieron borrar los dispositivos", { clienteId, error });
    }
  }
);
