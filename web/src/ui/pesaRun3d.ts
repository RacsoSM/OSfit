/**
 * La perspectiva de Correle pa: el mundo en metros (x a los lados, y hacia arriba, z hacia el
 * fondo) visto desde una cámara alta detrás de la mancuerna, inclinada hacia abajo
 * (entrenador, 2026-11-27: "que no se vea tan al fondo los siguientes obstáculos"). Aquí solo la geometría y las figuras
 * básicas (cajas, discos); el escenario está en `pesaRunEscena.ts` y la mancuerna en
 * `pesaRunMancuerna.ts`.
 */

/** Metros de ancho de cada carril. Los carriles ocupan de -ORILLA a ORILLA; de ahí a la pared, el piso de madera con sus cosas. */
export const CARRIL = 1.5;
export const ORILLA = 2.25;
export const PARED = 3.7;
/** La altura de las paredes: no hay techo, arriba se ve el cielo. */
export const TECHO = 3.6;
/** La cámara: qué tan alto va sobre lo que pisa la mancuerna, qué tan atrás y cuánto mira hacia abajo. */
export const CAM_ALTO = 4.4;
export const CAM_ATRAS = 7.2;
export const INCLINACION = 0.3;

export interface Vista {
  W: number; H: number;
  /** Píxeles por metro a un metro de distancia. */
  F: number;
  /** Dónde cae en pantalla el centro de la vista, y el horizonte (el punto de fuga). */
  cy: number;
  hz: number;
  camX: number; camY: number; camZ: number;
  /** Coseno y seno de la inclinación hacia abajo. */
  cos: number; sin: number;
  /** Hasta dónde se ve. */
  lejos: number;
}

export interface Punto { x: number; y: number; s: number }

export function proyectar(v: Vista, x: number, y: number, z: number): Punto {
  const dy = y - v.camY, dz = z - v.camZ;
  const prof = Math.max(0.25, dz * v.cos - dy * v.sin);
  const arriba = dy * v.cos + dz * v.sin;
  const s = v.F / prof;
  return { x: v.W / 2 + (x - v.camX) * s, y: v.cy - arriba * s, s };
}

export function crearVista(W: number, H: number, camX: number, camY: number, camZ: number, lejos: number): Vista {
  // Como teleobjetivo: la cámara lejos y la vista cerrada, así lo que viene adelante se ve
  // grande (entrenador, 2026-11-27) y los tres carriles caben a lo ancho donde va la mancuerna.
  const F = Math.min(W * 1.55, H * 0.95);
  const cos = Math.cos(INCLINACION), sin = Math.sin(INCLINACION);
  const cy = H * 0.44;
  return { W, H, F, cy, hz: cy - F * Math.tan(INCLINACION), camX, camY, camZ, cos, sin, lejos };
}

export function poligono(c: CanvasRenderingContext2D, pts: readonly { x: number; y: number }[], color: string | CanvasGradient): void {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(pts[0]!.x, pts[0]!.y);
  for (let k = 1; k < pts.length; k++) c.lineTo(pts[k]!.x, pts[k]!.y);
  c.closePath();
  c.fill();
}

/** Agrega al trazo actual (sin pintar) un rectángulo del piso: para pintar muchos de un color de una sola vez. */
export function trazoPiso(c: CanvasRenderingContext2D, v: Vista, x0: number, x1: number, y: number, z0: number, z1: number): void {
  const a = proyectar(v, x0, y, z0), b = proyectar(v, x1, y, z0), d = proyectar(v, x1, y, z1), e = proyectar(v, x0, y, z1);
  c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath();
}

/** Un rectángulo en un plano: el piso o el techo (y fija), una pared (x fija) o un frente (z fija). */
export function quadPiso(c: CanvasRenderingContext2D, v: Vista, x0: number, x1: number, y: number, z0: number, z1: number, color: string | CanvasGradient): void {
  const P = (x: number, z: number) => proyectar(v, x, y, z);
  poligono(c, [P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1)], color);
}
export function quadPared(c: CanvasRenderingContext2D, v: Vista, x: number, y0: number, y1: number, z0: number, z1: number, color: string | CanvasGradient): void {
  const P = (y: number, z: number) => proyectar(v, x, y, z);
  poligono(c, [P(y0, z0), P(y0, z1), P(y1, z1), P(y1, z0)], color);
}
export function quadFrente(c: CanvasRenderingContext2D, v: Vista, x0: number, x1: number, y0: number, y1: number, z: number, color: string | CanvasGradient): void {
  const P = (x: number, y: number) => proyectar(v, x, y, z);
  poligono(c, [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], color);
}

