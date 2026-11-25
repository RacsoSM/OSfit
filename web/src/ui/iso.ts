/**
 * Lo isométrico de Mi espacio (`ui/espacio.ts`, `ui/pradera.ts`): del piso a la pantalla, y las
 * figuras básicas (polígonos y cajas). i va a la derecha-abajo, j a la izquierda-abajo, z arriba.
 */
export interface Vista {
  c: CanvasRenderingContext2D; ox: number; oy: number; tw: number; th: number; alto: number;
  /** Cuántos px mide una unidad de alto; sin él, lo mismo que `th` (la isométrica de siempre). */
  zEsc?: number;
}

/** Del piso (i a la derecha-abajo, j a la izquierda-abajo, z hacia arriba) a la pantalla. */
export function p(v: Vista, i: number, j: number, z = 0): [number, number] {
  return [v.ox + (i - j) * (v.tw / 2), v.oy + (i + j) * (v.th / 2) - z * (v.zEsc ?? v.th)];
}

export function poligono(v: Vista, puntos: [number, number][], relleno: string | CanvasGradient, borde?: string): void {
  const c = v.c;
  c.beginPath();
  puntos.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = relleno; c.fill();
  if (borde) { c.strokeStyle = borde; c.lineWidth = 1; c.stroke(); }
}

/** Una caja en el piso: de (i, j) con ancho `w` (en i), fondo `d` (en j), alto `h`, a altura `z`. */
export function caja(v: Vista, i: number, j: number, w: number, d: number, h: number, colores: [string, string, string], z = 0): void {
  const [tapa, izq, der] = colores;
  // Cara izquierda (mira hacia j+), derecha (hacia i+) y la tapa.
  poligono(v, [p(v, i, j + d, z), p(v, i + w, j + d, z), p(v, i + w, j + d, z + h), p(v, i, j + d, z + h)], izq);
  poligono(v, [p(v, i + w, j, z), p(v, i + w, j + d, z), p(v, i + w, j + d, z + h), p(v, i + w, j, z + h)], der);
  poligono(v, [p(v, i, j, z + h), p(v, i + w, j, z + h), p(v, i + w, j + d, z + h), p(v, i, j + d, z + h)], tapa);
}

