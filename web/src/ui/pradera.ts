/**
 * La pantalla principal de Mi espacio (entrenador, 2026-11-25): una pradera con un camino que
 * lleva a la casa y al gimnasio de cada quien; tocar uno entra a él. Más adelante, lo que se
 * compre en la tienda para afuera (árboles, bancas, una fuente…) va aquí.
 *
 * Isométrica y a toda la pantalla: el pasto llega a las cuatro orillas, sin isla ni cielo ("que
 * se extienda a lo largo de toda la pantalla"). Los gráficos, realistas (texturas, luz desde
 * arriba a la izquierda y sombras), están en `praderaEstilos.ts`; elegidos por el entrenador el
 * 2026-11-25, igual que esta cámara.
 */
import { p, type Vista } from "./iso";

export type Lugar = "casa" | "gimnasio";

/** Dónde quedó dibujado cada edificio (en px del canvas, sin el dpr): para saber qué se tocó. */
export interface Zona { lugar: Lugar; x: number; y: number; w: number; h: number; }


/**
 * El acomodo de la escena, igual en todos los estilos isométricos: el cruce del camino a media
 * pantalla y los cuadros de un tamaño que deja ver la casa y el gimnasio completos. La casa
 * llega a ~3 cuadros a la izquierda del centro y el gimnasio a ~3.7 a la derecha.
 */
export function vistaPradera(c: CanvasRenderingContext2D, W: number, H: number): Vista {
  const tw = Math.min(W / 8.3, H / 6.2);
  const v: Vista = { c, tw, th: tw / 2, alto: 0, ox: W / 2 - tw * 0.35, oy: 0 };
  const [, ycentro] = p(v, 5.2, 5.2);
  v.oy = H * 0.5 - ycentro;
  return v;
}

/** El camino: de abajo de la pantalla al cruce, y de ahí a la puerta de la casa y del gimnasio. */
export const TRAMOS: readonly [number, number, number, number][] = [[34, 34, 6.2, 6.2], [6.2, 6.2, 4.1, 6.6], [6.2, 6.2, 6.8, 4.1]];
/** Dónde va cada edificio: [i0, i1, j0, j1, alto]. */
export const CASA = [1.6, 4.0, 5.4, 7.6, 1.7] as const;
export const GIMNASIO = [5.2, 8.6, 1.2, 3.8, 2.1] as const;
/** Los árboles alrededor, también en las orillas (ninguno sobre el camino, que va por i = j). */
export const ARBOLES: readonly [number, number][] = [[1.2, 1.4], [8.6, 0.6], [0.9, 4.2], [9.4, 5.6], [9.6, 7.4], [2.2, 9.4], [4.4, 1.0], [-1.5, 3], [3, -1.6], [11.5, 3.5], [4.2, 11.6], [12.6, 9.4], [-0.5, 7.5], [7, -0.8],
  [6.4, 11.2], [11, 14.2], [-2.5, 10], [13.5, 1.5], [-1, -1.5], [1, -3], [15, 6.5], [7.5, 14.5], [0.5, 12.8], [14.6, 12.4], [-3.2, 5.6], [10.2, -2.5],
  [-2.6, -2.2], [-0.4, -4.6], [-4.8, 0.2], [2.4, -4.4], [4.6, -3.2], [-4.4, 2.6], [-6.2, -2.4], [-2.2, -6.4], [6.8, -4.6], [-6.8, 3.4], [0.6, -7.2], [-7.4, 0.8]];


export function zonaDe(v: Vista, lugar: Lugar, i0: number, i1: number, j0: number, j1: number, h: number): Zona {
  const pts = [p(v, i0, j0, h), p(v, i1, j0, 0), p(v, i1, j1, 0), p(v, i0, j1, 0), p(v, i1, j1, h), p(v, i0, j1, h), p(v, i1, j0, h)];
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { lugar, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function letreroFlotante(v: Vista, i: number, j: number, z: number, texto: string, color: string): void {
  const c = v.c;
  const [x, y] = p(v, i, j, z);
  c.font = `800 ${Math.max(4, Math.round((v.tw / 2) * 0.75))}px system-ui, sans-serif`;
  const w = c.measureText(texto).width + (v.tw / 2) * 1.1, h = (v.tw / 2) * 1.25;
  c.fillStyle = "rgba(20, 16, 30, 0.82)";
  c.beginPath(); c.roundRect(x - w / 2, y - h, w, h, h / 2); c.fill();
  c.strokeStyle = color; c.lineWidth = Math.max(1, (v.tw / 2) * 0.12); c.stroke();
  c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(texto, x, y - h / 2 + 0.5);
  const pico = (v.tw / 2) * 0.35;
  c.fillStyle = "rgba(20, 16, 30, 0.82)"; c.beginPath(); c.moveTo(x - pico, y); c.lineTo(x + pico, y); c.lineTo(x, y + pico * 1.2); c.fill();
}
