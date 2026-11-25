/**
 * Kettlebell Bird (entrenador, 2026-11-24): el segundo juego del Arcade. Una kettlebell con alas
 * cae por su peso; cada toque la impulsa hacia arriba. Hay que pasar por el hueco entre las barras
 * que vienen colgando del techo y paradas en el piso. Cada barra pasada es un punto; tocar una
 * barra o el piso termina la partida.
 *
 * Se pone difícil poco a poco: las barras vienen más rápido, el hueco se cierra y la altura del
 * hueco cambia más de una barra a la siguiente. Además, cada `POR_NIVEL` barras se sube de nivel
 * (hasta `NIVELES`, entrenador 2026-11-24): las barras vienen más juntas y todo va más rápido, y
 * el gimnasio de fondo cambia de zona.
 *
 * Aquí solo la lógica, sin pantalla (la pinta `ui/kettlebellBird.ts`). Unidades: el alto del
 * juego mide `ALTO` (y crece hacia abajo); el ancho que se ve depende de la pantalla y se pasa al
 * empezar. El azar llega como función para poder probarlo.
 */

export const ALTO = 100;
/** El piso de caucho: lo de abajo de esta línea es piso. */
export const PISO = 88;
export const RADIO = 3.6;
export const GRAVEDAD = 250;
export const IMPULSO = -82;
export const CAIDA_MAXIMA = 130;
/**
 * La forma de cada obstáculo, como se ve (entrenador, 2026-11-24, discos "P2"): una barra
 * delgada (`ANCHO_TUBO`, con su manga y su seguro) y, cerca de la punta, un disco de hierro
 * ancho (`ANCHO_DISCO`) entre `DISCO_DESDE` y `DISCO_HASTA` desde la orilla del hueco. Se choca
 * con lo que se ve: el disco solo en su zona, la barra en el resto.
 */
export const ANCHO_DISCO = 15;
export const ANCHO_TUBO = 2.4;
/** Un poco antes de la orilla: la cara del disco asoma hacia el hueco. */
export const DISCO_DESDE = -0.3;
export const DISCO_HASTA = 3.9;
/** Barras por nivel, y cuántos niveles hay. */
export const POR_NIVEL = 8;
export const NIVELES = 6;
/** De una barra a la siguiente, en cada nivel: cada vez más juntas. */
export const SEPARACIONES = [44, 40, 37, 34, 32, 30] as const;
export const SEPARACION = SEPARACIONES[0];

export function nivel(puntos: number): number {
  return Math.min(NIVELES, 1 + Math.floor(puntos / POR_NIVEL));
}

export function separacion(puntos: number): number {
  return SEPARACIONES[nivel(puntos) - 1]!;
}

export interface Barra {
  x: number;
  /** El centro del hueco y su alto. */
  centro: number;
  hueco: number;
  pasada: boolean;
  /** Qué número de barra es (la primera es la 1): ahí van las marcas de los records. */
  n: number;
}

export interface Vuelo {
  /** Dónde va la kettlebell (x fija en la pantalla) y su velocidad vertical. */
  x: number;
  y: number;
  vy: number;
  barras: Barra[];
  puntos: number;
  /** Lo recorrido: mueve el gimnasio del fondo. */
  recorrido: number;
  vistaAncho: number;
  terminada: boolean;
  azar: () => number;
}

/** Unidades por segundo: sube un poco con cada barra y un salto con cada nivel, con tope. */
export function velocidad(puntos: number): number {
  return Math.min(64, 32 * (1 + 0.018 * puntos) + (nivel(puntos) - 1) * 2.5);
}

/** El alto del hueco: se cierra con los puntos, sin bajar de 23. */
export function hueco(puntos: number): number {
  return Math.max(23, 36 - puntos * 0.35);
}

/** Cuánto puede cambiar la altura del hueco de una barra a la siguiente. */
export function salto(puntos: number): number {
  return Math.min(34, 14 + puntos * 0.6);
}

