/**
 * El cambio de día, también sin internet (entrenador, 2026-11-26).
 *
 * Al elegir otro día se anota aquí, en el teléfono, y la página lo usa al instante: la tarjeta
 * del día y Registro ya muestran el día nuevo aunque no haya señal. Por detrás se manda a
 * `cambiarDia`; si no hay internet se queda anotado y se vuelve a mandar cuando la haya (al
 * volver la señal, al abrir la página y cada minuto, igual que la cola de entrenamientos).
 *
 * Solo vale para el día en que se hizo: el servidor rechaza uno de otro día
 * (`cambio_vencido`), y aquí uno de ayer ya no se aplica ni se manda. Uno nuevo pisa al
 * anterior, como en el servidor.
 */
import type { Cliente } from "./datos";

export const LLAVE_CAMBIO_DIA = "osfit:cambio-dia";

export interface CambioPendiente {
  diaIndex: number;
  /** El día (AAAA-MM-DD, Mazatlán) en que lo eligió. */
  fecha: string;
  /**
   * Ya lo aceptó el servidor; se borra cuando el documento de la clienta ya dice ese día, o a
   * los `VIGENCIA_ENVIADO_MS` de todos modos: si después el entrenador le cambia el día desde
   * la app, manda el documento.
   */
  enviado?: boolean;
  enviadoEn?: number;
}

export interface AlmacenCambio {
  getItem(llave: string): string | null;
  setItem(llave: string, valor: string): void;
  removeItem(llave: string): void;
}

export function leerCambio(almacen: AlmacenCambio | null): CambioPendiente | null {
  try {
    const crudo = almacen?.getItem(LLAVE_CAMBIO_DIA);
    if (!crudo) return null;
    const c = JSON.parse(crudo) as Partial<CambioPendiente>;
    if (typeof c.diaIndex !== "number" || !Number.isInteger(c.diaIndex) || c.diaIndex < 0) return null;
    if (typeof c.fecha !== "string") return null;
    return {
      diaIndex: c.diaIndex, fecha: c.fecha,
      ...(c.enviado === true ? { enviado: true, enviadoEn: typeof c.enviadoEn === "number" ? c.enviadoEn : 0 } : {}),
    };
  } catch {
    return null;
  }
}

export const VIGENCIA_ENVIADO_MS = 2 * 60_000;

export function anotarCambio(almacen: AlmacenCambio | null, cambio: CambioPendiente): void {
  try {
    almacen?.setItem(LLAVE_CAMBIO_DIA, JSON.stringify(cambio));
  } catch {
    // Sin dónde anotarlo, igual se intenta mandar en el momento.
  }
}

export function borrarCambio(almacen: AlmacenCambio | null): void {
  try {
    almacen?.removeItem(LLAVE_CAMBIO_DIA);
  } catch {
    // Nada que hacer.
  }
}

/** El día anterior a `fecha` (AAAA-MM-DD). */
function ayer(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * La clienta con el cambio de hoy ya puesto, mientras el servidor no lo tiene. Es el mismo
 * trío que escribe `cambiarDia` sin asistencia de hoy: el ancla fechada ayer. De otro día, o
 * fuera de su rutina, no cambia nada.
 */
export function conCambio(cliente: Cliente, cambio: CambioPendiente | null, hoy: string): Cliente {
  const dias = cliente.rutinaAsignada?.dias?.length ?? 0;
  if (!cambio || cambio.fecha !== hoy || cambio.diaIndex >= dias) return cliente;
  return { ...cliente, ultimoDia: cambio.diaIndex, ultimoDiaFecha: ayer(hoy), ultimoDiaEsAncla: true };
}

/** Lo que contesta el servidor y no se arregla volviendo a mandar (el cambio se descarta). */
const DEFINITIVOS = new Set(["ya_asistio_hoy", "sin_rutina", "dia_invalido", "motivo_invalido", "cambio_vencido", "cliente_no_encontrado"]);

export function esRechazoDefinitivo(error: unknown): boolean {
  const e = error as { message?: unknown; code?: unknown } | null;
  return typeof e?.message === "string" && DEFINITIVOS.has(e.message);
}
