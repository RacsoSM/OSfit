/**
 * Lo puro de los avisos automáticos: a quién le toca cuál, con qué texto y con qué id.
 *
 * Vive aparte de `programarAvisos.ts` para probarse en Node sin Firestore, como
 * `notificaciones.ts` respecto de `enviarNotificacion.ts`.
 * Spec: `docs/superpowers/specs/2026-10-10-avisos-automaticos-design.md`.
 */
import type { AsistenciaParaRacha } from "./faltaRompio";
import { fechasQueCuentan, rachaActual } from "./rachas";

/**
 * Los tipos de aviso automático. Son las llaves de `clientes/{id}.avisosAutomaticos`, que el
 * entrenador prende clienta por clienta en el apartado Web de la app.
 *
 * GEMELO: `AvisoAutomatico` en `app/.../data/model/AvisoAutomatico.kt`.
 */
export type TipoAviso = "rachaPerdida" | "recordatorioPago";

/** Racha mínima (días hábiles) para que perderla merezca un aviso. Decidido 2026-10-10. */
export const RACHA_MINIMA = 3;

/** Días antes del pago en que se avisa. 2 coincide con la tarjeta de la página. */
export const DIAS_AVISO_PAGO = [2, 0] as const;

export interface ClienteParaAvisos {
  id: string;
  activo: boolean;
  notificacionesWeb: boolean;
  avisosAutomaticos: Partial<Record<TipoAviso, boolean>>;
  /** Fecha de pago en AAAA-MM-DD de Mazatlán, o null si no tiene. */
  fechaPago: string | null;
}

/** Ante la duda, no: un campo ausente o de tipo raro deja el aviso apagado. */
export function avisosDesdeDoc(data: Record<string, unknown>): Partial<Record<TipoAviso, boolean>> {
  const crudo = data.avisosAutomaticos;
  if (typeof crudo !== "object" || crudo === null) return {};
  const m = crudo as Record<string, unknown>;
  return { rachaPerdida: m.rachaPerdida === true, recordatorioPago: m.recordatorioPago === true };
}

/** Tu llave de Notificaciones manda: sin ella, ningún aviso automático sale. */
export function quiere(c: ClienteParaAvisos, tipo: TipoAviso): boolean {
  return c.activo && c.notificacionesWeb && c.avisosAutomaticos[tipo] === true;
}

function moverDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function esDiaHabil(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return dia !== 0 && dia !== 6;
}

/** El día hábil anterior a `hoy`: el lunes es el viernes. */
export function habilAnterior(hoy: string): string {
  let f = moverDias(hoy, -1);
  while (!esDiaHabil(f)) f = moverDias(f, -1);
  return f;
}

/**
 * Si la racha se rompió en el día hábil anterior a hoy, la fecha de esa falta y cuántos días
 * llevaba. `null` si no se rompió, si era más corta que [RACHA_MINIMA] o si hoy es fin de
 * semana.
 *
 * Solo en días hábiles porque la página no muestra el botón de revivir en fin de semana: un
 * aviso de sábado diría "revívela" sin que haya cómo. La falta del viernes se avisa el lunes,
 * que sigue dentro de la ventana de reparación (2 días hábiles, ver `faltaRompio.ts`).
 *
 * La racha que llevaba se mide con `rachaActual` parada en la falta: como es hábil y no
 * cuenta, el día de gracia la salta y cuenta la corrida que terminó el día anterior.
 */
export function rachaPerdida(
  asistencias: AsistenciaParaRacha[],
  hoy: string
): { fecha: string; dias: number } | null {
  if (!esDiaHabil(hoy) || asistencias.length === 0) return null;
  const fecha = habilAnterior(hoy);
  // Mismo piso que `faltaQueRompioLaRacha`: antes del primer registro no era clienta.
  const primerRegistro = asistencias.reduce((m, a) => (a.fecha < m ? a.fecha : m), asistencias[0].fecha);
  if (fecha < primerRegistro) return null;
  const cuentan = fechasQueCuentan(asistencias);
  if (cuentan.has(fecha)) return null;
  const dias = rachaActual(cuentan, fecha);
  return dias >= RACHA_MINIMA ? { fecha, dias } : null;
}

/** Qué le queda para revivirla. La ruleta solo existe cuando ya no tiene vidas. */
export type SalidaRacha = { vidas: number } | { ruleta: true } | { nada: true };

export interface Mensaje { titulo: string; texto: string; }

export function mensajeRacha(dias: number, salida: SalidaRacha): Mensaje {
  const titulo = "Perdiste tu racha 💔";
  const inicio = `Se rompió tu racha de ${dias} días.`;
  if ("vidas" in salida) {
    const v = salida.vidas === 1 ? "te queda 1 vida" : `te quedan ${salida.vidas} vidas`;
    return { titulo, texto: `${inicio} Todavía ${v}: entra a tu página y revívela.` };
  }
  if ("ruleta" in salida) {
    return {
      titulo,
      texto: `${inicio} Ya no te quedan vidas, pero puedes jugar la ruleta en tu página para revivirla.`,
    };
  }
  return { titulo, texto: `${inicio} Ya no te quedan vidas este mes. ¡Hoy puedes empezar una nueva!` };
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** GEMELO: `diasParaPago` en `web/src/pago.ts`. */
export function diasParaPago(fechaPago: string, hoy: string): number {
  return Math.round((Date.parse(`${fechaPago}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / MS_POR_DIA);
}

/** Los días que faltan si hoy toca recordatorio de pago, o null. */
export function diaDeAvisoPago(fechaPago: string | null, hoy: string): number | null {
  if (!fechaPago) return null;
  const dias = diasParaPago(fechaPago, hoy);
  return (DIAS_AVISO_PAGO as readonly number[]).includes(dias) ? dias : null;
}

export function mensajePago(dias: number): Mensaje {
  return dias === 0
    ? { titulo: "Tu periodo vence hoy", texto: "Hoy vence tu periodo de entrenamiento. Renuévalo para seguir sin pausa 💪" }
    : {
        titulo: `Tu periodo vence en ${dias} días`,
        texto: `Tu periodo de entrenamiento vence en ${dias} días. Renuévalo para seguir sin pausa 💪`,
      };
}

/**
 * El id del aviso en `notificaciones/`. Fijo por tipo, clienta y ocasión: crearlo con
 * `create()` falla si ya existe, y eso es lo que impide mandarlo dos veces aunque la función
 * corra de nuevo. La ocasión del pago lleva la fecha de pago: si el entrenador registra un
 * pago y la fecha se mueve, el siguiente periodo vuelve a avisar.
 */
export function idAviso(tipo: TipoAviso, clienteId: string, ocasion: string): string {
  return `auto_${tipo}_${clienteId}_${ocasion}`;
}
