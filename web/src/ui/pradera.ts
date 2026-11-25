/**
 * La pantalla principal de Mi espacio (entrenador, 2026-11-25): una pradera con un camino que
 * lleva a la casa y al gimnasio de cada quien; tocar uno entra a él. Más adelante, lo que se
 * compre en la tienda para afuera (árboles, bancas, una fuente…) va aquí.
 *
 * Isométrica de día (propuesta A) y a toda la pantalla: el pasto llega a las cuatro orillas, sin
 * isla ni cielo ("que se extienda a lo largo de toda la pantalla").
 */
import { ruido } from "./gimnasioFondo";
import { caja, p, poligono, type Vista } from "./iso";
import { praderaLowPoly, praderaPerspectiva, praderaRealista } from "./praderaEstilos";

export type Lugar = "casa" | "gimnasio";

/** Dónde quedó dibujado cada edificio (en px del canvas, sin el dpr): para saber qué se tocó. */
export interface Zona { lugar: Lugar; x: number; y: number; w: number; h: number; }


/** TEMPORAL: propuestas de gráficos de la pradera (`osfit:pradera-estilo`). */
export type EstiloPradera = "caricatura" | "realista" | "lowpoly" | "perspectiva";
export function estiloPradera(): EstiloPradera {
  try {
    const v = globalThis.localStorage?.getItem("osfit:pradera-estilo");
    return v === "realista" || v === "lowpoly" || v === "perspectiva" ? v : "caricatura";
  } catch { return "caricatura"; }
}

/**
 * El acomodo de la escena, igual en todos los estilos isométricos: el cruce del camino a media
 * pantalla y los cuadros de un tamaño que deja ver la casa y el gimnasio completos. La casa
 * llega a ~3 cuadros a la izquierda del centro y el gimnasio a ~3.7 a la derecha.
 */
/** TEMPORAL: propuestas de cámara de la pradera (`osfit:pradera-camara`). */
export type CamaraPradera = "iso" | "baja" | "alta" | "cerca";
export function camaraPradera(): CamaraPradera {
  try { const v = globalThis.localStorage?.getItem("osfit:pradera-camara"); return v === "baja" || v === "alta" || v === "cerca" ? v : "iso"; } catch { return "iso"; }
}
/**
 * Cada cámara: qué tan aplastado se ve el piso (`piso`: alto de un cuadro entre su ancho; 0.5 es
 * la isométrica), qué tan altas se ven las cosas (`alto`) y el acercamiento.
 */
const CAMARAS: Record<CamaraPradera, { piso: number; alto: number; zoom: number }> = {
  iso: { piso: 0.5, alto: 0.5, zoom: 1 },
  baja: { piso: 0.34, alto: 0.62, zoom: 1.12 },
  alta: { piso: 0.72, alto: 0.36, zoom: 0.92 },
  cerca: { piso: 0.5, alto: 0.5, zoom: 1.5 },
};

