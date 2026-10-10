/**
 * Rangos de fuerza por músculo y la comparación con la población.
 *
 * El nivel de un músculo es un número continuo de 0 a 5 que sale de comparar su mejor marca
 * (1RM estimado / peso corporal) con los estándares de cada ejercicio por sexo. Ese cálculo
 * llega con el registro de ejercicios; aquí solo se traduce el nivel a lo que ve la clienta.
 * Ver `docs/superpowers/specs/2026-10-10-mapa-fuerza-entrenamiento-design.md`.
 *
 * Los porcentajes siguen la convención de las tablas públicas de estándares de fuerza: el
 * corte de Principiante es más fuerte que ~5 % de las personas, Novato ~20 %, Intermedio
 * ~50 %, Avanzado ~80 % y Élite ~95 %. Entre cortes se interpola en línea recta.
 */

export interface Rango { nombre: string; desde: number; }

/** Ordenados por `desde`: el rango es el último cuyo corte ya se alcanzó. */
export const RANGOS: readonly Rango[] = [
  { nombre: "Principiante", desde: 0 },
  { nombre: "Novato", desde: 1 },
  { nombre: "Intermedio", desde: 2 },
  { nombre: "Avanzado", desde: 3 },
  { nombre: "Élite", desde: 4 },
];

/** Nivel → porcentaje de la población por debajo. El último punto es el techo de la escala. */
const PERCENTILES: readonly (readonly [number, number])[] = [
  [0, 5], [1, 20], [2, 50], [3, 80], [4, 95], [5, 99],
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
