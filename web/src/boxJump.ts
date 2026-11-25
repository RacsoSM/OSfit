/**
 * Box Jump (entrenador, 2026-11-25): el tercer juego del Arcade. La clienta rebota sola sobre
 * cajones de salto y va subiendo el edificio OSFIT; con el dedo elige hacia dónde va (si sale
 * por un lado entra por el otro). Si cae por debajo de la pantalla, se acaba. Cada metro subido
 * es un punto.
 *
 * Cada `METROS_POR_PISO` metros se sube de piso (hasta `PISOS`): los cajones quedan más
 * separados y más angostos, aparecen cajones que se mueven y cajones de espuma que se rompen al
 * usarlos. Hay trampolines para un súper salto. Siempre hay un camino: entre dos cajones firmes
 * nunca hay más altura de la que se puede saltar.
 *
 * Aquí solo la lógica (la pinta `ui/boxJump.ts`). Unidades: el ancho mide `ANCHO`; la altura
 * crece hacia arriba (10 unidades = 1 metro). El azar llega como función para poder probarlo.
 */

export const ANCHO = 100;
export const RADIO = 7;
export const GRAVEDAD = 230;
export const SALTO = 130;
export const SUPER_SALTO = 200;
/** Lo más alto que llega un salto normal: v² / 2g. */
export const ALTURA_SALTO = (SALTO * SALTO) / (2 * GRAVEDAD);
export const UNIDADES_POR_METRO = 10;
export const METROS_POR_PISO = 40;
export const PISOS = 8;
/** Cada nivel es una altura del viaje (entrenador, 2026-11-25: "empieza en la tierra, luego va al cielo, al espacio, pasa por la luna, marte…"). */
export const ETAPAS = ["Tierra", "Cielo", "Estratósfera", "Espacio", "Luna", "Marte", "Júpiter", "Galaxia"] as const;
export const ALTO_CAJON = 7;
const VEL_LATERAL = 115;

export type Tipo = "firme" | "movil" | "espuma";

export interface Cajon {
  x: number;
  /** Altura de su tapa (donde se aterriza). */
  h: number;
  ancho: number;
  tipo: Tipo;
  vx: number;
  trampolin: boolean;
  /** La espuma que ya se usó se rompe y cae. */
  roto: boolean;
}

export interface Salto {
  x: number;
  h: number;
  vx: number;
  vh: number;
  cajones: Cajon[];
  /** La altura más alta alcanzada y lo que ve la cámara (su orilla de abajo). */
  maxH: number;
  camara: number;
  vistaAlto: number;
  /** La altura del último cajón firme generado: el siguiente nunca queda fuera de alcance. */
  ultimoFirme: number;
  terminada: boolean;
  azar: () => number;
}

export function piso(metros: number): number {
  return Math.min(PISOS, 1 + Math.floor(metros / METROS_POR_PISO));
}

export function metros(s: Salto): number {
  return Math.floor(Math.max(0, s.maxH) / UNIDADES_POR_METRO);
}

/** Cuánto sube de un cajón firme al siguiente, según el piso: [mínimo, máximo]. */
export function separacion(p: number): [number, number] {
  const tabla: [number, number][] = [[15, 21], [16, 22], [17, 23], [19, 25], [20, 26], [21, 27], [22, 28], [23, 28]];
  return tabla[Math.min(PISOS, Math.max(1, p)) - 1]!;
}

export function anchoCajon(p: number): number {
  return [24, 21, 19, 17, 15, 14, 13, 12][Math.min(PISOS, Math.max(1, p)) - 1]!;
}

export function probMovil(p: number): number { return [0, 0.12, 0.22, 0.32, 0.42, 0.52, 0.6, 0.68][Math.min(PISOS, p) - 1]!; }
export function probEspuma(p: number): number { return [0, 0, 0.15, 0.2, 0.25, 0.3, 0.33, 0.36][Math.min(PISOS, p) - 1]!; }
export const PROB_TRAMPOLIN = 0.06;

