import { METROS_POR_NIVEL } from "../pesaRun";
import { PARED, TECHO, azarFijo, bola, caja3d, poligono, proyectar, quadFrente, quadPared, quadPiso, type Vista } from "./pesaRun3d";

/**
 * Los alrededores de Correle pa (entrenador, 2026-11-27: "que se note la diferencia entre
 * niveles"): lo que hay afuera del gimnasio, detrás de las paredes y por encima de ellas. Cada
 * zona es otro lugar, con objetos en 3D a los lados que pasan con la perspectiva al correr:
 *
 *  1 Recepción     atardecer en la calle: palmeras, faroles y tiendas
 *  2 Cardio        primeras horas de la noche: una autopista elevada con autos y edificios
 *  3 Pesas libres  en una azotea: tinacos, antenas con foco rojo y la ciudad allá abajo
 *  4 Máquinas      zona industrial: chimeneas con humo, grúas y engranes que giran
 *  5 Crossfit      patio de bodega: contenedores apilados, llantas y foquitos
 *  6 Powerlifting  un estadio: tribunas con público, torres de reflectores y confeti
 *  7 Box           una arena: cuerdas del ring sobre las paredes, público en sombra y reflectores
 *  8 Olimpo        sobre las nubes: columnas doradas y un templo en el horizonte
 *
 * Todo con figuras planas (sin sombras de canvas) y solo lo que cae cerca de la vista.
 */

export function zonaFondo(z: number): number {
  return Math.max(0, Math.min(7, Math.floor(Math.max(0, z) / METROS_POR_NIVEL)));
}

/** El piso de afuera de cada zona: a qué altura está y de qué color. */
const SUELO: readonly [number, string][] = [
  [0, "#5a4646"], [0, "#2a2238"], [-30, "#0b0d1f"], [0, "#3a3530"], [0, "#26262e"], [0, "#16162a"], [0, "#100a10"], [-7, "#fff1cf"],
];

const LEJOS = 130;

/** Lo de afuera, de lejos a cerca. Va después del cielo y antes del piso y las paredes del gimnasio (que lo tapan). */
export function pintarAlrededores(c: CanvasRenderingContext2D, v: Vista, reloj: number): void {
  const z0 = v.camZ + 2, z1 = v.camZ + LEJOS;
  // El piso de afuera, por zona.
  for (let n = zonaFondo(z1); n >= zonaFondo(z0); n--) {
    const a = Math.max(z0, n * METROS_POR_NIVEL), b = n === zonaFondo(z1) ? z1 : Math.min(z1, (n + 1) * METROS_POR_NIVEL);
    if (b <= a) continue;
    const [y, color] = SUELO[n]!;
    for (const lado of [-1, 1]) quadPiso(c, v, lado * (PARED + 0.3), lado * 140, y, a, b, color);
    if (n === 2) lucesAbajo(c, v, a, b, y);
    if (n === 7) nubesAbajo(c, v, a, b, y, reloj);
  }
  // Las cosas de cada zona, de lejos a cerca.
  const paso = 6;
  for (let k = Math.floor(z1 / paso); k >= Math.ceil(z0 / paso); k--) {
    const z = k * paso;
    const n = zonaFondo(z);
    for (const lado of [-1, 1]) {
      const sem = k * 2 + (lado > 0 ? 1 : 0);
      COSAS[n]!(c, v, lado, z, k, sem, reloj);
    }
  }
  // Las tiras largas de cada zona (autopista, tribunas, cuerdas del ring), por tramo de zona.
  for (let n = zonaFondo(z1); n >= zonaFondo(z0); n--) {
    const a = Math.max(z0, n * METROS_POR_NIVEL), b = n === zonaFondo(z1) ? z1 : Math.min(z1, (n + 1) * METROS_POR_NIVEL);
    if (b > a) TIRAS[n]?.(c, v, a, b, reloj);
  }
}

type Pintor = (c: CanvasRenderingContext2D, v: Vista, lado: number, z: number, k: number, sem: number, t: number) => void;

function edificio(c: CanvasRenderingContext2D, v: Vista, x: number, ancho: number, z: number, fondo: number, y0: number, alto: number, color: string, sem: number, ventanas = "rgba(255, 214, 140, 0.85)"): void {
  const x0 = Math.min(x, x + ancho), x1 = Math.max(x, x + ancho);
  caja3d(c, v, x0, x1, y0, y0 + alto, z, z + fondo, color, mezcla(color, 0.15), mezcla(color, -0.2));
  if (z < v.camZ + 4) return;
  // Unas ventanas encendidas en el frente.
  const filas = Math.min(8, Math.floor(alto / 3)), cols = Math.max(1, Math.floor((x1 - x0) / 2.2));
  for (let f = 0; f < filas; f++) for (let k = 0; k < cols; k++) {
    if (azarFijo(sem * 13 + f * 7 + k) < 0.55) continue;
    const wx = x0 + 0.6 + k * 2.2, wy = y0 + 1.2 + f * 3;
    quadFrente(c, v, wx, wx + 0.9, wy, wy + 1.2, z - 0.01, ventanas);
  }
}

