/**
 * El ciclo de entrenamiento de cada clienta y su RPE objetivo (entrenador, 2026-11-26).
 *
 * Bloques de 4 semanas: tres de carga que suben (base RPE 7, carga RPE 8, fuerza RPE 8–9) y una
 * de descarga (RPE 5–6), y vuelta a empezar. Una semana solo cuenta si entrenó al menos 3 días
 * (`DIAS_PARA_AVANZAR`); si no, se repite. Cada clienta lleva el suyo, contado desde su primer
 * entrenamiento (las que ya entrenaban, desde `ARRANQUE_CICLO`), así no descargan todas la misma
 * semana con el tiempo. Las semanas van de lunes a domingo,
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

/**
 * Cuando arrancó el ciclo (entrenador, 2026-11-26): las clientas que ya entrenaban empiezan todas
 * juntas en la semana 1 la semana del lunes 23 de noviembre de 2026, para que ninguna cayera de
 * golpe en una descarga; las que llegan después cuentan desde su primera asistencia.
 */
export const ARRANQUE_CICLO = "2026-11-23";

/**
 * Lo que tiene que entrenar en una semana (lunes a domingo) para que el ciclo avance: al menos 3
 * días con asistencia (entrenador, 2026-11-26). Con menos, la semana del bloque se repite: una
 * semana de 2 días no es una semana de carga, y unas vacaciones dejan el ciclo donde iba.
 */
export const DIAS_PARA_AVANZAR = 3;

/**
 * En qué semana del bloque va. Cuenta, desde su inicio, las semanas YA TERMINADAS en que fue al
 * menos `DIAS_PARA_AVANZAR` días; la de hoy todavía no cuenta (avanza el lunes siguiente si la
 * completa).
 */
export function semanaDelCiclo(
  primerEntreno: string | null,
  hoy: string,
  asistencias: readonly { fecha: string; asistio: boolean }[] = [],
  /** La semana que eligió ella (`cambiarSemana`): desde esa semana cuenta a partir de la elegida. */
  ajuste: { semana: number; lunes: string } | null = null
): SemanaCiclo {
  const total = SEMANAS.length;
  const conAjuste = ajuste !== null && Number.isInteger(ajuste.semana) && ajuste.semana >= 1 &&
    ajuste.semana <= total && ajuste.lunes <= lunesDe(hoy);
  // Sin ningún entrenamiento todavía, su ciclo empieza con el primero: hasta entonces, semana 1.
  const inicio = conAjuste ? ajuste.lunes
    : primerEntreno === null ? hoy : primerEntreno > ARRANQUE_CICLO ? primerEntreno : ARRANQUE_CICLO;
  const desplazamiento = conAjuste ? ajuste.semana - 1 : 0;
  const desde = lunesDe(inicio);
  const hasta = lunesDe(hoy);
  // Días distintos con asistencia, por semana (su lunes), entre el inicio y antes de esta semana.
  const diasPorSemana = new Map<string, Set<string>>();
  for (const a of asistencias) {
    if (!a.asistio || a.fecha < desde || a.fecha >= hasta) continue;
    const lunes = lunesDe(a.fecha);
    const dias = diasPorSemana.get(lunes) ?? new Set<string>();
    dias.add(a.fecha);
    diasPorSemana.set(lunes, dias);
  }
  let completas = 0;
  for (const dias of diasPorSemana.values()) if (dias.size >= DIAS_PARA_AVANZAR) completas += 1;
  const i = (completas + desplazamiento) % total;
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
