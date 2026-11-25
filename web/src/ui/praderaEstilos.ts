/**
 * Los gráficos de la pradera de Mi espacio (entrenador, 2026-11-25: "un poco más realista"; eligió
 * esta propuesta): isométrica con texturas, luz desde arriba a la izquierda y sombras. El acomodo
 * (camino, casa, gimnasio y árboles) está en `pradera.ts`.
 */
import { ruido } from "./gimnasioFondo";
import { p, poligono, type Vista } from "./iso";
import { ARBOLES, CASA, GIMNASIO, TRAMOS, letreroFlotante, vistaPradera, zonaDe, type Zona } from "./pradera";

type Punto = [number, number];

function sombra(v: Vista, i0: number, j0: number, w: number, d: number, h: number, alfa = 0.22): void {
  // La luz viene de arriba a la izquierda: la sombra se estira hacia +i (abajo a la derecha).
  const s = h * 0.9;
  poligono(v, [p(v, i0, j0), p(v, i0 + w + s, j0), p(v, i0 + w + s, j0 + d), p(v, i0, j0 + d)], `rgba(20, 40, 15, ${alfa})`);
}

function degradado(c: CanvasRenderingContext2D, a: Punto, b: Punto, colores: string[]): CanvasGradient {
  const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
  colores.forEach((col, k) => g.addColorStop(k / (colores.length - 1), col));
  return g;
}

/** Una cara de pared: de (i0, j0) a (i1, j1) en el piso, de z0 a z1. */
function cara(v: Vista, i0: number, j0: number, i1: number, j1: number, z0: number, z1: number, relleno: string | CanvasGradient): void {
  poligono(v, [p(v, i0, j0, z0), p(v, i1, j1, z0), p(v, i1, j1, z1), p(v, i0, j0, z1)], relleno);
}

/** Líneas a lo largo de una cara (siding, tablones, tejas): de z0 a z1 cada `paso`. */
function lineasCara(v: Vista, i0: number, j0: number, i1: number, j1: number, z0: number, z1: number, paso: number, color: string): void {
  const c = v.c;
  c.strokeStyle = color; c.lineWidth = 1;
  for (let z = z0 + paso; z < z1 - 0.01; z += paso) { c.beginPath(); c.moveTo(...p(v, i0, j0, z)); c.lineTo(...p(v, i1, j1, z)); c.stroke(); }
}

/** Una ventana sobre una cara: marco blanco, vidrio con el cielo reflejado y su cruceta. */
function ventanaReal(v: Vista, i0: number, j0: number, i1: number, j1: number, z0: number, z1: number): void {
  const c = v.c;
  const m = 0.06;
  cara(v, i0, j0, i1, j1, z0, z1, "#f4f1ea");
  const fi = (i1 - i0) * m / Math.max(0.01, Math.hypot(i1 - i0, j1 - j0)), fj = (j1 - j0) * m / Math.max(0.01, Math.hypot(i1 - i0, j1 - j0));
  const a = p(v, i0 + fi, j0 + fj, z1 - m), b = p(v, i0 + fi, j0 + fj, z0 + m);
  cara(v, i0 + fi, j0 + fj, i1 - fi, j1 - fj, z0 + m, z1 - m, degradado(c, a, b, ["#cfe9ff", "#7fb6e0", "#4a7fae"]));
  // Reflejo en diagonal.
  c.save();
  c.globalAlpha = 0.35;
  cara(v, i0 + (i1 - i0) * 0.2, j0 + (j1 - j0) * 0.2, i0 + (i1 - i0) * 0.4, j0 + (j1 - j0) * 0.4, z0 + m, z1 - m, "#ffffff");
  c.restore();
  c.strokeStyle = "#f4f1ea"; c.lineWidth = Math.max(1, (v.tw / 2) * 0.06);
  const mi = (i0 + i1) / 2, mj = (j0 + j1) / 2, mz = (z0 + z1) / 2;
  c.beginPath(); c.moveTo(...p(v, mi, mj, z0)); c.lineTo(...p(v, mi, mj, z1)); c.moveTo(...p(v, i0, j0, mz)); c.lineTo(...p(v, i1, j1, mz)); c.stroke();
}