function mezcla(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const m = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) + (f > 0 ? (255 - ((n >> s) & 255)) * f : ((n >> s) & 255) * f))));
  return `rgb(${m(16)}, ${m(8)}, ${m(0)})`;
}

function lucesAbajo(c: CanvasRenderingContext2D, v: Vista, a: number, b: number, y: number): void {
  c.fillStyle = "rgba(255, 210, 130, 0.8)";
  for (let z = Math.ceil(a / 8) * 8; z < b; z += 8) for (const lado of [-1, 1]) for (let k = 0; k < 5; k++) {
    const x = lado * (14 + k * 14 + azarFijo(z + k) * 6);
    const p = proyectar(v, x, y, z + azarFijo(z * 3 + k) * 6);
    c.fillRect(p.x - 1, p.y - 1, 2, 2);
  }
}

function nubesAbajo(c: CanvasRenderingContext2D, v: Vista, a: number, b: number, y: number, t: number): void {
  for (let z = Math.ceil(a / 7) * 7; z < b; z += 7) for (const lado of [-1, 1]) for (let k = 0; k < 2; k++) {
    const x = lado * (8 + k * 12 + azarFijo(z + k * 5) * 8 + Math.sin(t * 0.3 + z) * 0.5);
    bola(c, v, x, y + 1, z + k * 3, 2.2 + azarFijo(z * 2 + k) * 1.5, "#ffffff", "rgba(255, 236, 190, 0.6)");
  }
}

// ── Las cosas de cada zona (cada 6 m, a cada lado) ───────────────────────────

