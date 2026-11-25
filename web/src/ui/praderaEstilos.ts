/**
 * TEMPORAL: propuestas de gráficos más realistas para la pradera de Mi espacio (entrenador,
 * 2026-11-25: "proponme otro estilo, quizá un poco más realista… el diseño de la pradera, de los
 * árboles, de las casas, del cielo"). Mismo acomodo que la de caricatura (`pradera.ts`): el
 * camino, la casa a la izquierda y el gimnasio a la derecha; solo cambian los gráficos.
 *
 *  - realista: isométrica con texturas, luz desde arriba a la izquierda y sombras.
 *  - lowpoly: isométrica de caras planas (triángulos), como los juegos de ahora.
 *  - perspectiva: de frente, con cielo, montañas a lo lejos y profundidad.
 */
import { ruido } from "./gimnasioFondo";
import { p, poligono, type Vista } from "./iso";
import { ARBOLES, CASA, GIMNASIO, TRAMOS, camaraPradera, letreroFlotante, vistaPradera, zonaDe, type Zona } from "./pradera";

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

export function praderaRealista(c: CanvasRenderingContext2D, W: number, H: number): Zona[] {
  const v = vistaPradera(c, W, H);
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
  const cosas: { orden: number; pinta: () => Zona | void }[] = [
    { orden: 2.5 + 6.3, pinta: () => gimnasioReal(v) },
    { orden: 1.6 + 7.4, pinta: () => casaReal(v) },
    ...ARBOLES.map(([i, j]) => ({ orden: i + j, pinta: () => arbolReal(v, i, j) })),
  ];
  const zonas: Zona[] = [];
  for (const cosa of cosas.sort((a, b) => a.orden - b.orden)) { const z = cosa.pinta(); if (z) zonas.push(z); }
  // Con la cámara baja se alcanza a ver a lo lejos: el horizonte con bruma y cielo arriba.
  if (camaraPradera() === "baja") {
    const lejos = c.createLinearGradient(0, 0, 0, H * 0.3);
    lejos.addColorStop(0, "rgba(190, 220, 245, 1)"); lejos.addColorStop(0.35, "rgba(200, 225, 235, 0.85)"); lejos.addColorStop(1, "rgba(200, 225, 235, 0)");
    c.fillStyle = lejos; c.fillRect(0, 0, W, H * 0.3);
  }
  // Viñeta suave en las orillas.
  const vin = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vin.addColorStop(0, "rgba(0, 0, 0, 0)"); vin.addColorStop(1, "rgba(0, 30, 0, 0.28)");
  c.fillStyle = vin; c.fillRect(0, 0, W, H);
  return zonas;
}

// ── Low poly ─────────────────────────────────────────────────────────────

function tono(base: [number, number, number], luz: number): string {
  return `rgb(${base.map((x) => Math.max(0, Math.min(255, Math.round(x * luz)))).join(",")})`;
}

function triangulo(c: CanvasRenderingContext2D, a: Punto, b: Punto, d: Punto, color: string): void {
  c.fillStyle = color; c.strokeStyle = color; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fill(); c.stroke();
}

function pinoLow(v: Vista, i: number, j: number): void {
  const c = v.c;
  const [x, y] = p(v, i, j);
  const r = (v.tw / 2) * 0.95;
  c.fillStyle = "rgba(20, 50, 20, 0.25)"; c.beginPath(); c.ellipse(x + r * 0.6, y + r * 0.1, r * 0.9, r * 0.32, 0, 0, Math.PI * 2); c.fill();
  triangulo(c, [x - r * 0.12, y], [x + r * 0.12, y], [x, y - r * 0.8], "#6b4428");
  const redondo = ruido(i * 5 + j) > 0.5;
  if (redondo) {
    // Árbol de copa redonda: un hexágono partido en seis caras.
    const cy = y - r * 1.6, rad = r * 1.05;
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * Math.PI * 2 - Math.PI / 2, a1 = ((k + 1) / 6) * Math.PI * 2 - Math.PI / 2;
      const luz = 0.75 + 0.35 * Math.max(0, -Math.cos(a0 + 0.5));
      triangulo(c, [x, cy], [x + Math.cos(a0) * rad, cy + Math.sin(a0) * rad], [x + Math.cos(a1) * rad, cy + Math.sin(a1) * rad], tono([76, 150, 70], luz));
    }
  } else {
    // Pino: tres pisos, cada uno con su cara iluminada y su cara en sombra.
    for (let k = 0; k < 3; k++) {
      const base = y - r * (0.6 + k * 0.62), ancho = r * (1.05 - k * 0.25), punta = base - r * 0.95;
      triangulo(c, [x - ancho, base], [x, base + r * 0.12], [x, punta], tono([60, 130, 70], 1.15));
      triangulo(c, [x, base + r * 0.12], [x + ancho, base], [x, punta], tono([60, 130, 70], 0.78));
    }
  }
}

