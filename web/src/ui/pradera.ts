/**
 * La pantalla principal de Mi espacio (entrenador, 2026-11-25): una pradera con un camino que
 * lleva a la casa y al gimnasio de cada quien; tocar uno entra a él. Más adelante, lo que se
 * compre en la tienda para afuera (árboles, bancas, una fuente…) va aquí.
 *
 * Tres propuestas de estilo (temporal): A isométrica de día, B de frente al atardecer con el
 * camino hacia el horizonte, C la isométrica en 8 bits.
 */
import { ruido } from "./gimnasioFondo";
import { caja, p, poligono, type Vista } from "./iso";

export type EstiloPradera = "a" | "b" | "c";
export type Lugar = "casa" | "gimnasio";

/** Dónde quedó dibujado cada edificio (en px del canvas, sin el dpr): para saber qué se tocó. */
export interface Zona { lugar: Lugar; x: number; y: number; w: number; h: number; }

/** Lo grande de la pradera isométrica, en cuadros por lado. */
const M = 10;

export function pintarPradera(c: CanvasRenderingContext2D, W: number, H: number, estilo: EstiloPradera, t: number): Zona[] {
  return estilo === "b" ? praderaDeFrente(c, W, H, t) : praderaIsometrica(c, W, H, estilo === "c");
}

// ── A y C · Isométrica ─────────────────────────────────────────────────────

