/**
 * Mi espacio (entrenador, 2026-11-25; backlog 2, punto 29, fase 2): el lugar propio de cada
 * quien, un gimnasio en un cuarto visto un poco desde arriba (isométrico). Más adelante se
 * mejora con lo que se compre con Monedas y los demás lo pueden visitar.
 *
 * Por ahora solo lo ve quien tiene `pruebasEspacio` en su perfil (ver `puedeVer` en
 * `ventanas.ts`). Todo se dibuja a mano en un canvas, como los juegos.
 */
import { escapar } from "./tarjetaDia";

/** TEMPORAL: propuestas de estilo del cuarto (`osfit:espacio-estilo`: a, b, c). */
export type EstiloEspacio = "a" | "b" | "c";
function estiloGuardado(): EstiloEspacio {
  try { const v = globalThis.localStorage?.getItem("osfit:espacio-estilo"); return v === "b" || v === "c" ? v : "a"; } catch { return "a"; }
}
/** TEMPORAL: para las capturas, el cuarto con objetos de ejemplo (lo que se podrá comprar). */
function conEjemplos(): boolean {
  try { return globalThis.localStorage?.getItem("osfit:espacio-ejemplos") === "1"; } catch { return false; }
}

export function ventanaEspacio(nombre: string): string {
  const quien = nombre.trim().split(/\s+/)[0] ?? "";
  return `
    <section class="espacio" aria-label="Mi espacio">
      <p class="espacio-aviso">Vista de pruebas · solo tú la ves</p>
      <div class="espacio-cuarto"><canvas id="espacio-canvas" aria-label="El gimnasio de ${escapar(quien)}"></canvas></div>
      <p class="espacio-nombre">El gimnasio de ${escapar(quien)}</p>
    </section>`;
}

// ── Isométrico ──────────────────────────────────────────────────────────────

/** Cuántos cuadros tiene el piso por lado. */
const N = 6;

interface Vista { c: CanvasRenderingContext2D; ox: number; oy: number; tw: number; th: number; alto: number; }

/** Del piso (i a la derecha-abajo, j a la izquierda-abajo, z hacia arriba) a la pantalla. */
function p(v: Vista, i: number, j: number, z = 0): [number, number] {
  return [v.ox + (i - j) * (v.tw / 2), v.oy + (i + j) * (v.th / 2) - z * v.th];
}

function poligono(v: Vista, puntos: [number, number][], relleno: string | CanvasGradient, borde?: string): void {
  const c = v.c;
  c.beginPath();
  puntos.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = relleno; c.fill();
  if (borde) { c.strokeStyle = borde; c.lineWidth = 1; c.stroke(); }
}

/** Una caja en el piso: de (i, j) con ancho `w` (en i), fondo `d` (en j), alto `h`, a altura `z`. */
function caja(v: Vista, i: number, j: number, w: number, d: number, h: number, colores: [string, string, string], z = 0): void {
  const [tapa, izq, der] = colores;
  // Cara izquierda (mira hacia j+), derecha (hacia i+) y la tapa.
  poligono(v, [p(v, i, j + d, z), p(v, i + w, j + d, z), p(v, i + w, j + d, z + h), p(v, i, j + d, z + h)], izq);
  poligono(v, [p(v, i + w, j, z), p(v, i + w, j + d, z), p(v, i + w, j + d, z + h), p(v, i + w, j, z + h)], der);
  poligono(v, [p(v, i, j, z + h), p(v, i + w, j, z + h), p(v, i + w, j + d, z + h), p(v, i, j + d, z + h)], tapa);
}