function cajaLow(v: Vista, i0: number, j0: number, w: number, d: number, z0: number, h: number, base: [number, number, number]): void {
  cara(v, i0, j0 + d, i0 + w, j0 + d, z0, z0 + h, tono(base, 1));
  cara(v, i0 + w, j0, i0 + w, j0 + d, z0, z0 + h, tono(base, 0.78));
  poligono(v, [p(v, i0, j0, z0 + h), p(v, i0 + w, j0, z0 + h), p(v, i0 + w, j0 + d, z0 + h), p(v, i0, j0 + d, z0 + h)], tono(base, 1.18));
}

export function praderaLowPoly(c: CanvasRenderingContext2D, W: number, H: number): Zona[] {
  const v = vistaPradera(c, W, H);
  // El piso: una malla de triángulos con vértices movidos y cada cara de un verde distinto.
  const lado = Math.max(28, W / 9);
  const cols = Math.ceil(W / lado) + 2, filas = Math.ceil(H / (lado * 0.8)) + 2;
  const vert = (cx: number, fy: number): Punto => [cx * lado + (fy % 2 ? lado / 2 : 0) - lado + (ruido(cx * 7 + fy * 13) - 0.5) * lado * 0.5, fy * lado * 0.8 - lado + (ruido(cx * 11 + fy * 5) - 0.5) * lado * 0.4];
  for (let fy = 0; fy < filas; fy++) for (let cx = 0; cx < cols; cx++) {
    const a = vert(cx, fy), b = vert(cx + 1, fy), d = vert(cx + (fy % 2 ? 1 : 0), fy + 1), e = vert(cx + (fy % 2 ? 2 : 1), fy + 1);
    triangulo(c, a, b, d, tono([98, 170, 74], 0.88 + ruido(cx * 3 + fy * 17) * 0.24));
    triangulo(c, b, e, d, tono([98, 170, 74], 0.88 + ruido(cx * 19 + fy * 7) * 0.24));
  }
  // Camino: franja plana con dos tonos.
  for (const [ancho, color] of [[1.15, "#c2a878"], [0.95, "#dcc79a"]] as const) {
    for (const [i0, j0, i1, j1] of TRAMOS) {
      const largo = Math.hypot(i1 - i0, j1 - j0), ni = -(j1 - j0) / largo * ancho / 2, nj = (i1 - i0) / largo * ancho / 2;
      poligono(v, [p(v, i0 + ni, j0 + nj), p(v, i1 + ni, j1 + nj), p(v, i1 - ni, j1 - nj), p(v, i0 - ni, j0 - nj)], color);
    }
  }
  const casaLow = (): Zona => {
    const [i0, i1, j0, j1, h] = CASA;
    sombra(v, i0, j0, i1 - i0, j1 - j0, h + 0.8, 0.22);
    cajaLow(v, i0, j0, i1 - i0, j1 - j0, 0, h, [245, 232, 206]);
    cara(v, i1, 6.2, i1, 6.8, 0, 1.05, "#8a5a32");
    for (const [a, b] of [[5.6, 6.0], [7.0, 7.4]] as const) cara(v, i1, a, i1, b, 0.6, 1.2, "#7fb6e0");
    cara(v, 2.1, j1, 3.4, j1, 0.6, 1.2, "#9cc9ec");
    const jm = (j0 + j1) / 2;
    poligono(v, [p(v, i1, j0, h), p(v, i1, j1, h), p(v, i1, jm, h + 1.2)], tono([245, 232, 206], 0.85));
    poligono(v, [p(v, i0 - 0.15, j1 + 0.15, h), p(v, i1 + 0.15, j1 + 0.15, h), p(v, i1 + 0.15, jm, h + 1.2), p(v, i0 - 0.15, jm, h + 1.2)], "#c8553f");
    poligono(v, [p(v, i0 - 0.15, jm, h + 1.2), p(v, i1 + 0.15, jm, h + 1.2), p(v, i1 + 0.15, j1 + 0.15, h)], "#d9654c");
    letreroFlotante(v, (i0 + i1) / 2, (j0 + j1) / 2, h + 2.4, "🏠 Casa", "#ffd45c");
    return zonaDe(v, "casa", i0, i1, j0, j1, h + 2.5);
  };
  const gimnasioLow = (): Zona => {
    const [i0, i1, j0, j1, h] = GIMNASIO;
    sombra(v, i0, j0, i1 - i0, j1 - j0, h, 0.24);
    cajaLow(v, i0, j0, i1 - i0, j1 - j0, 0, h, [92, 102, 122]);
    cara(v, i0 + 0.2, j1, (i0 + i1) / 2, j1, 0.15, 1.5, "#8fc4ec");
    cara(v, (i0 + i1) / 2, j1, i1 - 0.2, j1, 0.15, 1.5, "#74acd8");
    cara(v, 6.4, j1, 7.1, j1, 0, 1.2, "#2a2d36");
    cajaLow(v, i0 - 0.1, j0 - 0.1, i1 - i0 + 0.2, j1 - j0 + 0.2, h, 0.2, [70, 76, 92]);
    const [x0, y0] = p(v, i0 + 0.5, j1, h - 0.2), [x1, y1] = p(v, i1 - 0.5, j1, h - 0.2);
    c.save(); c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0));
    c.font = `900 ${Math.round((v.tw / 2) * 0.6)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "#ff3bd4"; c.fillText("OSFIT GYM", Math.hypot(x1 - x0, y1 - y0) / 2, 0);
    c.restore();
    letreroFlotante(v, (i0 + i1) / 2, (j0 + j1) / 2, h + 2.4, "🏋️ Gimnasio", "#ff3bd4");
    return zonaDe(v, "gimnasio", i0, i1, j0, j1, h + 2.5);
  };
  const cosas: { orden: number; pinta: () => Zona | void }[] = [
    { orden: 2.5 + 6.3, pinta: gimnasioLow },
    { orden: 1.6 + 7.4, pinta: casaLow },
    ...ARBOLES.map(([i, j]) => ({ orden: i + j, pinta: () => pinoLow(v, i, j) })),
  ];
  const zonas: Zona[] = [];
  for (const cosa of cosas.sort((a, b) => a.orden - b.orden)) { const z = cosa.pinta(); if (z) zonas.push(z); }
  return zonas;
}

// ── Perspectiva ──────────────────────────────────────────────────────────

function etiqueta(c: CanvasRenderingContext2D, x: number, y: number, texto: string, color: string): void {
  c.font = "800 13px system-ui, sans-serif";
  const w = c.measureText(texto).width + 18, h = 24;
  c.fillStyle = "rgba(20, 16, 30, 0.82)"; c.beginPath(); c.roundRect(x - w / 2, y - h, w, h, h / 2); c.fill();
  c.strokeStyle = color; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(texto, x, y - h / 2 + 0.5);
  c.fillStyle = "rgba(20, 16, 30, 0.82)"; c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x + 5, y); c.lineTo(x, y + 6); c.fill();
}

export function praderaPerspectiva(c: CanvasRenderingContext2D, W: number, H: number): Zona[] {
  const hz = H * 0.3;
  // Cielo con su sol y nubes suaves.
  c.fillStyle = degradado(c, [0, 0], [0, hz], ["#3f86d6", "#7fb8ec", "#d8ecfb"]); c.fillRect(0, 0, W, hz + 2);
  const sol = c.createRadialGradient(W * 0.8, H * 0.08, 0, W * 0.8, H * 0.08, W * 0.35);
  sol.addColorStop(0, "rgba(255, 250, 220, 0.95)"); sol.addColorStop(0.12, "rgba(255, 240, 190, 0.6)"); sol.addColorStop(1, "rgba(255, 240, 190, 0)");
  c.fillStyle = sol; c.fillRect(0, 0, W, hz);
  for (const [fx, fy, s] of [[0.2, 0.09, 1.2], [0.55, 0.05, 0.9], [0.4, 0.18, 0.8], [0.88, 0.2, 0.7]] as const) {
    for (let k = 0; k < 7; k++) {
      const x = W * fx + (k - 3) * W * 0.03 * s, y = H * fy + Math.sin(k * 1.7) * H * 0.008, r = W * (0.035 + ruido(k + fx * 10) * 0.025) * s;
      const g = c.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, "rgba(255, 255, 255, 0.95)"); g.addColorStop(0.7, "rgba(240, 246, 255, 0.8)"); g.addColorStop(1, "rgba(220, 232, 248, 0)");
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  }
  // Montañas a lo lejos (con bruma) y cerros más cerca.
  const cordillera = (base: number, alto: number, color: string, sem: number) => {
    c.fillStyle = color; c.beginPath(); c.moveTo(0, base);
    for (let x = 0; x <= W; x += W / 24) c.lineTo(x, base - alto * (0.35 + ruido(sem + x / W * 24) * 0.65));
    c.lineTo(W, base); c.closePath(); c.fill();
  };
  cordillera(hz + 2, H * 0.09, "#a9bfd6", 1);
  cordillera(hz + 4, H * 0.05, "#86a6c2", 7);
  // Línea de árboles en el horizonte.
  for (let x = -10; x < W + 10; x += 7) { c.fillStyle = ruido(x) > 0.5 ? "#3f6f3a" : "#4b7d43"; c.beginPath(); c.arc(x, hz + 5, 5 + ruido(x * 3) * 5, Math.PI, 0); c.fill(); }
  // La pradera: más clara y azulada a lo lejos, más verde y oscura cerca.
  c.fillStyle = degradado(c, [0, hz + 4], [0, H], ["#8fbf6a", "#6aa84e", "#3f8a3a"]); c.fillRect(0, hz + 4, W, H);
  // Pasto que crece hacia el frente (perspectiva).
  for (let k = 0; k < 900; k++) {
    const f = ruido(k * 2.3), y = hz + 8 + f * f * (H - hz), escala = 0.3 + f * 2.2, x = ruido(k * 5.7) * W;
    c.strokeStyle = k % 3 ? "rgba(40, 100, 35, 0.45)" : "rgba(170, 220, 120, 0.5)"; c.lineWidth = Math.max(0.6, escala * 0.5);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + escala * 0.6, y - escala * 4); c.stroke();
  }
  // El camino en perspectiva: ancho abajo, se parte en Y hacia las dos puertas.
  const yPartida = H * 0.66, casaX = W * 0.27, casaY = H * 0.56, gymX = W * 0.74, gymY = H * 0.55;
  const tierra = (pts: Punto[], color: string) => { c.fillStyle = color; c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
  for (const [extra, color] of [[6, "#9c8459"], [0, "#cdb88a"]] as const) {
    tierra([[W * 0.33 - extra, H], [W * 0.67 + extra, H], [W * 0.54 + extra * 0.4, yPartida], [W * 0.46 - extra * 0.4, yPartida]], color);
    tierra([[W * 0.46 - extra * 0.4, yPartida + 2], [W * 0.53 + extra * 0.4, yPartida + 2], [casaX + W * 0.035 + extra * 0.3, casaY], [casaX - W * 0.025 - extra * 0.3, casaY]], color);
    tierra([[W * 0.47 - extra * 0.4, yPartida + 2], [W * 0.54 + extra * 0.4, yPartida + 2], [gymX + W * 0.025 + extra * 0.3, gymY], [gymX - W * 0.035 - extra * 0.3, gymY]], color);
  }
  for (let k = 0; k < 120; k++) {
    const f = ruido(k * 3.1), y = yPartida + f * (H - yPartida), ancho = W * (0.08 + f * 0.25), x = W / 2 + (ruido(k * 7.3) - 0.5) * ancho;
    c.fillStyle = "rgba(120, 100, 70, 0.4)"; c.beginPath(); c.ellipse(x, y, 1 + f * 3, 0.6 + f * 1.6, 0, 0, Math.PI * 2); c.fill();
  }
  const zonas: Zona[] = [];
  // Árboles de atrás (más chicos) antes de los edificios.
  const arbolEn = (x: number, y: number, escala: number, sem: number) => {
    c.fillStyle = "rgba(20, 50, 20, 0.22)"; c.beginPath(); c.ellipse(x + escala * 14, y, escala * 26, escala * 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = degradado(c, [x - escala * 4, 0], [x + escala * 4, 0], ["#8b5e3c", "#4a2e1a"]);
    c.beginPath(); c.moveTo(x - escala * 4, y); c.lineTo(x + escala * 4, y); c.lineTo(x + escala * 2, y - escala * 34); c.lineTo(x - escala * 2, y - escala * 34); c.fill();
    copaReal(c, x, y - escala * 50, escala * 26, sem);
  };
  for (const [fx, fy, s] of [[0.06, 0.42, 0.45], [0.47, 0.43, 0.4], [0.95, 0.44, 0.5], [0.14, 0.47, 0.55]] as const) arbolEn(W * fx, H * fy, s * (W / 400), fx * 50);
  // La casa: frente con su hastial y el costado que se va hacia atrás.
  {
    const w = W * 0.26, h = w * 0.55, x = casaX - w * 0.5, y = casaY;
    const fondo = w * 0.35;
    c.fillStyle = "rgba(20, 40, 15, 0.25)"; c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + w * 0.5, y + 6); c.lineTo(x + w * 0.4, y + 10); c.lineTo(x, y); c.fill();
    // Costado izquierdo, en sombra.
    c.fillStyle = degradado(c, [x - fondo, 0], [x, 0], ["#c9b593", "#dccaa8"]);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - fondo, y - h * 0.18); c.lineTo(x - fondo, y - h * 1.08); c.lineTo(x, y - h); c.fill();
    // Techo del costado.
    c.fillStyle = degradado(c, [0, y - h * 1.7], [0, y - h], ["#a84a38", "#7e3326"]);
    c.beginPath(); c.moveTo(x - w * 0.04, y - h); c.lineTo(x - fondo - w * 0.04, y - h * 1.1); c.lineTo(x - fondo + w * 0.46, y - h * 1.72); c.lineTo(x + w * 0.5, y - h * 1.62); c.fill();
    // Frente.
    c.fillStyle = degradado(c, [0, y - h], [0, y], ["#fbf3e4", "#e9dbc0"]); c.fillRect(x, y - h, w, h);
    c.strokeStyle = "rgba(150, 120, 80, 0.2)"; c.lineWidth = 1; for (let yy = y - h + h / 9; yy < y; yy += h / 9) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
    c.fillStyle = degradado(c, [0, y - h * 1.62], [0, y - h], ["#f6ecda", "#e2d2b4"]);
    c.beginPath(); c.moveTo(x - w * 0.02, y - h); c.lineTo(x + w * 0.5, y - h * 1.62); c.lineTo(x + w * 1.02, y - h); c.fill();
    c.strokeStyle = "#7e3326"; c.lineWidth = 3; c.beginPath(); c.moveTo(x - w * 0.06, y - h * 0.97); c.lineTo(x + w * 0.5, y - h * 1.66); c.lineTo(x + w * 1.06, y - h * 0.97); c.stroke();
    // Chimenea, puerta y ventanas.
    c.fillStyle = "#8f4434"; c.fillRect(x - fondo * 0.4, y - h * 1.62, w * 0.08, h * 0.32);
    c.fillStyle = degradado(c, [0, y - h * 0.62], [0, y], ["#9a6a40", "#6e4527"]); c.fillRect(x + w * 0.41, y - h * 0.62, w * 0.18, h * 0.62);
    for (const fx of [0.1, 0.68]) {
      c.fillStyle = "#f4f1ea"; c.fillRect(x + w * fx, y - h * 0.72, w * 0.22, h * 0.36);
      c.fillStyle = degradado(c, [0, y - h * 0.7], [0, y - h * 0.38], ["#cfe9ff", "#4a7fae"]); c.fillRect(x + w * fx + 2, y - h * 0.7, w * 0.22 - 4, h * 0.32);
      c.fillStyle = "#f4f1ea"; c.fillRect(x + w * (fx + 0.105), y - h * 0.7, 2, h * 0.32);
    }
    c.fillStyle = "#c9bfae"; c.fillRect(x + w * 0.38, y - 3, w * 0.24, 4);
    for (let k = 0; k < 4; k++) copaReal(c, x + w * (0.06 + k * 0.1) + (k > 1 ? w * 0.48 : 0), y - 4, w * 0.055, 30 + k, -10);
    zonas.push({ lugar: "casa", x: x - fondo, y: y - h * 2.4, w: w + fondo, h: h * 2.5 });
    etiqueta(c, x + w * 0.5, y - h * 1.85, "🏠 Casa", "#ffd45c");
  }
  // El gimnasio: frente de vidrio y el costado derecho que se va hacia atrás.
  {
    const w = W * 0.32, h = w * 0.5, x = gymX - w * 0.5, y = gymY;
    const fondo = w * 0.3;
    c.fillStyle = "rgba(20, 40, 15, 0.25)"; c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + fondo + w * 0.3, y - h * 0.05); c.lineTo(x + w * 0.5, y + 10); c.fill();
    c.fillStyle = degradado(c, [x + w, 0], [x + w + fondo, 0], ["#4a505d", "#5f6675"]);
    c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + fondo, y - h * 0.16); c.lineTo(x + w + fondo, y - h * 1.12); c.lineTo(x + w, y - h); c.fill();
    c.fillStyle = degradado(c, [0, y - h], [0, y], ["#7d8594", "#5f6675"]); c.fillRect(x, y - h, w, h);
    c.fillStyle = "#3c414c"; c.beginPath(); c.moveTo(x - 3, y - h); c.lineTo(x + w + 3, y - h); c.lineTo(x + w + fondo + 3, y - h * 1.16); c.lineTo(x + fondo * 0.4, y - h * 1.16); c.lineTo(x - 3, y - h * 1.0); c.fill();
    c.fillStyle = "#2c3038"; c.fillRect(x - 3, y - h - 4, w + 6, 5);
    c.fillStyle = degradado(c, [0, y - h * 0.78], [0, y], ["#bfe4ff", "#6fa6d6", "#2f5f8f"]); c.fillRect(x + w * 0.06, y - h * 0.72, w * 0.88, h * 0.66);
    c.save(); c.globalAlpha = 0.3; c.fillStyle = "#fff";
    for (const [f, a] of [[0.15, 0.06], [0.3, 0.02], [0.6, 0.08]] as const) { c.beginPath(); c.moveTo(x + w * f, y - h * 0.06); c.lineTo(x + w * (f + a), y - h * 0.06); c.lineTo(x + w * (f + a + 0.1), y - h * 0.72); c.lineTo(x + w * (f + 0.1), y - h * 0.72); c.fill(); }
    c.restore();
    c.strokeStyle = "#2b2f38"; c.lineWidth = 2;
    for (let k = 0; k <= 6; k++) { const xx = x + w * 0.06 + (w * 0.88 * k) / 6; c.beginPath(); c.moveTo(xx, y - h * 0.72); c.lineTo(xx, y - h * 0.06); c.stroke(); }
    c.fillStyle = "#1f232b"; c.fillRect(x + w * 0.42, y - h * 0.5, w * 0.16, h * 0.5);
    c.fillStyle = "#14151a"; c.fillRect(x + w * 0.18, y - h * 0.95, w * 0.64, h * 0.18);
    c.font = `900 ${Math.round(h * 0.13)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "#fff"; c.shadowColor = "#ff3bd4"; c.shadowBlur = 6; c.fillText("OSFIT GYM", x + w / 2, y - h * 0.86); c.shadowBlur = 0;
    zonas.push({ lugar: "gimnasio", x, y: y - h * 2.1, w: w + fondo, h: h * 2.2 });
    etiqueta(c, x + w * 0.5, y - h * 1.35, "🏋️ Gimnasio", "#ff3bd4");
  }
  // Árboles del frente, grandes, a los lados (cortados por la orilla).
  for (const [fx, fy, s] of [[0.04, 0.8, 1.25], [0.96, 0.83, 1.35], [0.2, 0.98, 1.6], [0.84, 1.02, 1.7]] as const) arbolEn(W * fx, H * fy, s * (W / 400), fx * 90);
  return zonas;
}
