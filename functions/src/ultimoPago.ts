import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "./comun";
import { REGION_FIRESTORE } from "./enviarNotificacion";

/**
 * El apartado Facturación de la web (entrenador, 2026-11-26) muestra a la clienta su último
 * pago: cuándo pagó, cuánto y hasta cuándo le alcanza. Los pagos (`clientes/{id}/pagos`) siguen
 * fuera de su alcance a propósito —traen la nota interna del entrenador—, así que cada vez que la
 * app registra, edita o borra uno, aquí se copia a su documento SOLO eso, como `ultimoPago`.
 */

export interface UltimoPago {
  /** AAAA-MM-DD, en Mazatlán. */
  fecha: string;
  monto: number;
  /** AAAA-MM-DD: hasta cuándo le alcanza ese pago (`fechaProximoPagoGenerada`). */
  vence: string | null;
}

/** AAAA-MM-DD en Mazatlán de un Timestamp de Firestore. */
export function fechaMazatlan(t: Timestamp | null | undefined): string | null {
  if (!t || typeof t.toDate !== "function") return null;
  return t.toDate().toLocaleDateString("en-CA", { timeZone: "America/Mazatlan" });
}

/** El último pago, a partir del documento de pago más reciente (o null si no hay). */
export function ultimoPagoDe(pago: { fecha?: Timestamp; monto?: unknown; fechaProximoPagoGenerada?: Timestamp } | undefined): UltimoPago | null {
  const fecha = fechaMazatlan(pago?.fecha);
  if (!pago || !fecha) return null;
  const monto = typeof pago.monto === "number" && Number.isFinite(pago.monto) ? pago.monto : 0;
  return { fecha, monto, vence: fechaMazatlan(pago.fechaProximoPagoGenerada) };
}

/** Recalcula `ultimoPago` de una clienta con su pago más reciente. */
export async function actualizarUltimoPago(clienteId: string): Promise<UltimoPago | null> {
  const cliente = db().collection("clientes").doc(clienteId);
  const masReciente = await cliente.collection("pagos").orderBy("fecha", "desc").limit(1).get();
  const ultimo = ultimoPagoDe(masReciente.docs[0]?.data());
  await cliente.update({ ultimoPago: ultimo ?? FieldValue.delete() });
  return ultimo;
}

export const alCambiarPago = onDocumentWritten(
  { document: "clientes/{clienteId}/pagos/{pagoId}", region: REGION_FIRESTORE },
  async (event) => {
    await actualizarUltimoPago(event.params.clienteId);
  }
);