// ── Árboles ──────────────────────────────────────────────────────────────

/** Una copa hecha de racimos de hojas, cada uno con luz arriba a la izquierda. En px. */
function copaReal(c: CanvasRenderingContext2D, x: number, y: number, r: number, semilla: number, tono = 0): void {
  const racimos: [number, number, number][] = [[0, 0.25, 1], [-0.55, 0.3, 0.7], [0.55, 0.28, 0.72], [-0.3, -0.25, 0.75], [0.32, -0.22, 0.72], [0, -0.55, 0.62]];
  const base = [[46 + tono, 112, 46], [62 + tono, 140, 58], [118 + tono, 186, 92]];
  for (const [dx, dy, rr] of racimos) {
    const cx = x + dx * r + (ruido(semilla + dx * 7) - 0.5) * r * 0.15, cy = y + dy * r, rad = rr * r;
    const g = c.createRadialGradient(cx - rad * 0.4, cy - rad * 0.45, rad * 0.1, cx, cy, rad);
    g.addColorStop(0, `rgb(${base[2]!.join(",")})`); g.addColorStop(0.55, `rgb(${base[1]!.join(",")})`); g.addColorStop(1, `rgb(${base[0]!.join(",")})`);
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fill();
  }
  // Hojitas sueltas con luz.
  c.fillStyle = "rgba(190, 230, 140, 0.55)";
  for (let k = 0; k < 14; k++) {
    const a = ruido(semilla + k * 1.7) * Math.PI * 2, d = ruido(semilla + k * 3.1) * r * 0.85;
    c.beginPath(); c.arc(x + Math.cos(a) * d - r * 0.15, y + Math.sin(a) * d * 0.8 - r * 0.2, r * 0.07, 0, Math.PI * 2); c.fill();
  }
}

function arbolReal(v: Vista, i: number, j: number): void {
  const c = v.c;
  const [bx, by] = p(v, i, j);
  const r = (v.tw / 2) * 1.15, alto = (v.zEsc ?? v.th) * 1.6;
  // Sombra en el pasto, hacia abajo a la derecha.
  c.fillStyle = "rgba(20, 40, 15, 0.22)"; c.beginPath(); c.ellipse(bx + r * 0.7, by + r * 0.15, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); c.fill();
  // Tronco que se afina.
  c.fillStyle = degradado(c, [bx - r * 0.15, 0], [bx + r * 0.15, 0], ["#8b5e3c", "#6b4428", "#4a2e1a"]);
  c.beginPath(); c.moveTo(bx - r * 0.16, by); c.lineTo(bx + r * 0.16, by); c.lineTo(bx + r * 0.08, by - alto); c.lineTo(bx - r * 0.08, by - alto); c.fill();
  copaReal(c, bx, by - alto - r * 0.5, r, i * 13 + j * 7);
}

// ── Edificios realistas ──────────────────────────────────────────────────

