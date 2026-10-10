import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db } from "./comun";
import { conNuevaEntrada, plataformaValida } from "./entradas";

/**
 * Anota que la clienta abrió su página: suma al contador, marca la última vez y guarda las
 * últimas 5 con hora y teléfono, para la ficha de la app.
 *
 * Es el único que cuenta. Antes contaba `sesion` al canjear el link, pero la página instalada
 * entra con su sesión guardada sin canjear, y esas aperturas se perdían. La página llama a
 * esto una vez por carga, sin esperarlo: si falla, esa apertura no queda anotada y nada más.
 *
 * La hora es la del servidor, no la del teléfono, para que sea exacta. Va en transacción
 * porque `ultimasEntradas` se lee, se le agrega y se recorta: dos aperturas a la vez no deben
 * pisarse.
 */
export const registrarEntrada = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const plataforma = plataformaValida((request.data as { plataforma?: unknown } | null)?.plataforma);
  const firestore = db();
  const acceso = await firestore
    .collection("accesosWeb")
    .where("clienteId", "==", clienteId)
    .limit(1)
    .get();
  const ref = acceso.docs[0]?.ref;
  if (!ref) return { ok: true };

  await firestore.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return;
    const ahora = Timestamp.now();
    tx.update(ref, {
      entradas: FieldValue.increment(1),
      ultimoAcceso: ahora,
      ultimasEntradas: conNuevaEntrada(doc.get("ultimasEntradas"), { cuando: ahora, plataforma }),
    });
  });
  return { ok: true };
});
