import type { Sexo } from "./datos";
import { NOMBRES_MUSCULO } from "./fuerza";

/**
 * Batalla, en Amigos (pedido del entrenador, 2026-10-21): quién gana entre dos personas, por
 * músculo, por ejercicio o en todo. La función `batallaAmigos` trae la mejor serie de cada una
 * en los ejercicios que las dos tienen; aquí se cuenta quién gana cada uno y quién la batalla.
 *
 * Cada ejercicio lo gana el `puntaje` más alto: lo que levanta en proporción a su peso
 * corporal, con los ajustes de edad y peso del mapa y medio ajuste por sexo (ver
 * `functions/src/batalla.ts`). La
 * batalla la gana quien gana más ejercicios; si es por uno, "por una diferencia mínima".
 */

/** GEMELO: `MarcaBatalla` de `functions/src/batalla.ts`. */
export interface MarcaBatalla {
  reps: number;
  peso: number | null;
  unoRm: number | null;
  /**
   * El 1RM como % de su peso corporal. Solo entre hombres: con una mujer en la batalla el
   * servidor lo manda en null. Opcional: una respuesta vieja del servidor no lo trae.
   */
  porPeso?: number | null;
  /**
   * El 1RM en kilos de Focus Novum (con el factor de su sede, `sede.ts`): con él compara el modo
   * real. Opcional: una respuesta vieja del servidor no lo trae, y entonces se usa `unoRm`.
   */
  unoRmBase?: number | null;
  puntaje: number;
}

/** GEMELO: `EjercicioBatalla` de `functions/src/batalla.ts`. */
export interface EjercicioBatalla {
  id: string;
  nombre: string;
  tipo: "peso" | "corporal" | "tiempo";
  musculos: string[];
  pesoPorMancuerna: boolean;
  a: MarcaBatalla;
  b: MarcaBatalla;
}

/** GEMELO: `DatosBatalla` de `functions/src/batalla.ts`. `a` es quien reta. */
export interface DatosBatalla {
  a: { nombre: string; sexo: Sexo };
  b: { nombre: string; sexo: Sexo };
  ejercicios: EjercicioBatalla[];
}

export type Lado = "a" | "b";

export type Eleccion =
  | { modo: "musculo"; musculo: string }
  | { modo: "ejercicio"; ejercicio: string }
  | { modo: "todo" };

export interface FilaBatalla {
  ejercicio: EjercicioBatalla;
  gana: Lado | null;
}

export interface Resultado {
  filas: FilaBatalla[];
  victorias: Record<Lado, number>;
  /** null = empate. */
  ganador: Lado | null;
  /** Cómo ganó, para el texto: "minima", "clara" o "aplastante". */
  margen: "minima" | "clara" | "aplastante" | null;
}

/**
 * Cómo se decide cada ejercicio (interruptor de la batalla, entrenador, 2026-10-22):
 * - `justo`: el `puntaje`, lo que levanta para su peso con los ajustes (lo de siempre).
 * - `real`: la fuerza absoluta, sin ningún ajuste: el 1RM en kg en los de peso, y las reps o
 *   los segundos en los demás. No importa cuánto pesas, sino cuánto cargas. Los kilos de
 *   máquina, en kilos de Focus (`unoRmBase`): entre sedes una máquina no pesa lo mismo.
 */
export type ModoComparacion = "justo" | "real";

/** Con lo que se compara una marca en ese modo: más es mejor. */
export function valorDe(e: EjercicioBatalla, m: MarcaBatalla, modo: ModoComparacion = "justo"): number {
  if (modo === "justo") return m.puntaje;
  return e.tipo === "peso" ? m.unoRmBase ?? m.unoRm ?? 0 : m.reps;
}

/** Dos marcas a menos de 0.5 % una de la otra son empate: es menos que lo que mide Epley. */
const EMPATE = 0.005;