function praderaIsometrica(c: CanvasRenderingContext2D, W: number, H: number, pixel: boolean): Zona[] {
  // Cielo.
  const cielo = c.createLinearGradient(0, 0, 0, H);
  cielo.addColorStop(0, pixel ? "#5ec8ff" : "#8fd3ff"); cielo.addColorStop(1, pixel ? "#bff0ff" : "#e6f6ff");
  c.fillStyle = cielo; c.fillRect(0, 0, W, H);
  nubes(c, W, H, pixel);

  // La isla de pasto: un rombo con su orilla de tierra.
  const tw = Math.min((W * 0.96) / M, (2 * H * 0.86) / (M + 2));
  const th = tw / 2;
  const v: Vista = { c, tw, th, alto: 0, ox: W / 2, oy: (H - (M + 1.4) * th) / 2 + th * 1.6 };
  const grosor = 0.9;
  poligono(v, [p(v, M, 0), p(v, M, M), p(v, M, M, -grosor), p(v, M, 0, -grosor)], pixel ? "#8a5a32" : "#8d5b34");
  poligono(v, [p(v, 0, M), p(v, M, M), p(v, M, M, -grosor), p(v, 0, M, -grosor)], pixel ? "#6b4428" : "#6e4527");
  const pasto = c.createLinearGradient(...p(v, 0, 0), ...p(v, M, M));
  pasto.addColorStop(0, pixel ? "#6cd65a" : "#8fdc6a"); pasto.addColorStop(1, pixel ? "#3fa83f" : "#4caf50");
  poligono(v, [p(v, 0, 0), p(v, M, 0), p(v, M, M), p(v, 0, M)], pasto);
  // Manchas de otro verde y florecitas.
  for (let k = 0; k < 60; k++) {
    const i = ruido(k * 3.7) * M, j = ruido(k * 5.3) * M;
    const [x, y] = p(v, i, j);
    c.fillStyle = k % 3 ? "rgba(40, 120, 40, 0.18)" : "rgba(200, 255, 160, 0.2)";
    c.beginPath(); c.ellipse(x, y, th * 0.6, th * 0.28, 0, 0, Math.PI * 2); c.fill();
  }
  for (let k = 0; k < 40; k++) {
    const [x, y] = p(v, ruido(k * 7.1) * M, ruido(k * 2.9) * M);
    c.fillStyle = ["#ffffff", "#ffd45c", "#ff9ee5", "#c9b6ff"][k % 4]!;
    c.beginPath(); c.arc(x, y, Math.max(1, th * 0.09), 0, Math.PI * 2); c.fill();
  }

  // El camino: entra por el frente y se parte en dos, uno a la casa y otro al gimnasio.
  const piedra = pixel ? "#e8d9b0" : "#e9dcc0";
  const tramo = (i0: number, j0: number, i1: number, j1: number) => {
    const pasos = Math.ceil(Math.hypot(i1 - i0, j1 - j0) / 0.45);
    for (let k = 0; k <= pasos; k++) {
      const i = i0 + ((i1 - i0) * k) / pasos, j = j0 + ((j1 - j0) * k) / pasos;
      const [x, y] = p(v, i, j);
      c.fillStyle = "rgba(90, 70, 40, 0.25)"; c.beginPath(); c.ellipse(x, y + th * 0.06, th * 0.5, th * 0.25, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = piedra; c.beginPath(); c.ellipse(x, y, th * 0.46, th * 0.23, 0, 0, Math.PI * 2); c.fill();
    }
  };
  tramo(M - 0.3, M - 0.3, 6.2, 6.2);
  tramo(6.2, 6.2, 4.3, 6.6);
  tramo(6.2, 6.2, 6.8, 4.3);

  // Cerca en la orilla de atrás.
  c.strokeStyle = pixel ? "#ffffff" : "#f4efe6"; c.lineWidth = Math.max(1.5, th * 0.12);
  for (const z of [0.35, 0.6]) {
    c.beginPath(); c.moveTo(...p(v, 0, M, z)); c.lineTo(...p(v, 0, 0, z)); c.lineTo(...p(v, M, 0, z)); c.stroke();
  }
  for (let k = 0; k <= M; k++) {
    for (const [i, j] of [[k, 0], [0, k]] as const) { c.beginPath(); c.moveTo(...p(v, i, j)); c.lineTo(...p(v, i, j, 0.75)); c.stroke(); }
  }

  // Lo que está encima, de atrás hacia adelante (por i + j).
  const cosas: { orden: number; pinta: () => Zona | void }[] = [
    { orden: 2.5 + 6.3, pinta: () => gimnasio(v, pixel) },
    { orden: 1.6 + 7.4, pinta: () => casa(v, pixel) },
    ...[[1.2, 1.4], [8.6, 0.9], [0.9, 4.2], [9.0, 6.0], [8.2, 8.6], [2.0, 9.0], [4.4, 1.0]].map(([i, j]) => ({ orden: i! + j!, pinta: () => arbol(v, i!, j!, pixel) })),
  ];
  const zonas: Zona[] = [];
  for (const cosa of cosas.sort((a, b) => a.orden - b.orden)) { const z = cosa.pinta(); if (z) zonas.push(z); }
  return zonas;
}

function nubes(c: CanvasRenderingContext2D, W: number, H: number, pixel: boolean): void {
  c.fillStyle = pixel ? "#ffffff" : "rgba(255, 255, 255, 0.9)";
  for (const [fx, fy, s] of [[0.15, 0.1, 1], [0.7, 0.07, 1.3], [0.45, 0.16, 0.8]] as const) {
    const x = W * fx, y = H * fy, r = W * 0.035 * s;
    for (const [dx, dy, rr] of [[0, 0, 1], [1.1, 0.2, 0.8], [-1, 0.25, 0.75], [0.5, -0.5, 0.8]] as const) { c.beginPath(); c.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); c.fill(); }
  }
}

function arbol(v: Vista, i: number, j: number, pixel: boolean): void {
  const c = v.c;
  caja(v, i - 0.12, j - 0.12, 0.24, 0.24, 0.9, ["#8a5a32", "#6e4527", "#5a3820"]);
  const [x, y] = p(v, i, j, 1.5);
  const r = v.th * 1.05;
  for (const [dx, dy, rr, col] of [[0, 0.15, 1, pixel ? "#2e8f3a" : "#3c9a47"], [-0.45, 0.25, 0.7, pixel ? "#3fa83f" : "#4caf50"], [0.45, 0.2, 0.75, pixel ? "#3fa83f" : "#4caf50"], [0, -0.35, 0.75, pixel ? "#6cd65a" : "#6cc56a"]] as const) {
    c.fillStyle = col; c.beginPath(); c.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); c.fill();
  }
}