/** Una caja en el mundo: pinta sus caras visibles (lado, tapa o fondo, frente). */
export function caja3d(c: CanvasRenderingContext2D, v: Vista, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, frente: string, tapa: string, lado: string): void {
  z0 = Math.max(z0, v.camZ + 0.4);
  if (z1 <= z0) return;
  if (x0 > v.camX) quadPared(c, v, x0, y0, y1, z0, z1, lado);
  if (x1 < v.camX) quadPared(c, v, x1, y0, y1, z0, z1, lado);
  if (y1 < v.camY) quadPiso(c, v, x0, x1, y1, z0, z1, tapa);
  else if (y0 > v.camY) quadPiso(c, v, x0, x1, y0, z0, z1, tapa);
  quadFrente(c, v, x0, x1, y0, y1, z0, frente);
}

const SEGMENTOS = 14;
const COS = Array.from({ length: SEGMENTOS }, (_, k) => Math.cos((k / SEGMENTOS) * Math.PI * 2));
const SIN = Array.from({ length: SEGMENTOS }, (_, k) => Math.sin((k / SEGMENTOS) * Math.PI * 2));

/** Un círculo en un plano x fija (un disco de barra, de canto hacia los lados). */
function circuloX(c: CanvasRenderingContext2D, v: Vista, x: number, y: number, z: number, r: number, color: string): void {
  const pts: Punto[] = [];
  for (let k = 0; k < SEGMENTOS; k++) pts.push(proyectar(v, x, y + SIN[k]! * r, z + COS[k]! * r));
  poligono(c, pts, color);
}

/**
 * Un disco de pesas en una barra a lo ancho: su cara está en un plano x fija. Se pinta la cara
 * de atrás (oscura) y la de adelante, así se ve su grosor; con un aro y el centro de metal.
 */
export function disco3d(c: CanvasRenderingContext2D, v: Vista, x: number, y: number, z: number, r: number, grosor: number, color: string, oscuro: string): void {
  // La cara que se ve es la que mira hacia la cámara.
  const hacia = x > v.camX ? -1 : 1;
  circuloX(c, v, x - hacia * grosor / 2, y, z, r, oscuro);
  circuloX(c, v, x + hacia * grosor / 2, y, z, r, color);
  circuloX(c, v, x + hacia * grosor / 2 + hacia * 0.001, y, z, r * 0.72, oscuro);
  circuloX(c, v, x + hacia * grosor / 2 + hacia * 0.002, y, z, r * 0.62, color);
  circuloX(c, v, x + hacia * grosor / 2 + hacia * 0.003, y, z, r * 0.16, "#c9ced6");
}

/** Una pelota o algo redondo visto de frente (se pinta como círculo a esa distancia). */
export function bola(c: CanvasRenderingContext2D, v: Vista, x: number, y: number, z: number, r: number, color: string, brillo = "rgba(255, 255, 255, 0.25)"): void {
  const p = proyectar(v, x, y, z);
  c.fillStyle = color; c.beginPath(); c.arc(p.x, p.y, r * p.s, 0, Math.PI * 2); c.fill();
  c.fillStyle = brillo; c.beginPath(); c.arc(p.x - r * p.s * 0.3, p.y - r * p.s * 0.35, r * p.s * 0.35, 0, Math.PI * 2); c.fill();
}

export function mezclar(a: string, b: string, f: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const m = (s: number) => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f);
  return `rgb(${m(16)}, ${m(8)}, ${m(0)})`;
}

/** Qué tan visible es algo a esa distancia: aparece suave al fondo. */
export function niebla(v: Vista, z: number): number {
  return Math.max(0, Math.min(1, (v.lejos - z) / 22));
}

/** Un número fijo entre 0 y 1 para cada semilla (decoración que no cambia entre cuadros). */
export const azarFijo = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
