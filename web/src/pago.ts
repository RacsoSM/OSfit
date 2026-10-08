import type { Cliente } from "./datos";
import { fechaEnMazatlan } from "./fecha";

/**
 * El recordatorio de pago de la página: cuántos días le quedan a su periodo y si se muestra.
 * Spec: `docs/superpowers/specs/2026-10-07-recordatorio-pago-web-design.md`.
 *
 * GEMELO: `PagoCalculator.diasParaProximoPago` en Kotlin. Si cambia allá, cambia acá.
 */

/** Se muestra con esta cantidad de días o menos. Coincide con el rojo de la lista de la app (< 3). */
const DIAS_VENTANA = 2;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Días entre `hoy` y la fecha de pago, ambas AAAA-MM-DD. Negativo = ya venció.
 *
 * Se resta como fechas UTC a medianoche: ninguna de las dos tiene hora, y así ningún cambio de
 * horario puede dejar un día de 23 horas que el redondeo convierta en cero.
 */
export function diasParaPago(fechaPago: string, hoy: string): number {
  return Math.round(
    (Date.parse(`${fechaPago}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / MS_POR_DIA
  );
}

export type RecordatorioPago =
  | { visible: false }
  | { visible: true; dias: number; vencido: boolean };

export function recordatorioPago(cliente: Cliente, hoy: string): RecordatorioPago {
  if (cliente.recordatorioPago !== true || !cliente.fechaProximoPago) return { visible: false };
  const dias = diasParaPago(fechaEnMazatlan(cliente.fechaProximoPago.toDate()), hoy);
  if (dias > DIAS_VENTANA) return { visible: false };
  // El día del pago (0) sigue vigente: el periodo vence ese día, todavía no se pasó.
  return { visible: true, dias, vencido: dias < 0 };
}