const COSAS: readonly Pintor[] = [
  // 1 · Recepción: palmeras, faroles y tiendas.
  (c, v, lado, z, k, sem) => {
    if (k % 3 === 0) {
      const x = lado * 7;
      caja3d(c, v, x - 0.2, x + 0.2, 0, 7, z, z + 0.4, "#7a5230", "#8a6038", "#5c3d22");
      const cima = proyectar(v, x, 7, z + 0.2);
      c.fillStyle = "#2f8f4a";
      for (let h = 0; h < 6; h++) {
        const a = (h / 6) * Math.PI * 2 + 0.3;
        const p1 = proyectar(v, x + Math.cos(a) * 3, 6 + Math.sin(a) * 0.6 - 1.2 * Math.abs(Math.cos(a)), z + 0.2 + Math.sin(a) * 2.5);
        c.beginPath(); c.moveTo(cima.x, cima.y); c.quadraticCurveTo((cima.x + p1.x) / 2, Math.min(cima.y, p1.y) - 6, p1.x, p1.y); c.lineTo((cima.x + p1.x) / 2, (cima.y + p1.y) / 2 + 3); c.closePath(); c.fill();
      }
    } else if (k % 3 === 1) {
      const x = lado * 5.2;
      caja3d(c, v, x - 0.08, x + 0.08, 0, 5, z, z + 0.16, "#2a2a30", "#3a3a42", "#1a1a20");
      bola(c, v, x - lado * 0.4, 5, z + 0.08, 0.35, "#ffe8a8", "rgba(255, 255, 255, 0.7)");
    }
    if (k % 2 === 0) {
      const colores = ["#c96a4a", "#4a7ac9", "#c9a44a", "#7a4ac9"];
      const alto = 5 + azarFijo(sem) * 5, x = lado * 13;
      edificio(c, v, x, lado * 9, z, 10, 0, alto, colores[sem % 4]!, sem);
      // El toldo de la tienda.
      quadFrente(c, v, Math.min(x, x + lado * 9), Math.max(x, x + lado * 9), 2.6, 3.2, z - 0.05, k % 4 ? "#ff6f8f" : "#ffffff");
    }
  },
  // 2 · Cardio: edificios a la izquierda (la autopista es una tira, a la derecha).
  (c, v, lado, z, k, sem) => {
    if (lado < 0 && k % 2 === 0) edificio(c, v, -12, -10, z, 10, 0, 10 + azarFijo(sem) * 22, ["#2a3a5a", "#3a2a5a", "#2a4a5a"][sem % 3]!, sem);
    if (lado > 0 && k % 2 === 1) caja3d(c, v, 12, 13.2, 0, 7, z, z + 1.2, "#3a3550", "#4a4560", "#2a2540");
  },
  // 3 · Pesas libres (azotea): tinacos, antenas con foco y torres vecinas que suben desde abajo.
  (c, v, lado, z, k, sem, t) => {
    if (k % 4 === 0) {
      const x = lado * 7.5;
      for (const s of [-1, 1]) caja3d(c, v, x + s * 0.8 - 0.1, x + s * 0.8 + 0.1, 0, 1.5, z + 0.5, z + 0.7, "#4a4a55", "#5a5a66", "#3a3a44");
      caja3d(c, v, x - 1.1, x + 1.1, 1.5, 4.2, z, z + 2.2, "#2a2a32", "#3a3a44", "#1d1d24");
      quadFrente(c, v, x - 1.1, x + 1.1, 2.6, 2.75, z - 0.01, "#ff3d9a");
    } else if (k % 4 === 2) {
      const x = lado * 10;
      caja3d(c, v, x - 0.08, x + 0.08, 0, 12, z, z + 0.16, "#8a8f99", "#a8adb6", "#6b707a");
      bola(c, v, x, 12.2, z + 0.08, 0.3, Math.floor(t * 1.5 + sem) % 2 ? "#ff3b3b" : "#5a1010", "rgba(255, 255, 255, 0.4)");
    }
    if (k % 3 === 0) edificio(c, v, lado * (20 + azarFijo(sem) * 14), lado * 10, z, 10, -30, 25 + azarFijo(sem * 3) * 45, ["#1d2a4a", "#2a1d4a", "#1d3a4a"][sem % 3]!, sem);
  },
  // 4 · Máquinas: chimeneas con humo, grúas y engranes.
  (c, v, lado, z, k, sem, t) => {
    if (k % 5 === 0) {
      const x = lado * 17;
      caja3d(c, v, x - 1, x + 1, 0, 22, z, z + 2, "#6a5a50", "#7a6a60", "#4a3a30");
      for (const y of [18, 20]) quadFrente(c, v, x - 1, x + 1, y, y + 1, z - 0.01, "#e03a3a");
      for (let h = 0; h < 4; h++) {
        const f = (t * 0.25 + h / 4 + azarFijo(sem)) % 1;
        bola(c, v, x + lado * f * 4, 23 + f * 10, z + 1, 1.2 + f * 2.5, `rgba(170, 160, 150, ${0.55 * (1 - f)})`, "rgba(255, 255, 255, 0)");
      }
    } else if (k % 7 === 3) {
      const x = lado * 27;
      caja3d(c, v, x - 0.6, x + 0.6, 0, 30, z, z + 1.2, "#f2c230", "#ffd84a", "#c99a16");
      caja3d(c, v, Math.min(x, lado * 11), Math.max(x, lado * 11), 29, 30, z, z + 1, "#f2c230", "#ffd84a", "#c99a16");
      caja3d(c, v, Math.min(x, x + lado * 6), Math.max(x, x + lado * 6), 29, 30, z, z + 1, "#c99a16", "#ffd84a", "#a87a10");
      const g = proyectar(v, lado * 13, 29, z + 0.5), p = proyectar(v, lado * 13, 22, z + 0.5);
      c.strokeStyle = "#1a1a1a"; c.lineWidth = 1; c.beginPath(); c.moveTo(g.x, g.y); c.lineTo(p.x, p.y); c.stroke();
    }
    if (k % 4 === 1) engrane(c, v, lado * 9, 6, z, 4.5, t * 0.6 * lado + sem);
  },
  // 5 · Crossfit: contenedores apilados y pilas de llantas.
  (c, v, lado, z, k, sem) => {
    if (k % 2 === 0) {
      const colores = ["#c9402a", "#2a6ac9", "#2a9a5a", "#e08a2a", "#6a6a72"];
      const pisos = 1 + Math.floor(azarFijo(sem) * 3);
      for (let p = 0; p < pisos; p++) {
        const col = colores[(sem + p) % 5]!, x = lado * 6.5, y0 = p * 2.6;
        caja3d(c, v, Math.min(x, x + lado * 2.4), Math.max(x, x + lado * 2.4), y0, y0 + 2.6, z, z + 6, col, mezcla(col, 0.2), mezcla(col, -0.25));
        if (z > v.camZ + 4) for (let r = 0; r < 4; r++) { const xr = Math.min(x, x + lado * 2.4) + 0.3 + r * 0.55; quadFrente(c, v, xr, xr + 0.08, y0 + 0.2, y0 + 2.4, z - 0.01, "rgba(0, 0, 0, 0.25)"); }
      }
    } else if (k % 4 === 1) {
      for (let p = 0; p < 3; p++) bola(c, v, lado * 6, 0.45 + p * 0.5, z + 1, 0.6, "#1d1d22", "rgba(255, 255, 255, 0.12)");
    }
    if (k % 3 === 0) edificio(c, v, lado * 16, lado * 14, z, 12, 0, 8 + azarFijo(sem) * 6, "#3a3a46", sem, "rgba(255, 214, 140, 0.5)");
  },
  // 6 · Powerlifting: torres de reflectores (las tribunas son una tira).
  (c, v, lado, z, k, sem) => {
    if (k % 8 === 0) {
      const x = lado * 30;
      caja3d(c, v, x - 0.5, x + 0.5, 0, 34, z, z + 1, "#3a3a46", "#4a4a56", "#2a2a36");
      caja3d(c, v, Math.min(x, x - lado * 4), Math.max(x, x - lado * 4), 32, 36, z, z + 0.6, "#2a2a36", "#3a3a46", "#1a1a26");
      const centro = proyectar(v, x - lado * 2, 34, z);
      c.fillStyle = "rgba(255, 255, 230, 0.18)"; c.beginPath(); c.arc(centro.x, centro.y, centro.s * 6, 0, Math.PI * 2); c.fill();
      for (let f = 0; f < 2; f++) for (let j = 0; j < 4; j++) {
        const lx = Math.min(x, x - lado * 4) + 0.3 + j * 0.9;
        quadFrente(c, v, lx, lx + 0.7, 32.4 + f * 1.8, 33.8 + f * 1.8, z - 0.01, "#fffbe6");
      }
    }
    void sem;
  },
  // 7 · Box: los postes del ring en las esquinas (las cuerdas, el público y los reflectores son tiras).
  (c, v, lado, z, k) => {
    if (k % 4 === 0) caja3d(c, v, Math.min(lado * (PARED - 0.25), lado * (PARED + 0.05)), Math.max(lado * (PARED - 0.25), lado * (PARED + 0.05)), TECHO, TECHO + 1.6, z, z + 0.3, "#c9ced6", "#e6e9ee", "#9aa0aa");
  },
  // 8 · Olimpo: columnas doradas.
  (c, v, lado, z, k) => {
    if (k % 2 === 0) {
      const x = lado * 8;
      caja3d(c, v, x - 1, x + 1, -1, 0, z - 0.2, z + 1.4, "#d9b84a", "#f0d470", "#b8962a");
      caja3d(c, v, x - 0.7, x + 0.7, 0, 13, z, z + 1.2, "#f0cc5a", "#ffe08a", "#c9a23a");
      for (let s = 0; s < 3; s++) quadFrente(c, v, x - 0.55 + s * 0.4, x - 0.45 + s * 0.4, 0.3, 12.7, z - 0.01, "rgba(150, 110, 20, 0.35)");
      caja3d(c, v, x - 1.1, x + 1.1, 13, 14, z - 0.2, z + 1.4, "#e0bc4a", "#ffe08a", "#b8962a");
    }
  },
];

