/**
 * Torre de discos (entrenador, 2026-11-24): el minijuego de la web. Un disco se desliza de lado a
 * lado sobre la torre y se toca para soltarlo; lo que sobresale se corta, así que el siguiente
 * sale más angosto. Si cae completo fuera de la torre, se acaba.
 *
 * Se pone difícil poco a poco:
 *  - cada disco apilado sube la velocidad;
 *  - desde el disco `DESDE_LADOS`, cada disco entra por un lado distinto;
 *  - desde `DESDE_ONDULADO`, el disco ya no va a velocidad pareja: acelera y frena.
 * Soltarlo casi exacto encima ("perfecto") no corta nada y vale doble; cuatro perfectos
 * seguidos devuelven un poco de ancho.
 *
 * Aquí solo la lógica, sin pantalla (la pinta `ui/juegoDiscos.ts`). Las unidades son de un
 * tablero de `ANCHO_TABLERO` de ancho; la pantalla las escala.
 */

export const ANCHO_TABLERO = 100;
export const ANCHO_INICIAL = 60;
/** Qué tan cerca cuenta como perfecto, en unidades del tablero. */
export const TOLERANCIA_PERFECTO = 1.6;
export const PERFECTOS_PARA_CRECER = 4;
export const CRECER = 4;
export const DESDE_LADOS = 8;
export const DESDE_ONDULADO = 15;
/** Por donde se pasea el disco: un poco más allá de los bordes, para que haya que esperarlo. */
const MARGEN = 14;

export interface Disco { x: number; ancho: number; color: number }

export interface Movil extends Disco { dir: 1 | -1; t: number }

export interface Partida {
  /** De abajo hacia arriba; el primero es la base y no cuenta. */
  torre: Disco[];
  movil: Movil;
  puntos: number;
  /** Discos apilados (sin la base). */
  apilados: number;
  perfectosSeguidos: number;
  terminada: boolean;
}

export type Resultado =
  | { tipo: "fallo"; caido: Disco }
  | { tipo: "perfecto"; crecio: boolean }
  | { tipo: "corte"; cortado: Disco };

/** Unidades por segundo con `n` discos apilados: arranca tranquilo y sube, con tope. */
export function velocidad(n: number): number {
  return Math.min(150, 42 * (1 + 0.07 * n));
}

function nuevoMovil(base: Disco, n: number): Movil {
  // Al principio siempre desde la izquierda; luego alterna.
  const desdeDerecha = n >= DESDE_LADOS && n % 2 === 1;
  return {
    x: desdeDerecha ? ANCHO_TABLERO + MARGEN - base.ancho : -MARGEN,
    ancho: base.ancho,
    color: n + 1,
    dir: desdeDerecha ? -1 : 1,
    t: 0,
  };
}

export function nuevaPartida(): Partida {
  const base: Disco = { x: (ANCHO_TABLERO - ANCHO_INICIAL) / 2, ancho: ANCHO_INICIAL, color: 0 };
  return { torre: [base], movil: nuevoMovil(base, 0), puntos: 0, apilados: 0, perfectosSeguidos: 0, terminada: false };
}

/** Mueve el disco `dt` segundos, rebotando en los bordes. */
export function avanzar(p: Partida, dt: number): void {
  if (p.terminada) return;
  const m = p.movil;
  m.t += dt;
  let v = velocidad(p.apilados);
  // Ondulado: acelera y frena (entre 0.45× y 1.55×), sin dejar de moverse.
  if (p.apilados >= DESDE_ONDULADO) v *= 1 + 0.55 * Math.sin(m.t * 3.2);
  m.x += m.dir * v * dt;
  const min = -MARGEN, max = ANCHO_TABLERO + MARGEN - m.ancho;
  if (m.x < min) { m.x = min + (min - m.x); m.dir = 1; }
  if (m.x > max) { m.x = max - (m.x - max); m.dir = -1; }
}

/** Suelta el disco: se apila (cortado o perfecto) o, si no toca la torre, se acaba. */
export function soltar(p: Partida): Resultado {
  const tope = p.torre[p.torre.length - 1]!;
  const m = p.movil;
  const izq = Math.max(m.x, tope.x);
  const der = Math.min(m.x + m.ancho, tope.x + tope.ancho);
  const traslape = der - izq;
  if (traslape <= 0.5) {
    p.terminada = true;
    return { tipo: "fallo", caido: { x: m.x, ancho: m.ancho, color: m.color } };
  }

  let resultado: Resultado;
  let nuevo: Disco;
  if (Math.abs(m.x - tope.x) <= TOLERANCIA_PERFECTO) {
    p.perfectosSeguidos++;
    p.puntos += 2;
    let ancho = tope.ancho, x = tope.x;
    const crece = p.perfectosSeguidos % PERFECTOS_PARA_CRECER === 0 && ancho < ANCHO_INICIAL;
    if (crece) {
      const nuevoAncho = Math.min(ANCHO_INICIAL, ancho + CRECER);
      x = Math.max(0, Math.min(ANCHO_TABLERO - nuevoAncho, x - (nuevoAncho - ancho) / 2));
      ancho = nuevoAncho;
    }
    nuevo = { x, ancho, color: m.color };
    resultado = { tipo: "perfecto", crecio: crece };
  } else {
    p.perfectosSeguidos = 0;
    p.puntos += 1;
    nuevo = { x: izq, ancho: traslape, color: m.color };
    const cortado: Disco = m.x < tope.x
      ? { x: m.x, ancho: m.ancho - traslape, color: m.color }
      : { x: der, ancho: m.ancho - traslape, color: m.color };
    resultado = { tipo: "corte", cortado };
  }
  p.torre.push(nuevo);
  p.apilados++;
  p.movil = nuevoMovil(nuevo, p.apilados);
  return resultado;
}

/** Lo mínimo que tarda un disco en apilarse; lo usa el servidor para descartar trampas. */
export const MS_MINIMOS_POR_DISCO = 250;

export interface Peso { kg: string; color: string; texto: string }

/**
 * Qué disco es según su ancho, con los colores de los discos olímpicos: entre más se corta, más
 * ligero (y más chico) es el que sigue. La base es el disco negro del gym.
 */
export const PESOS: readonly (Peso & { desde: number })[] = [
  { desde: 52, kg: "25", color: "#d6372c", texto: "#fff" },
  { desde: 42, kg: "20", color: "#2a6fd6", texto: "#fff" },
  { desde: 32, kg: "15", color: "#f0b400", texto: "#2a1d00" },
  { desde: 22, kg: "10", color: "#24964a", texto: "#fff" },
  { desde: 12, kg: "5", color: "#ecebe6", texto: "#1d1d1f" },
  { desde: 0, kg: "2.5", color: "#c9cdd3", texto: "#1d1d1f" },
];

export function pesoDe(ancho: number): Peso {
  return PESOS.find((p) => ancho >= p.desde) ?? PESOS[PESOS.length - 1]!;
}