/** Un rectángulo pegado a la pared de atrás-izquierda (j = 0), de i0 a i1 y de z0 a z1. */
function enParedIzq(v: Vista, i0: number, i1: number, z0: number, z1: number, relleno: string | CanvasGradient, borde?: string): void {
  poligono(v, [p(v, i0, 0, z0), p(v, i1, 0, z0), p(v, i1, 0, z1), p(v, i0, 0, z1)], relleno, borde);
}
/** Igual, en la pared de atrás-derecha (i = 0), de j0 a j1. */
function enParedDer(v: Vista, j0: number, j1: number, z0: number, z1: number, relleno: string | CanvasGradient, borde?: string): void {
  poligono(v, [p(v, 0, j0, z0), p(v, 0, j1, z0), p(v, 0, j1, z1), p(v, 0, j0, z1)], relleno, borde);
}

interface Paleta {
  fondo: [string, string];
  piso: [string, string];
  lineaPiso: string;
  paredIzq: string;
  paredDer: string;
  zoclo: string;
  tapete: [string, string, string];
}

const PALETAS: Record<EstiloEspacio, Paleta> = {
  // A · Neón nocturno: el Arcade hecho cuarto.
  a: { fondo: ["#0d0b16", "#1d1033"], piso: ["#1a1430", "#120e22"], lineaPiso: "rgba(126, 243, 255, 0.35)", paredIzq: "#2a1d4d", paredDer: "#22183f", zoclo: "#ff3bd4", tapete: ["#ff3bd4", "#b0218f", "#8d1a73"] },
  // B · Loft cálido: madera, ladrillo y la luz del atardecer.
  b: { fondo: ["#2b1a14", "#4a2c1f"], piso: ["#b07a4a", "#8f5f36"], lineaPiso: "rgba(70, 40, 15, 0.35)", paredIzq: "#e9dcc8", paredDer: "#dccdb6", zoclo: "#6b4428", tapete: ["#3f9e7a", "#2e7a5d", "#245f48"] },
  // C · Pixel 8 bits: colores planos de consola vieja.
  c: { fondo: ["#1b1b3a", "#2d2d5a"], piso: ["#5b7bd6", "#4a66b8"], lineaPiso: "rgba(20, 30, 80, 0.5)", paredIzq: "#f2a65a", paredDer: "#d98a42", zoclo: "#3a2a6b", tapete: ["#ff5c8a", "#d13a6a", "#a82a54"] },
};

function vistaPara(c: CanvasRenderingContext2D, W: number, H: number): Vista {
  // Que quepa todo: a lo ancho mide N cuadros; a lo alto, el piso (N medios cuadros) más la pared.
  const alto = 3;
  const tw = Math.min((W * 0.92) / N, (2 * H * 0.9) / (N + alto));
  const th = tw / 2;
  const total = (N + alto) * th;
  return { c, tw, th, alto, ox: W / 2, oy: (H - total) / 2 + alto * th };
}

/** Dibuja el cuarto en el canvas `#espacio-canvas` (si está en la página). */
export function dibujarEspacio(estilo: EstiloEspacio = estiloGuardado(), ejemplos = conEjemplos()): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#espacio-canvas");
  if (!canvas) return;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (W === 0 || H === 0) return;
  const pixel = estilo === "c";
  // Que el navegador no suavice los cuadritos al agrandar el canvas.
  canvas.style.imageRendering = pixel ? "pixelated" : "";
  const dpr = pixel ? 1 : Math.min(2, window.devicePixelRatio || 1);
  // En 8 bits se dibuja chiquito y se agranda sin suavizar: así salen los cuadritos.
  const escala = pixel ? 3 : 1;
  const w = Math.round((W * dpr) / escala), h = Math.round((H * dpr) / escala);
  const lienzo = pixel ? document.createElement("canvas") : canvas;
  lienzo.width = w; lienzo.height = h;
  const c = lienzo.getContext("2d");
  if (!c) return;
  if (!pixel) c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cw = pixel ? w : W, ch = pixel ? h : H;
  pintarCuarto(c, cw, ch, estilo, ejemplos);
  if (pixel) {
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const d = canvas.getContext("2d");
    if (!d) return;
    d.imageSmoothingEnabled = false;
    d.drawImage(lienzo, 0, 0, canvas.width, canvas.height);
  }
}

