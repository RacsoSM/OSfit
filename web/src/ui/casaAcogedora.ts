/**
 * La casa por dentro, acogedora (entrenador, 2026-11-25: "cambia el interior de la casa como si
 * fuera un interior de Tsuki"): un diseño propio con ese espíritu tranquilo y cálido, en el
 * mismo estilo realista de la pradera. Piso de duela, papel tapiz con lambrín de madera, una
 * ventana soleada con cortinas, la mancha de sol en el piso, cuadros, una repisa con plantitas,
 * alfombra tejida, sillón con cojines, mesita con taza y libro, lámpara de luz cálida, librero
 * y una planta grande.
 *
 * Lo fijo va en `pintarCasaAcogedora`; los muebles, en `mueblesCasaAcogedora`, cada uno con la
 * caja de piso que ocupa (para que el personaje pase detrás de ellos, ver `tapa` en `espacio.ts`).
 */
import { ruido } from "./gimnasioFondo";
import { caja, p, poligono, type Vista } from "./iso";

/** El cuarto mide N cuadros por lado (igual que en `espacio.ts`). */
const N = 6;

type Punto = [number, number];

export interface MuebleCasa { i0: number; i1: number; j0: number; j1: number; alto: number; margen?: number; pinta: () => void; }

function degradado(c: CanvasRenderingContext2D, a: Punto, b: Punto, colores: string[]): CanvasGradient {
  const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
  colores.forEach((col, k) => g.addColorStop(k / (colores.length - 1), col));
  return g;
}
/** Un rectángulo sobre la pared de atrás-izquierda (j = 0). */
function paredIzq(v: Vista, i0: number, i1: number, z0: number, z1: number, relleno: string | CanvasGradient): void {
  poligono(v, [p(v, i0, 0, z0), p(v, i1, 0, z0), p(v, i1, 0, z1), p(v, i0, 0, z1)], relleno);
}
/** Un rectángulo sobre la pared de atrás-derecha (i = 0). */
function paredDer(v: Vista, j0: number, j1: number, z0: number, z1: number, relleno: string | CanvasGradient): void {
  poligono(v, [p(v, 0, j0, z0), p(v, 0, j1, z0), p(v, 0, j1, z1), p(v, 0, j0, z1)], relleno);
}
function linea(v: Vista, a: [number, number, number], b: [number, number, number], color: string, ancho = 1): void {
  const c = v.c;
  c.strokeStyle = color; c.lineWidth = ancho;
  c.beginPath(); c.moveTo(...p(v, a[0], a[1], a[2])); c.lineTo(...p(v, b[0], b[1], b[2])); c.stroke();
}