function nuevaBarra(x: number, anterior: Barra | undefined, puntos: number, azar: () => number): Barra {
  const h = hueco(puntos);
  const min = 10 + h / 2, max = PISO - 8 - h / 2;
  const base = anterior?.centro ?? (min + max) / 2;
  const s = salto(puntos);
  const centro = Math.max(min, Math.min(max, base + (azar() * 2 - 1) * s));
  return { x, centro, hueco: h, pasada: false, n: (anterior?.n ?? 0) + 1 };
}

export function nuevoVuelo(vistaAncho: number, azar: () => number = Math.random): Vuelo {
  const v: Vuelo = { x: vistaAncho * 0.3, y: ALTO * 0.42, vy: IMPULSO * 0.6, barras: [], puntos: 0, recorrido: 0, vistaAncho, terminada: false, azar };
  // La primera barra aparece un poco después de la orilla: da tiempo de entender el juego.
  let x = vistaAncho + 18;
  while (x < vistaAncho + 18 + SEPARACION * 3) {
    v.barras.push(nuevaBarra(x, v.barras[v.barras.length - 1], 0, azar));
    x += SEPARACION;
  }
  return v;
}

export function aletear(v: Vuelo): void {
  if (!v.terminada) v.vy = IMPULSO;
}

/** ¿Choca el círculo (cx, cy, r) con el rectángulo? */
export function choca(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number): boolean {
  const px = Math.max(x, Math.min(cx, x + w));
  const py = Math.max(y, Math.min(cy, y + h));
  return (cx - px) ** 2 + (cy - py) ** 2 < r * r;
}

/** ¿Toca la barra de arriba o la de abajo (su tubo o su disco)? */
export function chocaConBarra(cx: number, cy: number, r: number, b: Barra): boolean {
  const arriba = b.centro - b.hueco / 2, abajo = b.centro + b.hueco / 2;
  const tx = b.x + (ANCHO_DISCO - ANCHO_TUBO) / 2;
  // El disco se angosta hacia su cara (es un cilindro visto en 3/4): su zona es un poco más angosta.
  const dw = ANCHO_DISCO * 0.88, dx = b.x + (ANCHO_DISCO - dw) / 2, dh = DISCO_HASTA - DISCO_DESDE;
  return choca(cx, cy, r, tx, -50, ANCHO_TUBO, arriba + 50)
    || choca(cx, cy, r, tx, abajo, ANCHO_TUBO, PISO - abajo)
    || choca(cx, cy, r, dx, arriba - DISCO_HASTA, dw, dh)
    || choca(cx, cy, r, dx, abajo + DISCO_DESDE, dw, dh);
}

/** Avanza `dt` segundos. Devuelve "punto" al pasar una barra y "fin" al chocar. */
export function avanzar(v: Vuelo, dt: number): "punto" | "fin" | null {
  if (v.terminada) return null;
  v.vy = Math.min(CAIDA_MAXIMA, v.vy + GRAVEDAD * dt);
  v.y += v.vy * dt;
  // El techo no mata: la detiene.
  if (v.y < RADIO) { v.y = RADIO; v.vy = Math.max(0, v.vy); }
  const vel = velocidad(v.puntos);
  v.recorrido += vel * dt;
  for (const b of v.barras) b.x -= vel * dt;
  if (v.barras.length > 0 && v.barras[0]!.x + ANCHO_DISCO < -10) v.barras.shift();
  const ultima = v.barras[v.barras.length - 1];
  if (!ultima || ultima.x < v.vistaAncho + 10) {
    v.barras.push(nuevaBarra((ultima?.x ?? v.vistaAncho) + separacion(v.puntos), ultima, v.puntos, v.azar));
  }
  if (v.y + RADIO >= PISO) {
    v.y = PISO - RADIO;
    v.terminada = true;
    return "fin";
  }
  let evento: "punto" | null = null;
  for (const b of v.barras) {
    if (chocaConBarra(v.x, v.y, RADIO * 0.88, b)) {
      v.terminada = true;
      return "fin";
    }
    if (!b.pasada && b.x + ANCHO_DISCO < v.x - RADIO) {
      b.pasada = true;
      v.puntos++;
      evento = "punto";
    }
  }
  return evento;
}