function pintarCuarto(c: CanvasRenderingContext2D, W: number, H: number, estilo: EstiloEspacio, ejemplos: boolean): void {
  const pal = PALETAS[estilo];
  const fondo = c.createLinearGradient(0, 0, 0, H);
  fondo.addColorStop(0, pal.fondo[0]); fondo.addColorStop(1, pal.fondo[1]);
  c.fillStyle = fondo; c.fillRect(0, 0, W, H);
  const v = vistaPara(c, W, H);
  const A = v.alto;

  // Paredes de atrás.
  enParedIzq(v, 0, N, 0, A, pal.paredIzq);
  enParedDer(v, 0, N, 0, A, pal.paredDer);
  if (estilo === "b") ladrillos(v);
  if (estilo === "a") {
    // Rejilla tenue en las paredes y una tira de luz arriba.
    c.strokeStyle = "rgba(126, 243, 255, 0.06)"; c.lineWidth = 1;
    for (let k = 1; k < N; k++) { const [x0, y0] = p(v, k, 0, 0), [x1, y1] = p(v, k, 0, A); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    for (let k = 1; k < N; k++) { const [x0, y0] = p(v, 0, k, 0), [x1, y1] = p(v, 0, k, A); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  }

  // La ventana (pared derecha) y la puerta o el letrero (pared izquierda).
  ventana(v, estilo);
  letrero(v, estilo);

  // El piso.
  const piso = c.createLinearGradient(...p(v, 0, 0), ...p(v, N, N));
  piso.addColorStop(0, pal.piso[0]); piso.addColorStop(1, pal.piso[1]);
  poligono(v, [p(v, 0, 0), p(v, N, 0), p(v, N, N), p(v, 0, N)], piso);
  c.strokeStyle = pal.lineaPiso; c.lineWidth = estilo === "a" ? 1.2 : 1;
  if (estilo === "b") {
    // Duelas de madera: solo en un sentido, con juntas escalonadas.
    for (let k = 1; k < N * 2; k++) { const [x0, y0] = p(v, k / 2, 0), [x1, y1] = p(v, k / 2, N); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    for (let k = 0; k < N * 2; k++) for (let m = 0; m < N; m++) {
      const jj = m + ((k % 2) ? 0.5 : 0);
      if (jj <= 0 || jj >= N) continue;
      const [x0, y0] = p(v, k / 2, jj), [x1, y1] = p(v, (k + 1) / 2, jj); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
  } else {
    for (let k = 0; k <= N; k++) {
      let [x0, y0] = p(v, k, 0), [x1, y1] = p(v, k, N); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      [x0, y0] = p(v, 0, k); [x1, y1] = p(v, N, k); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
  }
  // Zoclo: la orilla de abajo de las paredes.
  c.strokeStyle = pal.zoclo; c.lineWidth = estilo === "a" ? 2.5 : 3;
  if (estilo === "a") { c.shadowColor = pal.zoclo; c.shadowBlur = 10; }
  c.beginPath(); c.moveTo(...p(v, 0, N)); c.lineTo(...p(v, 0, 0)); c.lineTo(...p(v, N, 0)); c.stroke();
  c.shadowBlur = 0;

  // Lo que trae de base: un tapete.
  caja(v, 2, 2.4, 2.2, 1.2, 0.06, pal.tapete);

  if (ejemplos) objetosDeEjemplo(v, estilo);
}

function ladrillos(v: Vista): void {
  const c = v.c;
  c.strokeStyle = "rgba(150, 110, 80, 0.35)"; c.lineWidth = 1;
  for (let z = 0.25; z < v.alto; z += 0.25) {
    let [x0, y0] = p(v, 0, 0, z), [x1, y1] = p(v, N, 0, z); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    [x0, y0] = p(v, 0, 0, z); [x1, y1] = p(v, 0, N, z); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
}

function ventana(v: Vista, estilo: EstiloEspacio): void {
  const c = v.c;
  const j0 = 1.4, j1 = 4.2, z0 = 1.1, z1 = 2.6;
  const [ax, ay] = p(v, 0, j0, z1), [bx, by] = p(v, 0, j0, z0);
  const cielo = c.createLinearGradient(ax, ay, bx, by);
  if (estilo === "a") { cielo.addColorStop(0, "#070b26"); cielo.addColorStop(1, "#2a1d4d"); }
  else if (estilo === "b") { cielo.addColorStop(0, "#3b2a6b"); cielo.addColorStop(1, "#ff9e6b"); }
  else { cielo.addColorStop(0, "#5ec8ff"); cielo.addColorStop(1, "#bff0ff"); }
  enParedDer(v, j0, j1, z0, z1, cielo);
  // La ciudad o el paisaje por la ventana.
  c.save();
  c.beginPath(); [p(v, 0, j0, z0), p(v, 0, j1, z0), p(v, 0, j1, z1), p(v, 0, j0, z1)].forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
  const edificios = [[0.1, 0.55], [0.5, 0.8], [0.85, 0.45], [1.25, 0.7], [1.65, 0.95], [2.05, 0.5], [2.4, 0.75]];
  for (const [dj, alto] of edificios) {
    const color = estilo === "a" ? "#120e22" : estilo === "b" ? "#3a2550" : "#3a2a6b";
    enParedDer(v, j0 + dj, j0 + dj + 0.35, z0, z0 + alto!, color);
    if (estilo !== "c") {
      c.fillStyle = estilo === "a" ? "rgba(255, 212, 92, 0.85)" : "rgba(255, 214, 120, 0.8)";
      for (let k = 0; k < 3; k++) { const [x, y] = p(v, 0, j0 + dj + 0.12, z0 + 0.12 + k * 0.18); if (k * 0.18 + 0.2 < alto!) c.fillRect(x, y - 3, 2, 2); }
    }
  }
  if (estilo === "b") { c.fillStyle = "rgba(255, 200, 120, 0.9)"; const [x, y] = p(v, 0, j0 + 2.1, z0 + 0.35); c.beginPath(); c.arc(x, y, v.th * 0.35, 0, Math.PI * 2); c.fill(); }
  c.restore();
  // Marco y parteluz.
  const marco = estilo === "a" ? "#7ef3ff" : estilo === "b" ? "#5a3a22" : "#ffffff";
  c.strokeStyle = marco; c.lineWidth = estilo === "c" ? 2 : 3;
  if (estilo === "a") { c.shadowColor = marco; c.shadowBlur = 8; }
  c.beginPath(); [p(v, 0, j0, z0), p(v, 0, j1, z0), p(v, 0, j1, z1), p(v, 0, j0, z1)].forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
  c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(...p(v, 0, (j0 + j1) / 2, z0)); c.lineTo(...p(v, 0, (j0 + j1) / 2, z1)); c.stroke();
  c.shadowBlur = 0;
}

function letrero(v: Vista, estilo: EstiloEspacio): void {
  const c = v.c;
  // Un letrero "OSFIT" sobre la pared izquierda, inclinado como ella.
  const [x0, y0] = p(v, 1.2, 0, 2.15), [x1, y1] = p(v, 4.6, 0, 2.15);
  const ang = Math.atan2(y1 - y0, x1 - x0);
  c.save();
  c.translate(x0, y0); c.rotate(ang);
  const largo = Math.hypot(x1 - x0, y1 - y0);
  c.font = `900 ${Math.round(v.th * 0.95)}px ${estilo === "c" ? "ui-monospace, monospace" : "system-ui, sans-serif"}`;
  c.textBaseline = "middle"; c.textAlign = "center";
  if (estilo === "a") {
    c.shadowColor = "#ff3bd4"; c.shadowBlur = 14; c.fillStyle = "#ffd1f4"; c.fillText("OSFIT", largo / 2, 0);
    c.shadowBlur = 0;
  } else if (estilo === "b") {
    c.fillStyle = "#2b1a14"; c.fillRect(largo * 0.18, -v.th * 0.7, largo * 0.64, v.th * 1.4);
    c.fillStyle = "#f2e3c8"; c.fillText("OSFIT", largo / 2, 0);
  } else {
    c.fillStyle = "#3a2a6b"; c.fillText("OSFIT", largo / 2 + 2, 2);
    c.fillStyle = "#ffffff"; c.fillText("OSFIT", largo / 2, 0);
  }
  c.restore();
}

/** Para las capturas: lo que se podrá ir comprando, para ver cómo luce el cuarto lleno. */
function objetosDeEjemplo(v: Vista, estilo: EstiloEspacio): void {
  const metal: [string, string, string] = estilo === "c" ? ["#c8d0e0", "#7d86a0", "#5d6680"] : ["#d6dae2", "#8d939e", "#666c77"];
  const negro: [string, string, string] = ["#3a3d44", "#22242a", "#16171b"];
  const acento: [string, string, string] = estilo === "a" ? ["#7ef3ff", "#2fb7c8", "#1d8a99"] : estilo === "b" ? ["#c0392b", "#962d22", "#73221a"] : ["#ffd45c", "#e0a82e", "#b88520"];
  // Rack de mancuernas contra la pared izquierda.
  caja(v, 0.3, 0.25, 2.4, 0.6, 0.12, negro, 0.6);
  for (const di of [0.1, 2.5]) caja(v, 0.3 + di - 0.1, 0.3, 0.12, 0.5, 0.6, negro);
  for (let k = 0; k < 5; k++) caja(v, 0.45 + k * 0.45, 0.4, 0.3, 0.3, 0.18, k % 2 ? acento : metal, 0.72);
  // Banca plana.
  caja(v, 3.4, 2.5, 0.3, 0.3, 0.35, metal);
  caja(v, 3.4, 4.1, 0.3, 0.3, 0.35, metal);
  caja(v, 3.3, 2.4, 0.5, 2.2, 0.15, acento, 0.35);
  // Kettlebell y planta.
  const [kx, ky] = p(v, 1.2, 4.3, 0.25);
  v.c.fillStyle = "#2a2c31"; v.c.beginPath(); v.c.arc(kx, ky, v.th * 0.42, 0, Math.PI * 2); v.c.fill();
  v.c.strokeStyle = "#2a2c31"; v.c.lineWidth = v.th * 0.14; v.c.beginPath(); v.c.arc(kx, ky - v.th * 0.42, v.th * 0.28, Math.PI, 0); v.c.stroke();
  caja(v, 5.1, 0.3, 0.5, 0.5, 0.5, estilo === "b" ? ["#d9b27a", "#b08a5a", "#8d6a43"] : ["#eeeeee", "#bbbbbb", "#999999"]);
  const [px, py] = p(v, 5.35, 0.55, 1.05);
  v.c.fillStyle = "#3f9e3c";
  for (const [dx, dy, r] of [[0, 0, 0.55], [-0.35, 0.15, 0.4], [0.35, 0.15, 0.4], [0, -0.35, 0.4]] as const) { v.c.beginPath(); v.c.arc(px + dx * v.th, py + dy * v.th, r * v.th, 0, Math.PI * 2); v.c.fill(); }
  // Póster en la pared izquierda.
  enParedIzq(v, 4.9, 5.7, 1.0, 2.0, estilo === "a" ? "#ff3bd4" : estilo === "b" ? "#2b1a14" : "#ff5c8a");
  enParedIzq(v, 5.0, 5.6, 1.12, 1.88, estilo === "a" ? "#1d1033" : estilo === "b" ? "#e8c37a" : "#ffffff");
}