function casaReal(v: Vista): Zona {
  const c = v.c;
  const [i0, i1, j0, j1, h] = CASA;
  sombra(v, i0, j0, i1 - i0, j1 - j0, h + 1, 0.25);
  // Paredes: la del frente (j = j1) más clara, la que da al camino (i = i1) en sombra media.
  cara(v, i0, j1, i1, j1, 0, h, degradado(c, p(v, i0, j1, h), p(v, i0, j1, 0), ["#fbf3e4", "#eadcc2"]));
  cara(v, i1, j0, i1, j1, 0, h, degradado(c, p(v, i1, j0, h), p(v, i1, j0, 0), ["#e9dcc4", "#d3c1a2"]));
  lineasCara(v, i0, j1, i1, j1, 0, h, 0.17, "rgba(150, 120, 80, 0.18)");
  lineasCara(v, i1, j0, i1, j1, 0, h, 0.17, "rgba(120, 95, 60, 0.2)");
  // Zócalo de piedra.
  cara(v, i0, j1, i1, j1, 0, 0.18, "#b9ad9a"); cara(v, i1, j0, i1, j1, 0, 0.18, "#a39784");
  // Puerta de madera con su escalón y ventanas.
  cara(v, i1, 6.2, i1, 6.8, 0, 1.05, degradado(c, p(v, i1, 6.2, 1.05), p(v, i1, 6.2, 0), ["#9a6a40", "#6e4527"]));
  const [px, py] = p(v, i1, 6.7, 0.5); c.fillStyle = "#e6c25a"; c.beginPath(); c.arc(px, py, Math.max(1, (v.tw / 2) * 0.06), 0, Math.PI * 2); c.fill();
  poligono(v, [p(v, i1, 6.1), p(v, i1 + 0.3, 6.1), p(v, i1 + 0.3, 6.9), p(v, i1, 6.9)], "#c9bfae");
  ventanaReal(v, i1, 5.6, i1, 6.0, 0.6, 1.25);
  ventanaReal(v, i1, 7.0, i1, 7.4, 0.6, 1.25);
  ventanaReal(v, 2.1, j1, 3.4, j1, 0.6, 1.25);
  // Arbustos al pie del frente.
  for (let k = 0; k < 5; k++) {
    const [x, y] = p(v, i0 + 0.3 + k * 0.48, j1 + 0.18, 0.1);
    copaReal(c, x, y, (v.tw / 2) * 0.32, 40 + k, -10);
  }
  // Chimenea y techo de tejas.
  const jm = (j0 + j1) / 2;
  const ladrillo: [string, string, string] = ["#a8553f", "#8f4434", "#7a392c"];
  poligono(v, [p(v, i0 - 0.15, j0 - 0.15, h), p(v, i1 + 0.15, j0 - 0.15, h), p(v, i1 + 0.15, jm, h + 1.2), p(v, i0 - 0.15, jm, h + 1.2)], "#7a3b30");
  cara(v, 2.3, 6.0, 2.7, 6.0, h + 0.6, h + 1.7, ladrillo[1]); cara(v, 2.7, 5.6, 2.7, 6.0, h + 0.6, h + 1.7, ladrillo[2]);
  poligono(v, [p(v, 2.3, 5.6, h + 1.7), p(v, 2.7, 5.6, h + 1.7), p(v, 2.7, 6.0, h + 1.7), p(v, 2.3, 6.0, h + 1.7)], "#5a2a22");
  poligono(v, [p(v, i1, j0, h), p(v, i1, j1, h), p(v, i1, jm, h + 1.2)], degradado(c, p(v, i1, jm, h + 1.2), p(v, i1, j0, h), ["#f1e6d0", "#d9c8aa"]));
  const frente: Punto[] = [p(v, i0 - 0.15, j1 + 0.15, h), p(v, i1 + 0.15, j1 + 0.15, h), p(v, i1 + 0.15, jm, h + 1.2), p(v, i0 - 0.15, jm, h + 1.2)];
  poligono(v, frente, degradado(c, frente[3]!, frente[0]!, ["#b65a45", "#8e3f30"]));
  // Hileras de tejas: líneas paralelas a la cumbrera.
  c.strokeStyle = "rgba(60, 20, 15, 0.35)"; c.lineWidth = 1;
  for (let f = 0.12; f < 1; f += 0.12) {
    const jj = jm + (j1 + 0.15 - jm) * f, zz = h + 1.2 - 1.2 * f;
    c.beginPath(); c.moveTo(...p(v, i0 - 0.15, jj, zz)); c.lineTo(...p(v, i1 + 0.15, jj, zz)); c.stroke();
  }
  c.strokeStyle = "#5e2a20"; c.lineWidth = Math.max(1.5, (v.tw / 2) * 0.08);
  c.beginPath(); c.moveTo(...p(v, i0 - 0.15, jm, h + 1.2)); c.lineTo(...p(v, i1 + 0.15, jm, h + 1.2)); c.stroke();
  letreroFlotante(v, (i0 + i1) / 2, (j0 + j1) / 2, h + 2.5, "🏠 Casa", "#ffd45c");
  return zonaDe(v, "casa", i0, i1, j0, j1, h + 2.6);
}