function engrane(c: CanvasRenderingContext2D, v: Vista, x: number, y: number, z: number, r: number, giro: number): void {
  const pts = [];
  const dientes = 10;
  for (let k = 0; k < dientes * 2; k++) {
    const a = giro + (k / (dientes * 2)) * Math.PI * 2, rr = k % 2 ? r * 0.82 : r;
    pts.push(proyectar(v, x, y + Math.sin(a) * rr, z + Math.cos(a) * rr));
  }
  poligono(c, pts, "#5a5f6a");
  const hueco = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; hueco.push(proyectar(v, x, y + Math.sin(a) * r * 0.3, z + Math.cos(a) * r * 0.3)); }
  poligono(c, hueco, "#2a2d34");
}

// ── Las tiras largas de algunas zonas ────────────────────────────────────────

const TIRAS: readonly (((c: CanvasRenderingContext2D, v: Vista, a: number, b: number, t: number) => void) | undefined)[] = [
  undefined,
  // 2 · Cardio: la autopista elevada, con autos que pasan (faros blancos de ida, calaveras rojas de vuelta).
  (c, v, a, b, t) => {
    caja3d(c, v, 11, 18, 7, 7.8, a, b, "#4a4560", "#5a5570", "#3a3550");
    quadPiso(c, v, 11.2, 17.8, 7.81, a, b, "#2a2838");
    quadPiso(c, v, 14.4, 14.6, 7.82, a, b, "#d9c24a");
    for (let k = 0; k < 24; k++) {
      const ida = k % 2 === 0, vel = ida ? 22 : 30;
      const z = a + ((k * 17.3 + (ida ? -1 : 1) * t * vel) % (b - a) + (b - a)) % (b - a);
      const x = ida ? 15.5 : 12.8;
      for (const s of [-0.35, 0.35]) {
        const p = proyectar(v, x + s, 8.2, z);
        c.fillStyle = ida ? "#fff8d8" : "#ff3b3b"; c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
    }
  },
  undefined,
  undefined,
  // 5 · Crossfit: una fila de foquitos colgando a cada lado.
  (c, v, a, b, t) => {
    for (const lado of [-1, 1]) for (let z = Math.ceil(a / 2) * 2; z < b && z < v.camZ + 70; z += 2) {
      const p = proyectar(v, lado * 5, 5 - Math.abs(Math.sin(z * 0.8)) * 0.4, z);
      c.fillStyle = ["#ffd45c", "#ff6fd8", "#7ef3ff"][Math.abs(Math.round(z / 2)) % 3]!;
      c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + z); c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); c.globalAlpha = 1;
    }
  },
  // 6 · Powerlifting: las tribunas escalonadas con público, y confeti cayendo.
  (c, v, a, b, t) => {
    for (const lado of [-1, 1]) {
      for (let i = 5; i >= 0; i--) {
        const x0 = lado * (6 + i * 3), x1 = lado * (6 + (i + 1) * 3), y = 3 + i * 2.6;
        caja3d(c, v, Math.min(x0, x1), Math.max(x0, x1), 0, y, a, b, "#23233a", "#2e2e4a", "#1a1a2e");
        // El público: puntitos de colores en cada escalón.
        c.fillStyle = ["#ff6fd8", "#7ef3ff", "#ffd45c", "#ffffff"][i % 4]!;
        for (let z = Math.ceil(a / 1.5) * 1.5; z < Math.min(b, v.camZ + 80); z += 1.5) {
          const p = proyectar(v, (x0 + x1) / 2 + azarFijo(z + i) * lado, y + 0.5, z);
          c.fillRect(p.x - 1, p.y - 2, 2, 3);
        }
      }
    }
    for (let k = 0; k < 40; k++) {
      const x = (azarFijo(k) - 0.5) * 40, z = v.camZ + 10 + azarFijo(k * 3) * 60, y = 20 - ((t * 3 + azarFijo(k * 7) * 20) % 20);
      const p = proyectar(v, x, y, z);
      c.fillStyle = ["#ff6fd8", "#7ef3ff", "#ffd45c", "#9dff5c"][k % 4]!; c.fillRect(p.x, p.y, 3, 2);
    }
  },
  // 7 · Box: las cuerdas del ring sobre las paredes, el público en sombra con flashes y los reflectores.
  (c, v, a, b, t) => {
    for (const lado of [-1, 1]) {
      for (let i = 4; i >= 0; i--) {
        const x0 = lado * (7 + i * 4), x1 = lado * (7 + (i + 1) * 4);
        caja3d(c, v, Math.min(x0, x1), Math.max(x0, x1), 0, 2 + i * 3, a, b, "#140c14", "#1d121d", "#0c070c");
      }
      for (let z = Math.ceil(a / 3) * 3; z < Math.min(b, v.camZ + 90); z += 3) {
        if (azarFijo(z * 1.3 + lado + Math.floor(t * 2)) < 0.85) continue;
        const p = proyectar(v, lado * (9 + azarFijo(z) * 14), 3 + azarFijo(z * 2) * 10, z);
        c.fillStyle = "#ffffff"; c.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
      ["#e03a3a", "#ffffff", "#2a5ad9"].forEach((col, i) => quadPared(c, v, lado * (PARED - 0.1), TECHO + 0.4 + i * 0.45, TECHO + 0.47 + i * 0.45, a, b, col));
    }
    // Dos reflectores que barren la pista desde arriba.
    for (const lado of [-1, 1]) {
      const zl = v.camZ + 25 + Math.sin(t * 0.7 + lado) * 8;
      const fuente = proyectar(v, lado * 12, 26, zl), pi = proyectar(v, -1.5, 0, zl + 4), pd = proyectar(v, 1.5, 0, zl + 4);
      poligono(c, [fuente, pd, pi], "rgba(255, 240, 220, 0.06)");
    }
  },
  undefined,
];