export function ganaEjercicio(e: EjercicioBatalla, modo: ModoComparacion = "justo"): Lado | null {
  const pa = valorDe(e, e.a, modo);
  const pb = valorDe(e, e.b, modo);
  const mayor = Math.max(pa, pb);
  if (mayor <= 0 || Math.abs(pa - pb) / mayor < EMPATE) return null;
  return pa > pb ? "a" : "b";
}

/** Los músculos con al menos un ejercicio en común, en el orden de siempre, con cuántos. */
export function musculosEnComun(d: DatosBatalla): { musculo: string; ejercicios: number }[] {
  return Object.keys(NOMBRES_MUSCULO)
    .map((musculo) => ({ musculo, ejercicios: d.ejercicios.filter((e) => e.musculos.includes(musculo)).length }))
    .filter((x) => x.ejercicios > 0);
}

export function ejerciciosDe(d: DatosBatalla, eleccion: Eleccion): EjercicioBatalla[] {
  if (eleccion.modo === "todo") return d.ejercicios;
  if (eleccion.modo === "musculo") return d.ejercicios.filter((e) => e.musculos.includes(eleccion.musculo));
  return d.ejercicios.filter((e) => e.id === eleccion.ejercicio);
}

export function resolverBatalla(ejercicios: readonly EjercicioBatalla[], modo: ModoComparacion = "justo"): Resultado {
  const filas = ejercicios.map((ejercicio) => ({ ejercicio, gana: ganaEjercicio(ejercicio, modo) }));
  const victorias = { a: filas.filter((f) => f.gana === "a").length, b: filas.filter((f) => f.gana === "b").length };
  if (victorias.a === victorias.b) return { filas, victorias, ganador: null, margen: null };
  const ganador: Lado = victorias.a > victorias.b ? "a" : "b";
  const perdedor: Lado = ganador === "a" ? "b" : "a";
  let margen: Resultado["margen"];
  if (filas.length === 1) {
    // Un solo ejercicio: el margen es cuánto más levantó en proporción.
    const e = filas[0].ejercicio;
    const ventaja = valorDe(e, e[ganador], modo) / valorDe(e, e[perdedor], modo) - 1;
    margen = ventaja < 0.05 ? "minima" : ventaja < 0.25 ? "clara" : "aplastante";
  } else {
    const diferencia = victorias[ganador] - victorias[perdedor];
    margen = diferencia === 1 ? "minima"
      : victorias[perdedor] === 0 && victorias[ganador] >= 3 ? "aplastante"
      : "clara";
  }
  return { filas, victorias, ganador, margen };
}

/** "Bogue ganó la batalla por una diferencia mínima": el titular del resultado. */
export function textoResultado(r: Resultado, d: DatosBatalla): { titulo: string; detalle: string; como: string } {
  const marcador = r.filas.length === 1 ? "" : `${r.victorias.a} a ${r.victorias.b}`;
  if (r.ganador === null) {
    return { titulo: "¡Empate!", detalle: marcador ? `Quedaron ${marcador}: nadie se lleva esta batalla.` : "Quedaron parejas: nadie se lleva esta batalla.", como: "nadie se la lleva" };
  }
  const quien = r.ganador === "a" ? "Ganaste" : `${d.b.nombre} ganó`;
  const como = r.margen === "minima" ? "por una diferencia mínima"
    : r.margen === "aplastante" ? "de forma aplastante"
    : "con claridad";
  return { titulo: `¡${quien} la batalla!`, detalle: `${marcador ? `${marcador}, ` : ""}${como}.`, como };
}

/** "40 kg × 8", "15 reps" o "60 s": la mejor serie, como se anotó. */
export function textoSerie(e: EjercicioBatalla, m: MarcaBatalla): string {
  if (e.tipo === "tiempo") return `${m.reps} s`;
  if (e.tipo === "corporal" || m.peso === null) return `${m.reps} ${m.reps === 1 ? "rep" : "reps"}`;
  return `${m.peso} kg × ${m.reps}`;
}