export function vistaPradera(c: CanvasRenderingContext2D, W: number, H: number): Vista {
  const cam = CAMARAS[camaraPradera()];
  const tw = Math.min(W / 8.3, H / 6.2) * cam.zoom;
  const v: Vista = { c, tw, th: tw * cam.piso, zEsc: tw * cam.alto, alto: 0, ox: W / 2 - tw * 0.35, oy: 0 };
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

export function pintarPradera(c: CanvasRenderingContext2D, W: number, H: number): Zona[] {
  const estilo = estiloPradera();
  if (estilo === "realista") return praderaRealista(c, W, H);
  if (estilo === "lowpoly") return praderaLowPoly(c, W, H);
  if (estilo === "perspectiva") return praderaPerspectiva(c, W, H);
  const v = vistaPradera(c, W, H);
  const th = v.th, tw = v.tw;

  const pasto = c.createLinearGradient(0, 0, 0, H);
  pasto.addColorStop(0, "#7fd35e"); pasto.addColorStop(1, "#45a84b");
  c.fillStyle = pasto; c.fillRect(0, 0, W, H);
  // Manchas de otro verde y florecitas por toda la pantalla.
  for (let k = 0; k < 140; k++) {
    const x = ruido(k * 3.7) * W, y = ruido(k * 5.3) * H;
    c.fillStyle = k % 3 ? "rgba(40, 120, 40, 0.16)" : "rgba(200, 255, 160, 0.2)";
    c.beginPath(); c.ellipse(x, y, th * 0.7, th * 0.32, 0, 0, Math.PI * 2); c.fill();
  }
  for (let k = 0; k < 90; k++) {
    c.fillStyle = ["#ffffff", "#ffd45c", "#ff9ee5", "#c9b6ff"][k % 4]!;
    c.beginPath(); c.arc(ruido(k * 7.1) * W, ruido(k * 2.9) * H, Math.max(1.2, th * 0.09), 0, Math.PI * 2); c.fill();
  }

  // El camino: entra por abajo de la pantalla y se parte en dos, a la casa y al gimnasio. Una
  // franja de tierra clara con piedritas, con su orilla un poco más oscura.
  const tramos = TRAMOS;
  const franja = (ancho: number, color: string) => {
    for (const [i0, j0, i1, j1] of tramos) {
      const largo = Math.hypot(i1 - i0, j1 - j0), ni = -(j1 - j0) / largo * ancho / 2, nj = (i1 - i0) / largo * ancho / 2;
      poligono(v, [p(v, i0 + ni, j0 + nj), p(v, i1 + ni, j1 + nj), p(v, i1 - ni, j1 - nj), p(v, i0 - ni, j0 - nj)], color);
      const [cx, cy] = p(v, i1, j1);
      c.fillStyle = color; c.beginPath(); c.ellipse(cx, cy, (ancho * tw) / 2 * 0.72, (ancho * th) / 2 * 0.72, 0, 0, Math.PI * 2); c.fill();
    }
  };
  franja(1.15, "#c9b48a");
  franja(0.95, "#e9dcc0");
  for (const [i0, j0, i1, j1] of tramos) {
    const pasos = Math.ceil(Math.hypot(i1 - i0, j1 - j0) / 0.55);
    for (let k = 0; k < pasos; k++) {
      const f = (k + 0.5) / pasos, lado = (ruido(k * 1.9 + i1) - 0.5) * 0.55;
      const largo = Math.hypot(i1 - i0, j1 - j0);
      const i = i0 + (i1 - i0) * f - ((j1 - j0) / largo) * lado, j = j0 + (j1 - j0) * f + ((i1 - i0) / largo) * lado;
      const [x, y] = p(v, i, j);
      c.fillStyle = "rgba(140, 120, 90, 0.45)";
      c.beginPath(); c.ellipse(x, y, th * 0.16, th * 0.08, 0, 0, Math.PI * 2); c.fill();
    }
  }

  // Lo que está encima, de atrás hacia adelante (por i + j).
  const arboles = ARBOLES;
  const cosas: { orden: number; pinta: () => Zona | void }[] = [
    { orden: 2.5 + 6.3, pinta: () => gimnasio(v) },
    { orden: 1.6 + 7.4, pinta: () => casa(v) },
    ...arboles.map(([i, j]) => ({ orden: i! + j!, pinta: () => arbol(v, i!, j!) })),
  ];
  const zonas: Zona[] = [];
  for (const cosa of cosas.sort((a, b) => a.orden - b.orden)) { const z = cosa.pinta(); if (z) zonas.push(z); }
  return zonas;
}

function arbol(v: Vista, i: number, j: number): void {
  const c = v.c;
  caja(v, i - 0.12, j - 0.12, 0.24, 0.24, 0.9, ["#8a5a32", "#6e4527", "#5a3820"]);
  const [x, y] = p(v, i, j, 1.5);
  const r = v.th * 1.05;
  for (const [dx, dy, rr, col] of [[0, 0.15, 1, "#3c9a47"], [-0.45, 0.25, 0.7, "#4caf50"], [0.45, 0.2, 0.75, "#4caf50"], [0, -0.35, 0.75, "#6cc56a"]] as const) {
    c.fillStyle = col; c.beginPath(); c.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); c.fill();
  }
}

/** Un techo de dos aguas sobre la caja (i0..i1, j0..j1) a la altura h, con la cumbrera en i. */
export function techo(v: Vista, i0: number, i1: number, j0: number, j1: number, h: number, alto: number, colores: [string, string, string]): void {
  const jm = (j0 + j1) / 2;
  const [frente, atras, lado] = colores;
  poligono(v, [p(v, i0 - 0.15, j0 - 0.15, h), p(v, i1 + 0.15, j0 - 0.15, h), p(v, i1 + 0.15, jm, h + alto), p(v, i0 - 0.15, jm, h + alto)], atras);
  poligono(v, [p(v, i1, j0, h), p(v, i1, j1, h), p(v, i1, jm, h + alto)], lado);
  poligono(v, [p(v, i0 - 0.15, j1 + 0.15, h), p(v, i1 + 0.15, j1 + 0.15, h), p(v, i1 + 0.15, jm, h + alto), p(v, i0 - 0.15, jm, h + alto)], frente);
}

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

