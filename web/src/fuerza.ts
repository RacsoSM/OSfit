/**
 * Rangos de fuerza por músculo y la comparación con TODA la población (no solo con quienes
 * entrenan).
 *
 * El nivel de un músculo es un número continuo de 0 a 5 que sale de comparar su mejor marca
 * (1RM estimado / peso corporal) con los cinco estándares de cada ejercicio por sexo: nivel 0
 * es no levantar nada, y los niveles 1 a 5 son los estándares de Principiante, Novato,
 * Intermedio, Avanzado y Élite. Ese cálculo llega con el registro de ejercicios; aquí solo
 * se traduce el nivel a lo que ve la clienta.
 * Ver `docs/superpowers/specs/2026-10-10-mapa-fuerza-entrenamiento-design.md`.
 *
 * **Porcentajes contra toda la población (estimación).** Las tablas públicas de estándares
 * comparan contra gente que entrena (Principiante supera al ~5 % de ellos, Novato ~20 %,
 * Intermedio ~50 %, Avanzado ~80 %, Élite ~95 %). Para llevarlo a toda la población:
 * - el estándar de Principiante es, en esas tablas, lo que levanta un adulto que no entrena:
 *   se toma como la mediana, el 50 %;
 * - solo ~1 de cada 4 adultos entrena fuerza, así que los que superan un estándar más alto
 *   son casi todos de ese cuarto: Novato ≈ 78 %, Intermedio ≈ 88 %, Avanzado ≈ 95 %,
 *   Élite ≈ 99 %.
 * Por debajo del estándar de Principiante baja en línea recta hasta el 1 % en el nivel 0.
 */

export interface Rango { nombre: string; desde: number; }

/**
 * Ordenados por `desde`: el rango es el último cuyo estándar ya se alcanzó. Principiante va
 * desde 0 porque es donde está todo el que todavía no llega al estándar de Novato.
 */
export const RANGOS: readonly Rango[] = [
  { nombre: "Principiante", desde: 0 },
  { nombre: "Novato", desde: 2 },
  { nombre: "Intermedio", desde: 3 },
  { nombre: "Avanzado", desde: 4 },
  { nombre: "Élite", desde: 5 },
];

/** Nivel → porcentaje de toda la población que queda por debajo. */
const PERCENTILES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 50], [2, 78], [3, 88], [4, 95], [5, 99],
];

const acotar = (n: number) => Math.min(5, Math.max(0, n));

export function rangoDe(nivel: number): Rango {
  const n = acotar(nivel);
  let r = RANGOS[0];
  for (const x of RANGOS) if (n >= x.desde) r = x;
  return r;
}

/** Entero de 1 a 99: nunca "más fuerte que el 0 %" ni "que el 100 %". */
export function percentilDe(nivel: number): number {
  const n = acotar(nivel);
  for (let i = 1; i < PERCENTILES.length; i++) {
    const [n0, p0] = PERCENTILES[i - 1];
    const [n1, p1] = PERCENTILES[i];
    if (n <= n1) return Math.round(p0 + ((n - n0) / (n1 - n0)) * (p1 - p0));
  }
  return PERCENTILES[PERCENTILES.length - 1][1];
}

/** Lo que el mapa sabe de un músculo. Ausente = sin datos. */
export interface FuerzaMusculo { nivel: number; }

/** Cómo se llama cada grupo de los SVG (`data-musculo`) en pantalla. */
export const NOMBRES_MUSCULO: Readonly<Record<string, string>> = {
  pecho: "Pecho",
  abdomen: "Abdomen",
  hombro: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebrazo: "Antebrazos",
  trapecio: "Trapecio",
  infraespinoso: "Infraespinoso",
  dorsal: "Dorsales",
  lumbar: "Zona lumbar",
  gluteo: "Glúteos",
  cuadriceps: "Cuádriceps",
  isquiotibiales: "Isquiotibiales",
  pantorrilla: "Pantorrillas",
};

export function nombreMusculo(grupo: string): string {
  return NOMBRES_MUSCULO[grupo] ?? grupo;
}