function gimnasioReal(v: Vista): Zona {
  const c = v.c;
  const [i0, i1, j0, j1, h] = GIMNASIO;
  sombra(v, i0, j0, i1 - i0, j1 - j0, h, 0.28);
  // Concreto con juntas verticales.
  cara(v, i0, j1, i1, j1, 0, h, degradado(c, p(v, i0, j1, h), p(v, i0, j1, 0), ["#7d8594", "#5f6675"]));
  cara(v, i1, j0, i1, j1, 0, h, degradado(c, p(v, i1, j0, h), p(v, i1, j0, 0), ["#5f6675", "#4a505d"]));
  c.strokeStyle = "rgba(30, 34, 42, 0.35)"; c.lineWidth = 1;
  for (let k = j0 + 0.65; k < j1; k += 0.65) { c.beginPath(); c.moveTo(...p(v, i1, k, 0)); c.lineTo(...p(v, i1, k, h)); c.stroke(); }
  // Fachada de vidrio con su perfilería y reflejos.
  const a = p(v, i0 + 0.2, j1, 1.5), b = p(v, i0 + 0.2, j1, 0.12);
  cara(v, i0 + 0.2, j1, i1 - 0.2, j1, 0.12, 1.5, degradado(c, a, b, ["#bfe4ff", "#6fa6d6", "#2f5f8f"]));
  c.save(); c.globalAlpha = 0.3;
  for (const [f0, f1] of [[0.1, 0.18], [0.24, 0.27], [0.55, 0.66], [0.72, 0.75]]) cara(v, i0 + 0.2 + (i1 - i0 - 0.4) * f0!, j1, i0 + 0.2 + (i1 - i0 - 0.4) * f1!, j1, 0.12, 1.5, "#ffffff");
  c.restore();
  c.strokeStyle = "#2b2f38"; c.lineWidth = Math.max(1, (v.tw / 2) * 0.06);
  for (let k = 0; k <= 6; k++) { const ii = i0 + 0.2 + ((i1 - i0 - 0.4) * k) / 6; c.beginPath(); c.moveTo(...p(v, ii, j1, 0.12)); c.lineTo(...p(v, ii, j1, 1.5)); c.stroke(); }
  c.beginPath(); c.moveTo(...p(v, i0 + 0.2, j1, 0.8)); c.lineTo(...p(v, i1 - 0.2, j1, 0.8)); c.stroke();
  cara(v, 6.4, j1, 7.1, j1, 0, 1.2, "#1f232b");
  // Pretil y techo con dos unidades de aire.
  poligono(v, [p(v, i0 - 0.1, j0 - 0.1, h + 0.2), p(v, i1 + 0.1, j0 - 0.1, h + 0.2), p(v, i1 + 0.1, j1 + 0.1, h + 0.2), p(v, i0 - 0.1, j1 + 0.1, h + 0.2)], "#8e96a4");
  cara(v, i0 - 0.1, j1 + 0.1, i1 + 0.1, j1 + 0.1, h, h + 0.2, "#4a505d"); cara(v, i1 + 0.1, j0 - 0.1, i1 + 0.1, j1 + 0.1, h, h + 0.2, "#3c414c");
  for (const [ai, aj] of [[5.8, 1.8], [7.3, 2.0]] as const) {
    cara(v, ai, aj + 0.6, ai + 0.7, aj + 0.6, h + 0.2, h + 0.6, "#c9ced6"); cara(v, ai + 0.7, aj, ai + 0.7, aj + 0.6, h + 0.2, h + 0.6, "#a7adb7");
    poligono(v, [p(v, ai, aj, h + 0.6), p(v, ai + 0.7, aj, h + 0.6), p(v, ai + 0.7, aj + 0.6, h + 0.6), p(v, ai, aj + 0.6, h + 0.6)], "#e3e6eb");
  }
  // Letrero iluminado sobre la entrada.
  const [x0, y0] = p(v, i0 + 0.5, j1, h - 0.15), [x1, y1] = p(v, i1 - 0.5, j1, h - 0.15);
  c.save(); c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0));
  const largo = Math.hypot(x1 - x0, y1 - y0);
  c.fillStyle = "#14151a"; c.fillRect(0, -(v.tw / 2) * 0.42, largo, (v.tw / 2) * 0.8);
  c.font = `900 ${Math.round((v.tw / 2) * 0.55)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = "#ffffff"; c.shadowColor = "#ff3bd4"; c.shadowBlur = 6; c.fillText("OSFIT GYM", largo / 2, 0);
  c.restore();
  letreroFlotante(v, (i0 + i1) / 2, (j0 + j1) / 2, h + 2.4, "🏋️ Gimnasio", "#ff3bd4");
  return zonaDe(v, "gimnasio", i0, i1, j0, j1, h + 2.5);
}

// ── Realista ─────────────────────────────────────────────────────────────

let texturaPasto: { patron: CanvasPattern | null; para: CanvasRenderingContext2D } | null = null;
/** Una tela de pasto con briznas y variación de verde, hecha una vez y repetida. */
function patronPasto(c: CanvasRenderingContext2D): CanvasPattern | null {
  if (texturaPasto && texturaPasto.para === c) return texturaPasto.patron;
  const t = document.createElement("canvas");
  t.width = 120; t.height = 120;
  const d = t.getContext("2d");
  if (!d) return null;
  for (let k = 0; k < 900; k++) {
    const x = ruido(k * 1.3) * 120, y = ruido(k * 2.7) * 120, largo = 2 + ruido(k * 3.9) * 5;
    const verde = 90 + Math.round(ruido(k * 5.1) * 80);
    d.strokeStyle = `rgba(${verde - 50}, ${verde + 40}, ${verde - 60}, 0.55)`; d.lineWidth = 1;
    d.beginPath(); d.moveTo(x, y); d.lineTo(x + (ruido(k) - 0.5) * 2, y - largo); d.stroke();
  }
  const patron = c.createPattern(t, "repeat");
  texturaPasto = { patron, para: c };
  return patron;
}

function caminoDePiedra(v: Vista): void {
  const c = v.c;
  for (const [ancho, color] of [[1.25, "#8c7a5a"], [1.05, "#b8a57f"]] as const) {
    for (const [i0, j0, i1, j1] of TRAMOS) {
      const largo = Math.hypot(i1 - i0, j1 - j0), ni = -(j1 - j0) / largo * ancho / 2, nj = (i1 - i0) / largo * ancho / 2;
      poligono(v, [p(v, i0 + ni, j0 + nj), p(v, i1 + ni, j1 + nj), p(v, i1 - ni, j1 - nj), p(v, i0 - ni, j0 - nj)], color);
      const [cx, cy] = p(v, i1, j1); c.fillStyle = color; c.beginPath(); c.ellipse(cx, cy, (ancho * v.tw) / 2 * 0.72, (ancho * v.th) / 2 * 0.72, 0, 0, Math.PI * 2); c.fill();
    }
  }
  // Lajas de piedra irregulares, con su sombra y su brillo.
  for (const [i0, j0, i1, j1] of TRAMOS) {
    const largo = Math.hypot(i1 - i0, j1 - j0);
    const ui = (i1 - i0) / largo, uj = (j1 - j0) / largo;
    for (let k = 0; k < largo / 0.42; k++) {
      for (const lado of [-0.24, 0.24]) {
        const f = k * 0.42 + (lado > 0 ? 0.21 : 0), sem = k * 3.1 + lado * 10 + i1;
        const ci = i0 + ui * f - uj * lado, cj = j0 + uj * f + ui * lado;
        const pts: Punto[] = [];
        for (let q = 0; q < 6; q++) {
          const a = (q / 6) * Math.PI * 2, r = 0.17 + ruido(sem + q) * 0.05;
          pts.push(p(v, ci + Math.cos(a) * r, cj + Math.sin(a) * r));
        }
        const gris = 170 + Math.round(ruido(sem) * 40);
        poligono(v, pts.map(([x, y]) => [x, y + 1.2] as Punto), "rgba(60, 50, 35, 0.35)");
        poligono(v, pts, `rgb(${gris}, ${gris - 8}, ${gris - 22})`);
      }
    }
  }
}

/** Algo parado en la pradera (un árbol, un edificio), con su profundidad y lo que ocupa en pantalla. */
export interface Cosa {
  /** i + j de su base: lo que está más abajo en pantalla tapa a lo de atrás. */
  orden: number;
  /** El rectángulo (px) donde cabe todo su dibujo, sombra y letrero incluidos. */
  caja: { x: number; y: number; w: number; h: number };
  /** La dibuja con `v.c` (quien llama puede cambiar `v.c` para dibujarla en otro lienzo). */
  pinta: () => Zona | void;
}

/** El rectángulo de pantalla que cubren unos puntos del piso, con un margen. */
function cajaDe(v: Vista, puntos: [number, number, number][], margenX: number, margenY: number): Cosa["caja"] {
  const pts = puntos.map(([i, j, z]) => p(v, i, j, z));
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x = Math.min(...xs) - margenX, y = Math.min(...ys) - margenY;
  return { x, y, w: Math.max(...xs) + margenX - x, h: Math.max(...ys) + margenY - y };
}

/**
 * La pradera separada en capas: el suelo (pasto, flores y camino), las cosas paradas en ella
 * (cada una por su lado, con su profundidad) y la viñeta de encima. Así el personaje puede ir
 * entre ellas: lo que está delante de él lo tapa (entrenador, 2026-11-25: "que si pasa debajo
 * de un árbol, que el árbol la tape").
 */
export function escenaRealista(c: CanvasRenderingContext2D, W: number, H: number): { v: Vista; suelo: () => void; cosas: Cosa[]; encima: () => void } {
  const v = vistaPradera(c, W, H);
  const suelo = () => {
    const c = v.c;
    c.fillStyle = degradado(c, [0, 0], [0, H], ["#76b84f", "#4f9a3c"]); c.fillRect(0, 0, W, H);
    // Manchas grandes de luz y sombra, como nubes pasando.
    for (let k = 0; k < 14; k++) {
      const x = ruido(k * 4.3) * W, y = ruido(k * 6.1) * H, r = W * (0.15 + ruido(k * 2.2) * 0.2);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, k % 2 ? "rgba(180, 230, 120, 0.22)" : "rgba(30, 80, 25, 0.18)"); g.addColorStop(1, "rgba(0, 0, 0, 0)");
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const pat = patronPasto(c);
    if (pat) { c.fillStyle = pat; c.fillRect(0, 0, W, H); }
    // Florecitas silvestres en grupitos.
    for (let k = 0; k < 30; k++) {
      const x = ruido(k * 7.7) * W, y = ruido(k * 3.3) * H;
      for (let q = 0; q < 5; q++) {
        c.fillStyle = ["#ffffff", "#ffe27a", "#f6a8d8"][k % 3]!;
        c.beginPath(); c.arc(x + (ruido(k + q * 2) - 0.5) * 14, y + (ruido(k * 2 + q) - 0.5) * 8, 1.3, 0, Math.PI * 2); c.fill();
      }
    }
    caminoDePiedra(v);
  };
  const u = v.tw / 2;
  const edificio = (b: readonly [number, number, number, number, number], extraAlto: number): Cosa["caja"] => {
    const [i0, i1, j0, j1, h] = b;
    const pts: [number, number, number][] = [];
    for (const i of [i0 - 0.3, i1 + h + 1.9]) for (const j of [j0 - 0.3, j1 + 0.5]) for (const z of [0, h + extraAlto]) pts.push([i, j, z]);
    return cajaDe(v, pts, u * 2.4, u * 0.6);
  };
  const cosas: Cosa[] = [
    { orden: 2.5 + 6.3, caja: edificio(GIMNASIO, 3.2), pinta: () => gimnasioReal(v) },
    { orden: 1.6 + 7.4, caja: edificio(CASA, 3.4), pinta: () => casaReal(v) },
    ...ARBOLES.map(([i, j]): Cosa => {
      const [bx, by] = p(v, i, j);
      const r = u * 1.15, alto = (v.zEsc ?? v.th) * 1.6;
      return { orden: i + j, caja: { x: bx - r * 1.6, y: by - alto - r * 2.1, w: r * 3.6, h: alto + r * 2.9 }, pinta: () => arbolReal(v, i, j) };
    }),
  ].sort((a, b) => a.orden - b.orden);
  const encima = () => {
    // Viñeta suave en las orillas.
    const c = v.c;
    const vin = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vin.addColorStop(0, "rgba(0, 0, 0, 0)"); vin.addColorStop(1, "rgba(0, 30, 0, 0.28)");
    c.fillStyle = vin; c.fillRect(0, 0, W, H);
  };
  return { v, suelo, cosas, encima };
}