function casa(v: Vista): Zona {
  const i0 = 1.6, i1 = 4.0, j0 = 5.4, j1 = 7.6, h = 1.7;
  caja(v, i0, j0, i1 - i0, j1 - j0, h, ["#fff6e6", "#f5e6cc", "#e8d3b0"]);
  // Puerta y ventanas en la cara que mira al camino (i = i1).
  const cara = (j: number, w: number, z0: number, z1: number, col: string) =>
    poligono(v, [p(v, i1, j, z0), p(v, i1, j + w, z0), p(v, i1, j + w, z1), p(v, i1, j, z1)], col);
  cara(6.2, 0.6, 0, 1.0, "#8a5a32");
  cara(5.65, 0.4, 0.7, 1.15, "#8fd3ff");
  cara(7.0, 0.4, 0.7, 1.15, "#8fd3ff");
  // Ventana en el frente (j = j1).
  poligono(v, [p(v, 2.2, j1, 0.7), p(v, 3.2, j1, 0.7), p(v, 3.2, j1, 1.2), p(v, 2.2, j1, 1.2)], "#8fd3ff");
  techo(v, i0, i1, j0, j1, h, 1.2, ["#d9534a", "#a8352d", "#c0453c"]);
  letreroFlotante(v, (i0 + i1) / 2, (j0 + j1) / 2, h + 2.3, "🏠 Casa", "#ffd45c");
  return zonaDe(v, "casa", i0, i1, j0, j1, h + 2.4);
}

function gimnasio(v: Vista): Zona {
  const i0 = 5.2, i1 = 8.6, j0 = 1.2, j1 = 3.8, h = 2.1;
  caja(v, i0, j0, i1 - i0, j1 - j0, h, ["#3d4252", "#545b70", "#40465a"]);
  // Vidrio al frente (j = j1) y la puerta que da al camino.
  poligono(v, [p(v, i0 + 0.2, j1, 0.15), p(v, i1 - 0.2, j1, 0.15), p(v, i1 - 0.2, j1, 1.45), p(v, i0 + 0.2, j1, 1.45)], "rgba(143, 211, 255, 0.9)");
  poligono(v, [p(v, 6.4, j1, 0), p(v, 7.1, j1, 0), p(v, 7.1, j1, 1.2), p(v, 6.4, j1, 1.2)], "#2a2d36");
  // Mancuerna pintada en la pared de la derecha (i = i1).
  const [mx, my] = p(v, i1, 2.5, 1.1);
  v.c.fillStyle = "#ffd45c"; v.c.fillRect(mx - v.th * 0.5, my - v.th * 0.06, v.th, v.th * 0.12);
  for (const dx of [-0.55, 0.45]) v.c.fillRect(mx + dx * v.th, my - v.th * 0.25, v.th * 0.12, v.th * 0.5);
  // Techo plano con su orilla y el letrero.
  caja(v, i0 - 0.1, j0 - 0.1, i1 - i0 + 0.2, j1 - j0 + 0.2, 0.18, ["#2a2d36", "#22242c", "#1c1e25"], h);
  const [x0, y0] = p(v, i0 + 0.4, j1, h + 0.75), [x1, y1] = p(v, i1 - 0.4, j1, h + 0.75);
  const c = v.c;
  c.save(); c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0));
  const largo = Math.hypot(x1 - x0, y1 - y0);
  c.fillStyle = "#14151a"; c.fillRect(0, -v.th * 0.5, largo, v.th * 0.95);
  c.font = `900 ${Math.round(v.th * 0.7)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = "#ff3bd4"; c.shadowColor = "#ff3bd4"; c.shadowBlur = 8; c.fillText("OSFIT GYM", largo / 2, 0);
  c.restore();
  letreroFlotante(v, (i0 + i1) / 2, (j0 + j1) / 2, h + 2.4, "🏋️ Gimnasio", "#ff3bd4");
  return zonaDe(v, "gimnasio", i0, i1, j0, j1, h + 2.5);
}