function nuevoCajon(s: Salto): void {
  const m = Math.floor(s.ultimoFirme / UNIDADES_POR_METRO);
  const p = piso(m);
  // Pasando el último piso sigue subiendo la dificultad: cada 40 m más, cajones más angostos y
  // más que se mueven, más rápido.
  const extra = Math.max(0, m / METROS_POR_PISO - (PISOS - 1));
  const [min, max] = separacion(p);
  const h = s.ultimoFirme + min + s.azar() * (max - min);
  const ancho = Math.max(9, anchoCajon(p) - extra * 0.6);
  const x = s.azar() * (ANCHO - ancho);
  const movil = s.azar() < Math.min(0.85, probMovil(p) + extra * 0.04);
  s.cajones.push({
    x, h, ancho, tipo: movil ? "movil" : "firme",
    vx: movil ? (s.azar() < 0.5 ? -1 : 1) * (12 + p * 5 + extra * 3) : 0,
    trampolin: !movil && s.azar() < PROB_TRAMPOLIN,
    roto: false,
  });
  // A veces, una espuma de más entre los dos: tienta, pero no hace falta.
  if (s.azar() < probEspuma(p)) {
    const he = s.ultimoFirme + (h - s.ultimoFirme) * (0.35 + s.azar() * 0.3);
    s.cajones.push({ x: s.azar() * (ANCHO - ancho), h: he, ancho, tipo: "espuma", vx: 0, trampolin: false, roto: false });
  }
  s.ultimoFirme = h;
}

export function nuevoSalto(vistaAlto: number, azar: () => number = Math.random): Salto {
  const s: Salto = {
    x: ANCHO / 2, h: 0, vx: 0, vh: SALTO, cajones: [], maxH: 0, camara: -20, vistaAlto,
    ultimoFirme: 0, terminada: false, azar,
  };
  // El primer cajón, ancho, justo debajo.
  s.cajones.push({ x: ANCHO / 2 - 20, h: 0, ancho: 40, tipo: "firme", vx: 0, trampolin: false, roto: false });
  while (s.ultimoFirme < s.camara + vistaAlto + 40) nuevoCajon(s);
  return s;
}

export type Evento = "rebote" | "trampolin" | "espuma" | "fin" | null;

/**
 * Avanza `dt` segundos. `objetivo` es la x a la que apunta el dedo (null sin dedo): la clienta va
 * hacia allá. Devuelve qué pasó: un rebote, un trampolín, una espuma rota o el fin.
 */
export function avanzar(s: Salto, dt: number, objetivo: number | null): Evento {
  if (s.terminada) return null;
  // De lado: hacia el dedo, por el camino corto (se puede cruzar la orilla).
  if (objetivo !== null) {
    let d = objetivo - s.x;
    if (d > ANCHO / 2) d -= ANCHO;
    if (d < -ANCHO / 2) d += ANCHO;
    s.vx = Math.max(-VEL_LATERAL, Math.min(VEL_LATERAL, d * 9));
  } else {
    s.vx *= Math.pow(0.02, dt);
  }
  s.x += s.vx * dt;
  if (s.x < -RADIO) s.x += ANCHO + RADIO * 2;
  if (s.x > ANCHO + RADIO) s.x -= ANCHO + RADIO * 2;

  for (const c of s.cajones) {
    if (c.tipo === "movil") {
      c.x += c.vx * dt;
      if (c.x < 0) { c.x = -c.x; c.vx = Math.abs(c.vx); }
      if (c.x + c.ancho > ANCHO) { c.x = 2 * (ANCHO - c.ancho) - c.x; c.vx = -Math.abs(c.vx); }
    }
    if (c.roto) c.h -= 90 * dt;
  }

  const antes = s.h;
  s.vh -= GRAVEDAD * dt;
  s.h += s.vh * dt;
  let evento: Evento = null;
  // Solo se aterriza cayendo y desde arriba de la tapa.
  if (s.vh < 0) {
    for (const c of s.cajones) {
      if (c.roto) continue;
      const sobre = s.x >= c.x - RADIO * 0.6 && s.x <= c.x + c.ancho + RADIO * 0.6;
      if (sobre && antes >= c.h && s.h <= c.h) {
        s.h = c.h;
        if (c.trampolin) { s.vh = SUPER_SALTO; evento = "trampolin"; }
        else { s.vh = SALTO; evento = "rebote"; }
        if (c.tipo === "espuma") { c.roto = true; evento = "espuma"; }
        break;
      }
    }
  }
  s.maxH = Math.max(s.maxH, s.h);
  // La cámara solo sube: la clienta queda a un poco menos de la mitad de la pantalla.
  s.camara = Math.max(s.camara, s.h - s.vistaAlto * 0.42);
  while (s.ultimoFirme < s.camara + s.vistaAlto + 40) nuevoCajon(s);
  s.cajones = s.cajones.filter((c) => c.h > s.camara - 30);
  if (s.h < s.camara - RADIO * 2) {
    s.terminada = true;
    return "fin";
  }
  return evento;
}
