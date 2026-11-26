import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "./comun";
import { REGION_FIRESTORE } from "./enviarNotificacion";

/**
 * El apartado Facturación de la web (entrenador, 2026-11-26) muestra a la clienta su último
 * pago: cuándo pagó, cuánto y hasta cuándo le alcanza. Los pagos (`clientes/{id}/pagos`) siguen
 * fuera de su alcance a propósito —traen la nota interna del entrenador—, así que cada vez que la
 * app registra, edita o borra uno, aquí se copia a su documento SOLO eso, como `ultimoPago`.
 *
 * Además, al registrarse un pago nuevo le llega una notificación (entrenador, 2026-11-26): "Tu
 * pago de $700 correspondiente a 1 mes fue acreditado con éxito, ¡muchas gracias!".
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

const DIA_MS = 86_400_000;

/**
 * Cuánto cubre el pago, de su fecha a la del próximo pago: "1 semana", "2 semanas", "1 mes",
 * "3 meses". Menos de 25 días se cuenta en semanas; desde ahí, en meses. Null si no se sabe.
 */
export function periodoEnPalabras(desde: string | null, hasta: string | null): string | null {
  if (!desde || !hasta) return null;
  const dias = Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / DIA_MS);
  if (!Number.isFinite(dias) || dias <= 0) return null;
  if (dias < 25) {
    const semanas = Math.max(1, Math.round(dias / 7));
    return semanas === 1 ? "1 semana" : `${semanas} semanas`;
  }
  const meses = Math.max(1, Math.round(dias / 30.44));
  return meses === 1 ? "1 mes" : `${meses} meses`;
}

/** "$700" o "$1,250.50". GEMELO de `pesos` en `web/src/ui/facturacion.ts`. */
export function pesos(monto: number): string {
  return `$${monto.toLocaleString("es-MX", { minimumFractionDigits: Number.isInteger(monto) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** El texto de la notificación del pago. */
export function textoPagoAcreditado(p: UltimoPago): string {
  const cuanto = p.monto > 0 ? ` de ${pesos(p.monto)}` : "";
  const periodo = periodoEnPalabras(p.fecha, p.vence);
  return `Tu pago${cuanto}${periodo ? ` correspondiente a ${periodo}` : ""} fue acreditado con éxito, ¡muchas gracias!`;
}

/**
 * Deja la notificación en `notificaciones/` como cualquier aviso automático: la manda
 * `enviarNotificacion` (a quien tenga las notificaciones prendidas) y queda en su buzón. El id
 * es del pago, así que si el trigger corre dos veces no llega doble. Con Facturación prendida,
 * tocarla abre ese apartado.
 */
async function avisarPago(clienteId: string, pagoId: string, pago: UltimoPago): Promise<void> {
  const id = `pago_${clienteId}_${pagoId}`;
  const cliente = await db().collection("clientes").doc(clienteId).get();
  try {
    await db().collection("notificaciones").doc(id).create({
      id,
      titulo: "Pago recibido",
      texto: textoPagoAcreditado(pago),
      destino: "elegidas",
      clientesElegidos: [clienteId],
      creada: FieldValue.serverTimestamp(),
      estado: "pendiente",
      enviadas: 0,
      fallidas: 0,
      automatico: "pagoAcreditado",
      ...(cliente.get("facturacionWeb") === true ? { abrir: { ventana: "facturacion" } } : {}),
    });
  } catch (error) {
    // Ya existía: el trigger corrió otra vez para el mismo pago.
    if ((error as { code?: unknown }).code !== 6) throw error;
  }
}

export const alCambiarPago = onDocumentWritten(
  { document: "clientes/{clienteId}/pagos/{pagoId}", region: REGION_FIRESTORE },
  async (event) => {
    const { clienteId, pagoId } = event.params;
    await actualizarUltimoPago(clienteId);
    // Solo un pago nuevo avisa: editarlo o borrarlo no.
    const nuevo = !event.data?.before.exists && event.data?.after.exists;
    if (!nuevo) return;
    const pago = ultimoPagoDe(event.data?.after.data());
    if (pago) await avisarPago(clienteId, pagoId, pago);
  }
);
