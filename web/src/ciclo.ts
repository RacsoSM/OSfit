/**
 * El ciclo de entrenamiento de cada clienta y su RPE objetivo (entrenador, 2026-11-26).
 *
 * Bloques de 4 semanas: tres de carga que suben (base RPE 7, carga RPE 8, fuerza RPE 8–9) y una
 * de descarga (RPE 5–6), y vuelta a empezar. Cada clienta lleva el suyo, contado desde su primer
 * entrenamiento, así no descargan todas la misma semana. Las semanas van de lunes a domingo,
 * como el resto de la página.
 *
 * Lo que ella reporta al terminar ("¿Qué tan pesado estuvo?", del 1 al 10: el RPE de la sesión)
 * se compara con el objetivo de la semana: si va muy por encima se le sugiere adelantar la
 * descarga, y si va muy por debajo, subir el peso. Solo se sugiere: el ciclo no cambia solo.
 *
 * Todo puro (sin Firestore ni DOM) para poder probarlo.
 */

export type Fase = "base" | "carga" | "fuerza" | "descarga";

export interface SemanaCiclo {
  /** 1 a 4. */
  numero: number;
  total: number;
  fase: Fase;
  /** Cómo se escribe ("8–9"). */
  rpe: string;
  /** Para comparar con lo reportado (el centro del rango). */
  objetivo: number;
}

export const SEMANAS: readonly Omit<SemanaCiclo, "numero" | "total">[] = [
  { fase: "base", rpe: "7", objetivo: 7 },
  { fase: "carga", rpe: "8", objetivo: 8 },
  { fase: "fuerza", rpe: "8–9", objetivo: 8.5 },
  { fase: "descarga", rpe: "5–6", objetivo: 5.5 },
];

const DIA_MS = 86_400_000;

/** El lunes (AAAA-MM-DD) de la semana de `fecha`. */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}

/**
 * Su primer entrenamiento: la asistencia más vieja. Las asistencias llegan completas (todas las
 * de la clienta), así que el inicio no se mueve; las sesiones no, porque solo se traen las
 * últimas 140, y por eso solo cuentan si todavía no hay ninguna asistencia. Null si todavía no
 * entrena (entonces está en la semana 1).
 */
export function inicioDelCiclo(
  asistencias: readonly { fecha: string; asistio: boolean }[],
  sesiones: readonly { fecha: string }[] | null
): string | null {
  let primero: string | null = null;
  for (const a of asistencias) if (a.asistio && (primero === null || a.fecha < primero)) primero = a.fecha;
  if (primero !== null) return primero;
  for (const s of sesiones ?? []) if (s.fecha && (primero === null || s.fecha < primero)) primero = s.fecha;
  return primero;
}

export function semanaDelCiclo(inicio: string | null, hoy: string): SemanaCiclo {
  const total = SEMANAS.length;
  let i = 0;
  if (inicio && inicio <= hoy) {
    const semanas = Math.round((Date.parse(`${lunesDe(hoy)}T12:00:00Z`) - Date.parse(`${lunesDe(inicio)}T12:00:00Z`)) / (7 * DIA_MS));
    i = ((semanas % total) + total) % total;
  }
  return { ...SEMANAS[i], numero: i + 1, total };
}

export type Sugerencia = { tipo: "pesada" | "ligera"; promedio: number } | null;

/** Cuánto tiene que separarse el promedio del objetivo para decir algo. */
export const MARGEN = 1.5;
/** Con menos entrenamientos calificados en la semana no se sugiere nada: uno solo es ruido. */
export const MINIMO_REPORTES = 2;

/**
 * Qué sugerirle con lo que reportó esta semana (sus calificaciones con la fecha del
 * entrenamiento). En la descarga no se sugiere adelantarla, claro, ni subir el peso: es la
 * semana de bajarle.
 */
export function sugerencia(reportes: readonly { fecha: string; esfuerzo: number }[], semana: SemanaCiclo, hoy: string): Sugerencia {
  if (semana.fase === "descarga") return null;
  const lunes = lunesDe(hoy);
  const deLaSemana = reportes.filter((r) => r.fecha >= lunes && r.fecha <= hoy);
  if (deLaSemana.length < MINIMO_REPORTES) return null;
  const promedio = deLaSemana.reduce((s, r) => s + r.esfuerzo, 0) / deLaSemana.length;
  const redondeado = Math.round(promedio * 10) / 10;
  if (promedio >= semana.objetivo + MARGEN) return { tipo: "pesada", promedio: redondeado };
  if (promedio <= semana.objetivo - MARGEN) return { tipo: "ligera", promedio: redondeado };
  return null;
}