/** Un techo de dos aguas sobre la caja (i0..i1, j0..j1) a la altura h, con la cumbrera en i. */
function techo(v: Vista, i0: number, i1: number, j0: number, j1: number, h: number, alto: number, colores: [string, string, string]): void {
  const jm = (j0 + j1) / 2;
  const [frente, atras, lado] = colores;
  poligono(v, [p(v, i0 - 0.15, j0 - 0.15, h), p(v, i1 + 0.15, j0 - 0.15, h), p(v, i1 + 0.15, jm, h + alto), p(v, i0 - 0.15, jm, h + alto)], atras);
  poligono(v, [p(v, i1, j0, h), p(v, i1, j1, h), p(v, i1, jm, h + alto)], lado);
  poligono(v, [p(v, i0 - 0.15, j1 + 0.15, h), p(v, i1 + 0.15, j1 + 0.15, h), p(v, i1 + 0.15, jm, h + alto), p(v, i0 - 0.15, jm, h + alto)], frente);
}

function zonaDe(v: Vista, lugar: Lugar, i0: number, i1: number, j0: number, j1: number, h: number): Zona {
  const pts = [p(v, i0, j0, h), p(v, i1, j0, 0), p(v, i1, j1, 0), p(v, i0, j1, 0), p(v, i1, j1, h), p(v, i0, j1, h), p(v, i1, j0, h)];
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { lugar, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function letreroFlotante(v: Vista, i: number, j: number, z: number, texto: string, color: string): void {
  const c = v.c;
  const [x, y] = p(v, i, j, z);
  c.font = `800 ${Math.max(4, Math.round(v.th * 0.75))}px system-ui, sans-serif`;
  const w = c.measureText(texto).width + v.th * 1.1, h = v.th * 1.25;
  c.fillStyle = "rgba(20, 16, 30, 0.82)";
  c.beginPath(); c.roundRect(x - w / 2, y - h, w, h, h / 2); c.fill();
  c.strokeStyle = color; c.lineWidth = Math.max(1, v.th * 0.12); c.stroke();
  c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(texto, x, y - h / 2 + 0.5);
  const pico = v.th * 0.35;
  c.fillStyle = "rgba(20, 16, 30, 0.82)"; c.beginPath(); c.moveTo(x - pico, y); c.lineTo(x + pico, y); c.lineTo(x, y + pico * 1.2); c.fill();
}

function casa(v: Vista, pixel: boolean): Zona {
  const i0 = 1.6, i1 = 4.0, j0 = 5.4, j1 = 7.6, h = 1.7;
  caja(v, i0, j0, i1 - i0, j1 - j0, h, pixel ? ["#fff3d6", "#ffe6b0", "#f2cf8a"] : ["#fff6e6", "#f5e6cc", "#e8d3b0"]);
  // Puerta y ventanas en la cara que mira al camino (i = i1).
  const cara = (j: number, w: number, z0: number, z1: number, col: string) =>
    poligono(v, [p(v, i1, j, z0), p(v, i1, j + w, z0), p(v, i1, j + w, z1), p(v, i1, j, z1)], col);
  cara(6.2, 0.6, 0, 1.0, "#8a5a32");
  cara(5.65, 0.4, 0.7, 1.15, "#8fd3ff");
  cara(7.0, 0.4, 0.7, 1.15, "#8fd3ff");
  // Ventana en el frente (j = j1).
  poligono(v, [p(v, 2.2, j1, 0.7), p(v, 3.2, j1, 0.7), p(v, 3.2, j1, 1.2), p(v, 2.2, j1, 1.2)], "#8fd3ff");
  techo(v, i0, i1, j0, j1, h, 1.2, pixel ? ["#e0483a", "#b8261a", "#c73a2e"] : ["#d9534a", "#a8352d", "#c0453c"]);
  letreroFlotante(v, (i0 + i1) / 2, (j0 + j1) / 2, h + 2.3, "🏠 Casa", "#ffd45c");
  return zonaDe(v, "casa", i0, i1, j0, j1, h + 2.4);
}

function gimnasio(v: Vista, pixel: boolean): Zona {
  const i0 = 5.2, i1 = 8.6, j0 = 1.2, j1 = 3.8, h = 2.1;
  caja(v, i0, j0, i1 - i0, j1 - j0, h, pixel ? ["#4a4f66", "#5b6280", "#454a62"] : ["#3d4252", "#545b70", "#40465a"]);
  // Vidrio al frente (j = j1) y la puerta que da al camino.
  poligono(v, [p(v, i0 + 0.2, j1, 0.15), p(v, i1 - 0.2, j1, 0.15), p(v, i1 - 0.2, j1, 1.45), p(v, i0 + 0.2, j1, 1.45)], pixel ? "#8fe3ff" : "rgba(143, 211, 255, 0.9)");
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
  c.fillStyle = "#ff3bd4"; c.shadowColor = "#ff3bd4"; c.shadowBlur = pixel ? 0 : 8; c.fillText("OSFIT GYM", largo / 2, 0);
  c.restore();
  letreroFlotante(v, (i0 + i1) / 2, (j0 + j1) / 2, h + 2.4, "🏋️ Gimnasio", "#ff3bd4");
  return zonaDe(v, "gimnasio", i0, i1, j0, j1, h + 2.5);
}

// ── B · De frente, al atardecer ────────────────────────────────────────────

function praderaDeFrente(c: CanvasRenderingContext2D, W: number, H: number, t: number): Zona[] {
  const horizonte = H * 0.42;
  const cielo = c.createLinearGradient(0, 0, 0, horizonte);
  cielo.addColorStop(0, "#3b2a6b"); cielo.addColorStop(0.6, "#c95f86"); cielo.addColorStop(1, "#ff9e6b");
  c.fillStyle = cielo; c.fillRect(0, 0, W, horizonte + 2);
  // Sol que se mete y estrellas tenues arriba.
  const sol = c.createLinearGradient(0, horizonte - W * 0.12, 0, horizonte);
  sol.addColorStop(0, "#ffe08a"); sol.addColorStop(1, "#ff7a45");
  c.fillStyle = sol; c.beginPath(); c.arc(W * 0.5, horizonte, W * 0.12, Math.PI, 0); c.fill();
  for (let k = 0; k < 25; k++) { c.fillStyle = `rgba(255, 255, 255, ${0.3 + 0.3 * Math.sin(t * 2 + k)})`; c.fillRect(ruido(k * 3.3) * W, ruido(k * 7.7) * horizonte * 0.5, 1.5, 1.5); }
  // Cerros en capas.
  const cerro = (base: number, alto: number, col: string, fase: number) => {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) c.lineTo(x, base - alto * (0.5 + 0.5 * Math.sin(x / W * 5 + fase)));
    c.lineTo(W, H); c.fill();
  };
  cerro(horizonte + 4, H * 0.06, "#5a3f86", 1);
  cerro(horizonte + H * 0.05, H * 0.05, "#4a7a4f", 2.5);
  // La pradera.
  const prado = c.createLinearGradient(0, horizonte, 0, H);
  prado.addColorStop(0, "#5aa04f"); prado.addColorStop(1, "#2f7d34");
  c.fillStyle = prado; c.fillRect(0, horizonte + H * 0.07, W, H);
  // El camino: ancho abajo y angosto hacia el horizonte, partido en Y.
  const yPartida = H * 0.66;
  c.fillStyle = "#e9dcc0";
  c.beginPath(); c.moveTo(W * 0.38, H); c.lineTo(W * 0.62, H); c.lineTo(W * 0.53, yPartida); c.lineTo(W * 0.47, yPartida); c.fill();
  c.beginPath(); c.moveTo(W * 0.47, yPartida + 2); c.lineTo(W * 0.53, yPartida + 2); c.lineTo(W * 0.3, H * 0.53); c.lineTo(W * 0.26, H * 0.53); c.fill();
  c.beginPath(); c.moveTo(W * 0.47, yPartida + 2); c.lineTo(W * 0.53, yPartida + 2); c.lineTo(W * 0.74, H * 0.53); c.lineTo(W * 0.7, H * 0.53); c.fill();
  // Árboles redondos a los lados.
  for (const [fx, fy, s] of [[0.08, 0.62, 1.1], [0.92, 0.6, 1.2], [0.15, 0.85, 1.6], [0.88, 0.88, 1.7], [0.5, 0.5, 0.6]] as const) {
    const x = W * fx, y = H * fy, r = W * 0.04 * s;
    c.fillStyle = "#5a3820"; c.fillRect(x - r * 0.12, y, r * 0.24, r * 0.9);
    c.fillStyle = "#2e7a3a"; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#3f9e4a"; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.6, 0, Math.PI * 2); c.fill();
  }
  // La casa (izquierda) y el gimnasio (derecha), al final de cada camino.
  const zonas: Zona[] = [];
  {
    const w = W * 0.26, h = w * 0.62, x = W * 0.28 - w / 2, y = H * 0.53 - h;
    c.fillStyle = "#f5e6cc"; c.fillRect(x, y, w, h);
    c.fillStyle = "#c0453c"; c.beginPath(); c.moveTo(x - w * 0.08, y); c.lineTo(x + w / 2, y - h * 0.65); c.lineTo(x + w * 1.08, y); c.fill();
    c.fillStyle = "#8a5a32"; c.fillRect(x + w * 0.42, y + h * 0.4, w * 0.16, h * 0.6);
    c.fillStyle = "#ffd98a"; c.fillRect(x + w * 0.12, y + h * 0.3, w * 0.18, h * 0.25); c.fillRect(x + w * 0.7, y + h * 0.3, w * 0.18, h * 0.25);
    zonas.push({ lugar: "casa", x: x - w * 0.1, y: y - h * 0.9, w: w * 1.2, h: h * 1.9 });
    etiqueta(c, x + w / 2, y - h * 0.75, "🏠 Casa", "#ffd45c");
  }
  {
    const w = W * 0.3, h = w * 0.62, x = W * 0.72 - w / 2, y = H * 0.53 - h;
    c.fillStyle = "#3d4252"; c.fillRect(x, y, w, h);
    c.fillStyle = "#22242c"; c.fillRect(x - w * 0.04, y - h * 0.12, w * 1.08, h * 0.14);
    c.fillStyle = "rgba(143, 211, 255, 0.9)"; c.fillRect(x + w * 0.08, y + h * 0.25, w * 0.84, h * 0.4);
    c.fillStyle = "#2a2d36"; c.fillRect(x + w * 0.42, y + h * 0.45, w * 0.16, h * 0.55);
    c.font = `900 ${Math.round(h * 0.16)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "#ff3bd4"; c.shadowColor = "#ff3bd4"; c.shadowBlur = 8; c.fillText("OSFIT GYM", x + w / 2, y + h * 0.1); c.shadowBlur = 0;
    zonas.push({ lugar: "gimnasio", x: x - w * 0.05, y: y - h * 0.9, w: w * 1.1, h: h * 1.9 });
    etiqueta(c, x + w / 2, y - h * 0.35, "🏋️ Gimnasio", "#ff3bd4");
  }
  return zonas;
}

function etiqueta(c: CanvasRenderingContext2D, x: number, y: number, texto: string, color: string): void {
  c.font = "800 12px system-ui, sans-serif";
  const w = c.measureText(texto).width + 16, h = 22;
  c.fillStyle = "rgba(20, 16, 30, 0.82)"; c.beginPath(); c.roundRect(x - w / 2, y - h, w, h, h / 2); c.fill();
  c.strokeStyle = color; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(texto, x, y - h / 2 + 0.5);
}