export function pintarCasaAcogedora(v: Vista, W: number, H: number): void {
  const c = v.c;
  const A = v.alto;
  // Fuera del cuarto: penumbra cálida.
  c.fillStyle = degradado(c, [0, 0], [0, H], ["#2a1c15", "#3d2b20"]); c.fillRect(0, 0, W, H);

  // Paredes: papel tapiz crema con rayitas y un lambrín de madera abajo.
  paredIzq(v, 0, N, 0, A, degradado(c, p(v, 0, 0, A), p(v, 0, 0, 0), ["#f3e7d3", "#e9d9bf"]));
  paredDer(v, 0, N, 0, A, degradado(c, p(v, 0, 0, A), p(v, 0, 0, 0), ["#e6d6bb", "#dac7a8"]));
  for (let k = 0.25; k < N; k += 0.5) {
    linea(v, [k, 0, 0.95], [k, 0, A], "rgba(190, 150, 110, 0.18)", 2);
    linea(v, [0, k, 0.95], [0, k, A], "rgba(170, 130, 95, 0.18)", 2);
  }
  // Flores del papel tapiz: puntitos en rombo.
  for (let k = 0; k < 40; k++) {
    const i = 0.5 + (k % 10) * 0.55, z = 1.25 + Math.floor(k / 10) * 0.45 + ((k % 2) * 0.22);
    const [x, y] = p(v, i, 0, z); c.fillStyle = "rgba(200, 120, 110, 0.22)"; c.beginPath(); c.arc(x, y, Math.max(1, v.th * 0.06), 0, Math.PI * 2); c.fill();
    const [x2, y2] = p(v, 0, i, z); c.fillStyle = "rgba(180, 110, 100, 0.2)"; c.beginPath(); c.arc(x2, y2, Math.max(1, v.th * 0.06), 0, Math.PI * 2); c.fill();
  }
  paredIzq(v, 0, N, 0, 0.95, degradado(c, p(v, 0, 0, 0.95), p(v, 0, 0, 0), ["#b5835a", "#946543"]));
  paredDer(v, 0, N, 0, 0.95, degradado(c, p(v, 0, 0, 0.95), p(v, 0, 0, 0), ["#a67550", "#87593a"]));
  for (let k = 0.6; k < N; k += 0.6) { linea(v, [k, 0, 0.08], [k, 0, 0.9], "rgba(70, 40, 20, 0.35)"); linea(v, [0, k, 0.08], [0, k, 0.9], "rgba(60, 35, 18, 0.35)"); }
  paredIzq(v, 0, N, 0.95, 1.03, "#d9b48a"); paredDer(v, 0, N, 0.95, 1.03, "#cba57b");
  // Moldura de arriba.
  paredIzq(v, 0, N, A - 0.08, A, "#d9c4a4"); paredDer(v, 0, N, A - 0.08, A, "#ccb594");

  // La ventana (pared derecha) con el día afuera, cortinas y repisa.
  const j0 = 1.6, j1 = 4.0, z0 = 1.2, z1 = 2.55;
  paredDer(v, j0, j1, z0, z1, degradado(c, p(v, 0, j0, z1), p(v, 0, j0, z0), ["#7fc0ef", "#cfe9fb"]));
  c.save();
  c.beginPath(); [p(v, 0, j0, z0), p(v, 0, j1, z0), p(v, 0, j1, z1), p(v, 0, j0, z1)].forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip();
  for (const [dj, dz, rr] of [[0.4, 0.25, 0.42], [1.1, 0.15, 0.5], [1.9, 0.3, 0.45]] as const) {
    const [x, y] = p(v, 0, j0 + dj, z0 + dz + 0.2);
    c.fillStyle = "#5a9e4a"; c.beginPath(); c.arc(x, y, rr * v.th * 1.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#79b85e"; c.beginPath(); c.arc(x - rr * v.th * 0.3, y - rr * v.th * 0.35, rr * v.th * 0.7, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  // Marco blanco y cruceta.
  c.strokeStyle = "#fbf6ee"; c.lineWidth = Math.max(2, v.th * 0.16);
  c.beginPath(); [p(v, 0, j0, z0), p(v, 0, j1, z0), p(v, 0, j1, z1), p(v, 0, j0, z1)].forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
  c.lineWidth = Math.max(1.5, v.th * 0.09);
  linea(v, [0, (j0 + j1) / 2, z0], [0, (j0 + j1) / 2, z1], "#fbf6ee", Math.max(1.5, v.th * 0.09));
  linea(v, [0, j0, (z0 + z1) / 2], [0, j1, (z0 + z1) / 2], "#fbf6ee", Math.max(1.5, v.th * 0.09));
  // Repisa de la ventana con dos macetitas.
  poligono(v, [p(v, 0, j0 - 0.1, z0), p(v, 0.25, j0 - 0.1, z0), p(v, 0.25, j1 + 0.1, z0), p(v, 0, j1 + 0.1, z0)], "#fbf6ee");
  for (const jj of [j0 + 0.35, j1 - 0.45]) {
    caja(v, 0.04, jj, 0.18, 0.18, 0.16, ["#d7744f", "#b85d3c", "#a04f31"], z0);
    const [x, y] = p(v, 0.13, jj + 0.09, z0 + 0.3);
    c.fillStyle = "#4f9a46"; c.beginPath(); c.arc(x, y, v.th * 0.22, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e86a8a"; c.beginPath(); c.arc(x + v.th * 0.06, y - v.th * 0.1, v.th * 0.07, 0, Math.PI * 2); c.fill();
  }
  // Cortinas a los lados, con pliegues.
  for (const [a, b] of [[j0 - 0.55, j0 + 0.05], [j1 - 0.05, j1 + 0.55]] as const) {
    paredDer(v, a, b, z0 - 0.25, z1 + 0.15, degradado(c, p(v, 0, a, 0), p(v, 0, b, 0), ["#e9a58e", "#d98c74", "#e9a58e", "#cf7f68"]));
    for (let k = 1; k < 4; k++) linea(v, [0, a + ((b - a) * k) / 4, z0 - 0.25], [0, a + ((b - a) * k) / 4, z1 + 0.15], "rgba(140, 60, 40, 0.25)");
  }
  linea(v, [0, j0 - 0.65, z1 + 0.18], [0, j1 + 0.65, z1 + 0.18], "#8a5a32", Math.max(2, v.th * 0.1));

  // Cuadros en la pared izquierda: un paisaje y una foto.
  const cuadro = (i0: number, i1: number, z0c: number, z1c: number, dibujo: (x: number, y: number, w: number, h: number) => void) => {
    paredIzq(v, i0 - 0.08, i1 + 0.08, z0c - 0.08, z1c + 0.08, "#8a5a32");
    paredIzq(v, i0, i1, z0c, z1c, "#fdf8ef");
    const [x, y] = p(v, i0, 0, z1c), [x2, y2] = p(v, i1, 0, z0c);
    c.save();
    c.beginPath(); [p(v, i0 + 0.06, 0, z0c + 0.06), p(v, i1 - 0.06, 0, z0c + 0.06), p(v, i1 - 0.06, 0, z1c - 0.06), p(v, i0 + 0.06, 0, z1c - 0.06)].forEach(([a, b], k) => (k ? c.lineTo(a, b) : c.moveTo(a, b))); c.closePath(); c.clip();
    dibujo(x, y, x2 - x, y2 - y);
    c.restore();
  };
  cuadro(0.6, 1.5, 1.55, 2.35, (x, y, w, h) => {
    c.fillStyle = degradado(c, [0, y], [0, y + h], ["#9fd2f0", "#e8d0a0"]); c.fillRect(x - 5, y - 5, w + 10, h + 10);
    c.fillStyle = "#7c9a6a"; c.beginPath(); c.moveTo(x - 5, y + h + 5); c.lineTo(x + w * 0.35, y + h * 0.35); c.lineTo(x + w * 0.65, y + h * 0.7); c.lineTo(x + w + 5, y + h * 0.25); c.lineTo(x + w + 5, y + h + 5); c.fill();
  });
  cuadro(1.75, 2.3, 1.75, 2.3, (x, y, w, h) => {
    c.fillStyle = "#e8b4a0"; c.fillRect(x - 5, y - 5, w + 10, h + 10);
    c.fillStyle = "#fff1dc"; c.beginPath(); c.arc(x + w / 2, y + h * 0.55, Math.abs(w) * 0.22, 0, Math.PI * 2); c.fill();
  });
  // Repisa flotante con libros y una plantita colgante.
  poligono(v, [p(v, 4.6, 0, 2.05), p(v, 5.7, 0, 2.05), p(v, 5.7, 0.3, 2.05), p(v, 4.6, 0.3, 2.05)], "#a5734b");
  poligono(v, [p(v, 4.6, 0.3, 2.05), p(v, 5.7, 0.3, 2.05), p(v, 5.7, 0.3, 1.98), p(v, 4.6, 0.3, 1.98)], "#7d5435");
  ["#5b8fb0", "#e3a04f", "#8b5a8f", "#d9604f"].forEach((col, k) => caja(v, 4.7 + k * 0.13, 0.05, 0.11, 0.2, 0.32 + ruido(k * 3) * 0.12, [col, col, col], 2.05));
  caja(v, 5.35, 0.05, 0.2, 0.2, 0.16, ["#f4f1ea", "#ddd6c8", "#c9c1b2"], 2.05);
  for (let k = 0; k < 6; k++) {
    const [x, y] = p(v, 5.45, 0.15, 2.15 - k * 0.12);
    c.fillStyle = k % 2 ? "#5aa04f" : "#4a8a42"; c.beginPath(); c.ellipse(x + (k % 2 ? 4 : -3), y, v.th * 0.12, v.th * 0.07, k % 2 ? 0.5 : -0.5, 0, Math.PI * 2); c.fill();
  }

  // El piso: duela cálida con juntas escalonadas.
  poligono(v, [p(v, 0, 0), p(v, N, 0), p(v, N, N), p(v, 0, N)], degradado(c, p(v, 0, 0), p(v, N, N), ["#c99260", "#a8733f"]));
  c.strokeStyle = "rgba(90, 55, 25, 0.35)"; c.lineWidth = 1;
  for (let k = 1; k < N * 2; k++) { c.beginPath(); c.moveTo(...p(v, k / 2, 0)); c.lineTo(...p(v, k / 2, N)); c.stroke(); }
  for (let k = 0; k < N * 2; k++) for (let m = 0; m < N; m++) {
    const jj = m + ((k % 2) ? 0.5 : 0) + ruido(k * 7 + m) * 0.3;
    if (jj <= 0 || jj >= N) continue;
    c.beginPath(); c.moveTo(...p(v, k / 2, jj)); c.lineTo(...p(v, (k + 1) / 2, jj)); c.stroke();
  }
  // La luz que entra por la ventana, sobre el piso.
  poligono(v, [p(v, 0, j0), p(v, 0, j1), p(v, 2.6, j1 + 0.9), p(v, 2.6, j0 + 0.9)], "rgba(255, 238, 190, 0.22)");
  // Zoclo.
  c.strokeStyle = "#6b4428"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(...p(v, 0, N)); c.lineTo(...p(v, 0, 0)); c.lineTo(...p(v, N, 0)); c.stroke();

  // Alfombra tejida, redonda, con sus anillos.
  const [ax, ay] = p(v, 3, 3.1);
  [["#e9dcc4", 1.45], ["#c9a77e", 1.28], ["#efe4cf", 1.16], ["#d98c74", 0.85], ["#efe4cf", 0.72], ["#c9a77e", 0.4]].forEach(([col, k]) => {
    c.fillStyle = col as string; c.beginPath(); c.ellipse(ax, ay, v.tw * (k as number), v.th * (k as number), 0, 0, Math.PI * 2); c.fill();
  });
}

/** Los muebles de la casa acogedora, cada uno con la caja de piso que ocupa. */
export function mueblesCasaAcogedora(v: Vista): MuebleCasa[] {
  const c = () => v.c;
  const tela: [string, string, string] = ["#9cb88f", "#7f9c73", "#6a8560"];
  const telaClara: [string, string, string] = ["#b4cfa6", "#97b38a", "#829d76"];
  const madera: [string, string, string] = ["#b98a5a", "#946543", "#7a5236"];
  return [
    // Sillón con sus cojines y una almohada de color.
    { i0: 1.2, i1: 4.9, j0: 0.25, j1: 1.45, alto: 1.15, pinta: () => {
      caja(v, 1.4, 0.35, 3.2, 1.1, 0.35, tela);
      caja(v, 1.4, 0.25, 3.2, 0.38, 1.05, tela);
      caja(v, 1.2, 0.25, 0.3, 1.2, 0.7, tela);
      caja(v, 4.6, 0.25, 0.3, 1.2, 0.7, tela);
      caja(v, 1.55, 0.62, 1.45, 0.78, 0.14, telaClara, 0.35);
      caja(v, 3.05, 0.62, 1.45, 0.78, 0.14, telaClara, 0.35);
      const [x, y] = p(v, 1.85, 0.8, 0.85);
      const g = c().createRadialGradient(x - 3, y - 3, 1, x, y, v.th * 0.45);
      g.addColorStop(0, "#f3b39a"); g.addColorStop(1, "#d98c74");
      c().fillStyle = g; c().beginPath(); c().ellipse(x, y, v.th * 0.45, v.th * 0.36, -0.3, 0, Math.PI * 2); c().fill();
      // Patas.
      for (const [i, j] of [[1.25, 1.35], [4.75, 1.35]] as const) caja(v, i, j, 0.1, 0.1, 0.08, ["#5a3820", "#4a2e1a", "#3a2414"]);
    } },
    // Mesita de madera con una taza humeante y un libro.
    { i0: 2.5, i1: 3.7, j0: 2.7, j1: 3.5, alto: 0.75, pinta: () => {
      for (const [i, j] of [[2.55, 2.75], [3.55, 2.75], [2.55, 3.35], [3.55, 3.35]] as const) caja(v, i, j, 0.1, 0.1, 0.34, ["#7a5236", "#6a4630", "#5a3a28"]);
      caja(v, 2.5, 2.7, 1.2, 0.8, 0.08, madera, 0.34);
      caja(v, 2.7, 2.85, 0.45, 0.32, 0.08, ["#e3a04f", "#c9863a", "#b07430"], 0.42);
      caja(v, 3.3, 3.05, 0.16, 0.16, 0.16, ["#f4f1ea", "#ddd6c8", "#c9c1b2"], 0.42);
      const [x, y] = p(v, 3.38, 3.13, 0.62);
      c().strokeStyle = "rgba(255, 255, 255, 0.5)"; c().lineWidth = 1.2;
      c().beginPath(); c().moveTo(x, y); c().quadraticCurveTo(x + 3, y - 5, x, y - 9); c().quadraticCurveTo(x - 3, y - 13, x, y - 17); c().stroke();
    } },
    // Lámpara de pie con pantalla de tela y su luz cálida.
    { i0: 0.4, i1: 0.62, j0: 0.4, j1: 0.62, alto: 2.4, margen: v.tw * 1.4, pinta: () => {
      const cc = c();
      const [gx, gy] = p(v, 0.5, 0.5, 1.95);
      const luz = cc.createRadialGradient(gx, gy, 0, gx, gy, v.tw * 1.3);
      luz.addColorStop(0, "rgba(255, 220, 150, 0.45)"); luz.addColorStop(1, "rgba(255, 220, 150, 0)");
      cc.fillStyle = luz; cc.fillRect(gx - v.tw * 1.3, gy - v.tw * 1.3, v.tw * 2.6, v.tw * 2.6);
      caja(v, 0.42, 0.42, 0.18, 0.18, 0.05, ["#b8934a", "#9a7a3c", "#866a33"]);
      caja(v, 0.48, 0.48, 0.05, 0.05, 1.75, ["#c9a55a", "#a88a48", "#93783f"]);
      const [lx, ly] = p(v, 0.5, 0.5, 2.05);
      cc.fillStyle = degradado(cc, [lx, ly - v.th * 0.4], [lx, ly + v.th * 0.35], ["#fff3d6", "#f3d9a8"]);
      cc.beginPath(); cc.moveTo(lx - v.th * 0.5, ly + v.th * 0.35); cc.lineTo(lx + v.th * 0.5, ly + v.th * 0.35); cc.lineTo(lx + v.th * 0.3, ly - v.th * 0.4); cc.lineTo(lx - v.th * 0.3, ly - v.th * 0.4); cc.closePath(); cc.fill();
    } },
    // Librero contra la pared, con libros de colores.
    { i0: 4.95, i1: 5.85, j0: 0.15, j1: 0.65, alto: 1.9, pinta: () => {
      caja(v, 4.95, 0.15, 0.9, 0.5, 1.8, madera);
      // El frente (j = 0.65) con sus repisas y libros.
      const cc = c();
      for (let k = 0; k < 3; k++) {
        const z = 0.12 + k * 0.58;
        poligono(v, [p(v, 5.02, 0.65, z), p(v, 5.78, 0.65, z), p(v, 5.78, 0.65, z + 0.48), p(v, 5.02, 0.65, z + 0.48)], "#5a3a28");
        let i = 5.05;
        for (let b = 0; b < 6 && i < 5.72; b++) {
          const ancho = 0.08 + ruido(k * 11 + b) * 0.05, alto = 0.3 + ruido(k * 7 + b * 3) * 0.15;
          poligono(v, [p(v, i, 0.65, z), p(v, i + ancho, 0.65, z), p(v, i + ancho, 0.65, z + alto), p(v, i, 0.65, z + alto)], ["#d9604f", "#5b8fb0", "#e3a04f", "#8b5a8f", "#7fa86a", "#f0e2c8"][(k + b) % 6]!);
          i += ancho + 0.015;
        }
      }
      cc.strokeStyle = "rgba(0, 0, 0, 0.2)"; cc.lineWidth = 1;
    } },
    // Planta grande en maceta, junto a la ventana.
    { i0: 0.35, i1: 0.95, j0: 4.55, j1: 5.15, alto: 1.9, margen: 14, pinta: () => {
      caja(v, 0.45, 4.65, 0.4, 0.4, 0.45, ["#d7744f", "#b85d3c", "#a04f31"]);
      const cc = c();
      const [x, y] = p(v, 0.65, 4.85, 0.5);
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI / 2 + (k - 4) * 0.32, largo = v.th * (1.0 + ruido(k * 5) * 0.6);
        const hx = x + Math.cos(a) * largo, hy = y + Math.sin(a) * largo;
        cc.strokeStyle = "#3f7a3a"; cc.lineWidth = 1.2; cc.beginPath(); cc.moveTo(x, y); cc.quadraticCurveTo((x + hx) / 2, (y + hy) / 2 - 4, hx, hy); cc.stroke();
        const g = cc.createRadialGradient(hx - 2, hy - 2, 1, hx, hy, v.th * 0.32);
        g.addColorStop(0, "#7fbf6a"); g.addColorStop(1, "#3f8a3f");
        cc.fillStyle = g; cc.beginPath(); cc.ellipse(hx, hy, v.th * 0.32, v.th * 0.18, a, 0, Math.PI * 2); cc.fill();
      }
    } },
  ];
}
