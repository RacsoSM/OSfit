import { ALTO_BARRA, LARGO, METROS_POR_NIVEL, ZONAS, type Batido, type Obstaculo } from "../pesaRun";
import {
  CARRIL, ORILLA, PARED, TECHO, azarFijo, bola, caja3d, disco3d, mezclar, poligono, proyectar, quadFrente, quadPared, quadPiso,
  type Vista,
} from "./pesaRun3d";

/**
 * El escenario de Pesa Run (entrenador, 2026-11-27: "que el escenario se vea más detallado e
 * interesante"): el pasillo del gimnasio OSFIT. Al centro, el piso de hule en losetas con los
 * tres carriles pintados; a los lados, piso de madera con la utilería de cada zona (caminadoras
 * en Cardio, árboles de discos en Pesas libres, cajas y llantas en Crossfit, costales en Box…).
 * En las paredes, columnas con neón, espejos, ventanales a la ciudad de noche, carteles, lockers
 * y repisas; en el techo, vigas, ductos y lámparas industriales que dejan su luz en el piso.
 * Al empezar cada zona se cruza un arco con su nombre.
 *
 * Todo se pinta con figuras planas, sin sombras de canvas (`shadowBlur`), que en iPhone cuestan
 * cuadros (ver "Juegos más fluidos en iPhone").
 */

export interface Zona {
  pared: string; zocalo: string; hule: string; hule2: string; madera: string; madera2: string; techo: string; neon: string; luz: string;
}

/** Cada zona (nivel) del gimnasio, en el orden de `ZONAS`. */
export const COLORES_ZONA: readonly Zona[] = [
  { pared: "#3a2f56", zocalo: "#2a2240", hule: "#24212c", hule2: "#2b2834", madera: "#6b4a34", madera2: "#5a3d2a", techo: "#17131f", neon: "#7ef3ff", luz: "255, 244, 220" }, // Recepción
  { pared: "#25405a", zocalo: "#1b2e42", hule: "#1c222b", hule2: "#222a35", madera: "#5f4a3a", madera2: "#4f3d30", techo: "#111720", neon: "#9dff5c", luz: "225, 245, 255" }, // Cardio
  { pared: "#4d2a40", zocalo: "#371d2e", hule: "#251c20", hule2: "#2d2227", madera: "#6e4630", madera2: "#5c3a27", techo: "#1a1117", neon: "#ff6fd8", luz: "255, 236, 230" }, // Pesas libres
  { pared: "#2a4350", zocalo: "#1e313b", hule: "#1b2226", hule2: "#212a2f", madera: "#5c4b3c", madera2: "#4c3e32", techo: "#10181c", neon: "#ffd45c", luz: "255, 250, 225" }, // Máquinas
  { pared: "#4e3a26", zocalo: "#3a2b1c", hule: "#211d18", hule2: "#29241e", madera: "#74512f", madera2: "#604326", techo: "#1a1510", neon: "#ff8a3d", luz: "255, 232, 200" }, // Crossfit
  { pared: "#4a2626", zocalo: "#351b1b", hule: "#201616", hule2: "#281b1b", madera: "#6a3f2c", madera2: "#573324", techo: "#1a0f0f", neon: "#ff4d5e", luz: "255, 225, 215" }, // Powerlifting
  { pared: "#2b2f48", zocalo: "#1f2235", hule: "#181a23", hule2: "#1e212c", madera: "#57473f", madera2: "#483a33", techo: "#101219", neon: "#b48aff", luz: "235, 230, 255" }, // Box
  { pared: "#4a3a1a", zocalo: "#352a12", hule: "#1f1a10", hule2: "#272114", madera: "#7a5a2a", madera2: "#664a22", techo: "#1a150a", neon: "#ffe08a", luz: "255, 240, 200" }, // Olimpo
];

export function zonaDe(z: number): number {
  return Math.max(0, Math.min(COLORES_ZONA.length - 1, Math.floor(Math.max(0, z) / METROS_POR_NIVEL)));
}

const TRAMO = 6;
const LOSETA = 2;
/**
 * Hasta dónde se pintan los detalles (losetas, utilería, adornos, lámparas): más allá la
 * neblina casi no los deja ver, y eran cientos de figuritas que en un teléfono lento costaban
 * cuadros. Lo de base (piso, paredes, techo) y los obstáculos sí llegan hasta el fondo.
 */
export const DETALLE = 46;

type Rasgo = "espejo" | "ventana" | "cartel" | "lockers" | "rackMancuernas" | "pizarron" | "repisaPesas" | "trofeos";
type Utileria = "planta" | "garrafon" | "caminadora" | "bici" | "arbolDiscos" | "balones" | "poleas" | "cajasPlio" | "llanta" | "pilaDiscos" | "saco" | "estatua" | "kettlebells";

const RASGOS: readonly (readonly Rasgo[])[] = [
  ["lockers", "espejo", "cartel", "ventana"],
  ["ventana", "espejo", "ventana", "cartel"],
  ["rackMancuernas", "espejo", "cartel", "rackMancuernas"],
  ["espejo", "cartel", "ventana", "espejo"],
  ["pizarron", "repisaPesas", "cartel", "ventana"],
  ["cartel", "espejo", "pizarron", "rackMancuernas"],
  ["cartel", "espejo", "ventana", "cartel"],
  ["trofeos", "espejo", "trofeos", "cartel"],
];
const UTILERIA: readonly (readonly Utileria[])[] = [
  ["planta", "garrafon", "planta"],
  ["caminadora", "bici", "caminadora"],
  ["arbolDiscos", "balones", "kettlebells"],
  ["poleas", "planta", "poleas"],
  ["cajasPlio", "llanta", "kettlebells"],
  ["arbolDiscos", "pilaDiscos", "pilaDiscos"],
  ["saco", "balones", "saco"],
  ["estatua", "planta", "estatua"],
];
const CARTELES = [["NO PAIN", "NO GAIN"], ["LEG", "DAY"], ["OS", "FIT"], ["1 REP", "MÁS"], ["HIDRÁ", "TATE"], ["TÚ", "PUEDES"], ["SIN", "EXCUSAS"], ["FUERZA", ""]];

// ── El pasillo (lo que no se ordena por distancia) ───────────────────────────

export function pintarPasillo(c: CanvasRenderingContext2D, v: Vista, z: number, reloj: number): void {
  const { W, H } = v;
  const zona = COLORES_ZONA[zonaDe(z + 40)]!;
  const cerca = v.camZ + 0.3, lejos = v.lejos;
  const P = (x: number, y: number, zz: number) => proyectar(v, x, y, zz);
  c.fillStyle = "#0c0912"; c.fillRect(-20, -20, W + 40, H + 40);

  // La pared del fondo, con el letrero de neón.
  const fa = P(-PARED, TECHO, lejos), fb = P(PARED, 0, lejos);
  c.fillStyle = zona.pared; c.fillRect(fa.x, fa.y, fb.x - fa.x, fb.y - fa.y);
  neonTexto(c, "OSFIT", (fa.x + fb.x) / 2, fa.y + (fb.y - fa.y) * 0.42, Math.max(6, fa.s * 1.1), zona.neon);

  const detalle = Math.min(lejos, v.camZ + DETALLE);
  // Piso, techo y paredes de base: una figura por zona (de lejos a cerca).
  const tramos: [number, number][] = [];
  for (let n = zonaDe(lejos); n >= zonaDe(cerca); n--) tramos.push([Math.max(cerca, n * METROS_POR_NIVEL), n === zonaDe(lejos) ? lejos : Math.min(lejos, (n + 1) * METROS_POR_NIVEL)]);
  for (const [z0, z1] of tramos) {
    if (z1 <= z0) continue;
    const zn = COLORES_ZONA[zonaDe(z0)]!;
    quadPiso(c, v, -ORILLA, ORILLA, 0, z0, z1, zn.hule);
    quadPiso(c, v, -PARED, -ORILLA, 0, z0, z1, zn.madera);
    quadPiso(c, v, ORILLA, PARED, 0, z0, z1, zn.madera);
    quadPiso(c, v, -PARED, PARED, TECHO, z0, z1, zn.techo);
    for (const lado of [-1, 1]) {
      quadPared(c, v, lado * PARED, 0, TECHO, z0, z1, zn.pared);
      quadPared(c, v, lado * PARED, 0, 1, z0, z1, zn.zocalo);
      quadPared(c, v, lado * PARED, 0.97, 1.03, z0, z1, mezclar(zn.zocalo.slice(0, 7), "#ffffff", 0.18));
    }
  }

  // Las losetas de hule (de dos tonos, en damero) y las tablas de madera.
  for (let r = Math.floor(detalle / LOSETA); r >= Math.floor(cerca / LOSETA); r--) {
    const z0 = Math.max(cerca, r * LOSETA), z1 = Math.min(detalle, r * LOSETA + LOSETA);
    if (z1 <= z0) continue;
    const zn = COLORES_ZONA[zonaDe(r * LOSETA)]!;
    for (let l = -1; l <= 1; l++) if ((r + l) % 2 === 0) quadPiso(c, v, l * CARRIL - CARRIL / 2, l * CARRIL + CARRIL / 2, 0, z0, z1, zn.hule2);
    // Las juntas de la madera, escalonadas.
    for (const lado of [-1, 1]) for (let t = 0; t < 4; t++) {
      if ((r + t) % 3 !== 0) continue;
      const x = lado * (ORILLA + 0.18 + t * 0.36);
      quadPiso(c, v, x - 0.18, x + 0.18, 0.001, z0, z1, zn.madera2);
    }
  }
  // Las líneas de los carriles, a trazos, y la franja amarilla de la orilla.
  for (let r = Math.floor((detalle + 14) / LOSETA); r >= Math.floor(cerca / LOSETA); r--) {
    const z0 = Math.max(cerca, r * LOSETA), z1 = Math.min(lejos, r * LOSETA + LOSETA * 0.55);
    if (z1 <= z0) continue;
    for (const x of [-CARRIL / 2, CARRIL / 2]) quadPiso(c, v, x - 0.04, x + 0.04, 0.002, z0, z1, "rgba(240, 240, 250, 0.32)");
    for (const lado of [-1, 1]) quadPiso(c, v, lado * ORILLA - 0.06, lado * ORILLA + 0.06, 0.002, z0, z1, (r % 2) ? "#e8c13a" : "#1d1d1d");
  }

  // La luz de las lámparas en el piso.
  for (let k = Math.floor(lejos / TRAMO); k >= Math.floor(cerca / TRAMO); k--) {
    const zl = k * TRAMO + 3;
    if (zl < v.camZ + 4.5 || zl > detalle) continue;
    const zn = COLORES_ZONA[zonaDe(zl)]!;
    const a = P(0, 0, zl), lx = P(1.9, 0, zl), cn = P(0, 0, zl - 1.6), cf = P(0, 0, zl + 1.6);
    c.fillStyle = `rgba(${zn.luz}, 0.08)`;
    c.beginPath(); c.ellipse(a.x, (cn.y + cf.y) / 2, Math.abs(lx.x - a.x), Math.abs(cn.y - cf.y) / 2, 0, 0, Math.PI * 2); c.fill();
  }

  // Paredes: de lo lejano a lo cercano, cada tramo con su columna y su adorno.
  for (let k = Math.floor((detalle + 12) / TRAMO); k >= Math.floor(cerca / TRAMO) - 1; k--) {
    const z0 = k * TRAMO;
    const iz = zonaDe(z0);
    const zn = COLORES_ZONA[iz]!;
    for (const lado of [-1, 1]) {
      const sem = k * 2 + (lado > 0 ? 1 : 0);
      if (z0 + 0.9 > cerca && z0 + 5.1 < detalle) {
        const rasgo = RASGOS[iz]![Math.floor(azarFijo(sem * 3.7) * RASGOS[iz]!.length)]!;
        pintarRasgo(c, v, rasgo, lado, z0 + 0.9, z0 + 5.1, zn, sem, reloj);
      }
      // La columna, con su tira de neón.
      if (z0 + 0.5 > cerca && z0 < lejos) {
        const xi = lado * (PARED - 0.28);
        caja3d(c, v, Math.min(xi, lado * PARED), Math.max(xi, lado * PARED), 0, TECHO, z0, z0 + 0.5, mezclar(zn.pared, "#000000", 0.25), zn.pared, mezclar(zn.pared, "#000000", 0.4));
        if (z0 > cerca) quadFrente(c, v, xi - lado * 0.0, xi + lado * 0.05, 0.3, TECHO - 0.3, z0 - 0.001, zn.neon);
      }
    }
  }

  // El neón a lo largo de las paredes, abajo.
  for (const lado of [-1, 1]) {
    const x = lado * (PARED - 0.01);
    quadPared(c, v, x, 0.02, 0.09, cerca, lejos, zona.neon);
  }

  pintarTecho(c, v, cerca, lejos, detalle);

  // Neblina al fondo: tapa lo que va apareciendo.
  const nb = P(0, 0, v.camZ + (lejos - v.camZ) * 0.6), nt = P(0, TECHO, v.camZ + (lejos - v.camZ) * 0.6);
  const niebla = c.createLinearGradient(0, nt.y, 0, nb.y);
  niebla.addColorStop(0, "rgba(12, 9, 18, 0)"); niebla.addColorStop(0.5, "rgba(12, 9, 18, 0.5)"); niebla.addColorStop(1, "rgba(12, 9, 18, 0)");
  c.fillStyle = niebla; c.fillRect(0, nt.y, W, nb.y - nt.y);
}

function neonTexto(c: CanvasRenderingContext2D, texto: string, x: number, y: number, tam: number, color: string): void {
  c.save();
  c.font = `900 ${tam}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
  c.globalAlpha = 0.35; c.strokeStyle = color; c.lineWidth = Math.max(2, tam * 0.22); c.lineJoin = "round";
  c.strokeText(texto, x, y);
  c.globalAlpha = 1; c.fillStyle = "#ffffff"; c.fillText(texto, x, y);
  c.globalAlpha = 0.55; c.fillStyle = color; c.fillText(texto, x, y);
  c.restore();
}

/** Vigas, un ducto a lo largo y lámparas industriales colgando, con su cono de luz. */
function pintarTecho(c: CanvasRenderingContext2D, v: Vista, cerca: number, lejos: number, detalle: number): void {
  // El ducto plateado, con sus uniones.
  caja3d(c, v, -2.9, -2.3, TECHO - 0.75, TECHO - 0.35, v.camZ + 3, lejos, "#7b818c", "#8d939e", "#5c616b");
  for (let k = Math.floor(detalle / 3); k >= Math.floor(cerca / 3); k--) {
    const z = k * 3;
    if (z < v.camZ + 3 || z > lejos) continue;
    quadPared(c, v, -2.3, TECHO - 0.75, TECHO - 0.35, z, z + 0.12, "#4c515a");
  }
  for (let k = Math.floor((detalle + 12) / TRAMO); k >= Math.floor(cerca / TRAMO); k--) {
    const z0 = k * TRAMO;
    const zn = COLORES_ZONA[zonaDe(z0)]!;
    if (z0 > cerca + 0.5 && z0 < lejos) caja3d(c, v, -PARED, PARED, TECHO - 0.28, TECHO, z0, z0 + 0.3, "#24222c", "#2e2c37", "#1a1920");
    // La lámpara, con su cable, su pantalla y su cono de luz.
    const zl = z0 + 3;
    if (zl < v.camZ + 4.5 || zl > detalle) continue;
    const yb = TECHO - 1.0;
    const cab = proyectar(v, 0, TECHO, zl), base = proyectar(v, 0, yb + 0.3, zl);
    c.strokeStyle = "#0e0d12"; c.lineWidth = Math.max(1, cab.s * 0.02);
    c.beginPath(); c.moveTo(cab.x, cab.y); c.lineTo(base.x, base.y); c.stroke();
    const izq = proyectar(v, -0.45, yb, zl), der = proyectar(v, 0.45, yb, zl), ai = proyectar(v, -0.1, yb + 0.3, zl), ad = proyectar(v, 0.1, yb + 0.3, zl);
    // El cono de luz hasta el piso.
    const pi = proyectar(v, -1.5, 0, zl), pd = proyectar(v, 1.5, 0, zl);
    if (zl < v.camZ + 30) poligono(c, [izq, der, pd, pi], `rgba(${zn.luz}, 0.045)`);
    poligono(c, [izq, der, ad, ai], "#2b2d33");
    c.fillStyle = `rgb(${zn.luz})`;
    c.beginPath(); c.ellipse((izq.x + der.x) / 2, izq.y, (der.x - izq.x) / 2, Math.max(1, (der.x - izq.x) * 0.08), 0, 0, Math.PI * 2); c.fill();
  }
}

// ── Las paredes ──────────────────────────────────────────────────────────────

function pintarRasgo(c: CanvasRenderingContext2D, v: Vista, rasgo: Rasgo, lado: number, za: number, zb: number, zn: Zona, sem: number, reloj: number): void {
  const x = lado * (PARED - 0.01);
  const aqui = (y0: number, y1: number, z0: number, z1: number, color: string | CanvasGradient) => quadPared(c, v, x, y0, y1, z0, z1, color);
  if (rasgo === "espejo") {
    aqui(0.25, 2.85, za, zb, "#1b1c22");
    aqui(0.32, 2.78, za + 0.08, zb - 0.08, "#5f6f86");
    // Reflejos en diagonal.
    const P = (y: number, z: number) => proyectar(v, x, y, z);
    for (const [d, w] of [[0.6, 0.35], [1.4, 0.15], [2.8, 0.4]] as const) {
      const z0 = za + d, z1 = Math.min(zb - 0.1, z0 + w);
      if (z1 <= z0 + 0.05) continue;
      poligono(c, [P(0.32, z0 + 0.6), P(0.32, z1 + 0.6), P(2.78, z1 - 0.3), P(2.78, z0 - 0.3)], "rgba(220, 235, 255, 0.16)");
    }
    aqui(0.32, 0.5, za + 0.08, zb - 0.08, "rgba(0, 0, 0, 0.18)");
  } else if (rasgo === "ventana") {
    aqui(1.0, 3.2, za, zb, "#14141a");
    aqui(1.07, 3.13, za + 0.07, zb - 0.07, "#0f1a3a");
    aqui(1.07, 1.8, za + 0.07, zb - 0.07, "#1a2550");
    // La ciudad de noche: edificios y ventanas encendidas.
    for (let b = 0; b < 6; b++) {
      const z0 = za + 0.1 + b * 0.68, z1 = z0 + 0.5 + azarFijo(sem + b) * 0.2;
      if (z1 > zb - 0.07) break;
      const alto = 1.4 + azarFijo(sem * 3 + b) * 1.3;
      aqui(1.07, Math.min(3.1, alto), z0, Math.min(z1, zb - 0.07), "#222b4a");
      for (let w = 0; w < 4; w++) {
        const yw = 1.25 + w * 0.32;
        if (yw + 0.12 > alto) break;
        if (azarFijo(sem * 7 + b * 5 + w) < 0.55) aqui(yw, yw + 0.12, z0 + 0.12, z0 + 0.26, "#ffd98a");
      }
    }
    if (azarFijo(sem * 1.3) < 0.5) {
      const p = proyectar(v, x, 2.75, za + 1.2);
      c.fillStyle = "#f4f1dc"; c.beginPath(); c.ellipse(p.x, p.y, p.s * 0.08, p.s * 0.2, 0, 0, Math.PI * 2); c.fill();
    }
    // El marco en cruz.
    aqui(1.07, 3.13, (za + zb) / 2 - 0.04, (za + zb) / 2 + 0.04, "#14141a");
    aqui(2.08, 2.14, za + 0.07, zb - 0.07, "#14141a");
  } else if (rasgo === "cartel") {
    const z0 = za + 0.6, z1 = zb - 0.6;
    aqui(1.3, 2.75, z0, z1, zn.neon);
    aqui(1.36, 2.69, z0 + 0.07, z1 - 0.07, "#120f18");
    const m = proyectar(v, x, 2.02, (z0 + z1) / 2);
    if (m.s > 7) {
      const [l1, l2] = CARTELES[Math.floor(azarFijo(sem * 5.1) * CARTELES.length)]!;
      c.save();
      c.translate(m.x, m.y); c.transform(1, -lado * 0.42, 0, 1, 0, 0);
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = zn.neon;
      c.font = `900 ${Math.round(m.s * 0.36)}px system-ui, sans-serif`;
      const ancho = m.s * 1.0;
      if (l2) { c.fillText(l1, 0, -m.s * 0.2, ancho); c.fillStyle = "#ffffff"; c.fillText(l2, 0, m.s * 0.22, ancho); }
      else c.fillText(l1, 0, 0, ancho);
      c.restore();
    }
  } else if (rasgo === "lockers") {
    const n = 6, paso = (zb - za) / n;
    for (let k = 0; k < n; k++) {
      const z0 = za + k * paso, z1 = z0 + paso - 0.04;
      aqui(0.1, 2.3, z0, z1, k % 2 ? "#3c6fb0" : "#4a82c6");
      for (const y of [1.9, 1.8, 1.7]) aqui(y, y + 0.04, z0 + 0.1, z1 - 0.1, "rgba(0, 0, 0, 0.35)");
      aqui(1.1, 1.3, z1 - 0.15, z1 - 0.08, "#d8dde4");
    }
  } else if (rasgo === "rackMancuernas" || rasgo === "repisaPesas" || rasgo === "trofeos") {
    const xr = x - lado * 0.45;
    const repisas = rasgo === "rackMancuernas" ? [0.55, 1.05] : [1.2];
    for (const y of repisas) {
      caja3d(c, v, Math.min(x, xr), Math.max(x, xr), y - 0.06, y, za, zb, "#3a3e47", "#565b66", "#2a2d34");
      const n = 6;
      for (let k = 0; k < n; k++) {
        const zc = za + 0.35 + k * ((zb - za - 0.7) / (n - 1));
        const xc = x - lado * 0.22;
        if (rasgo === "rackMancuernas") {
          const col = ["#e03a52", "#2f7fe0", "#f2c230", "#3bb36a", "#2b2d33", "#ff6fd8"][(k + (y > 1 ? 2 : 0)) % 6]!;
          bola(c, v, xc, y + 0.1, zc - 0.13, 0.1, col);
          bola(c, v, xc, y + 0.1, zc + 0.13, 0.1, col);
        } else if (rasgo === "repisaPesas") {
          const col = ["#2b2d33", "#e03a52", "#f2c230", "#2f7fe0"][k % 4]!;
          bola(c, v, xc, y + 0.15, zc, 0.15, col);
          const p = proyectar(v, xc, y + 0.32, zc);
          c.strokeStyle = col; c.lineWidth = Math.max(1, p.s * 0.05);
          c.beginPath(); c.arc(p.x, p.y, p.s * 0.1, Math.PI, 0); c.stroke();
        } else {
          const p = proyectar(v, xc, y + 0.2, zc);
          c.fillStyle = "#e9b93a";
          c.beginPath(); c.moveTo(p.x - p.s * 0.12, p.y - p.s * 0.15); c.lineTo(p.x + p.s * 0.12, p.y - p.s * 0.15); c.quadraticCurveTo(p.x + p.s * 0.1, p.y + p.s * 0.05, p.x, p.y + p.s * 0.08); c.quadraticCurveTo(p.x - p.s * 0.1, p.y + p.s * 0.05, p.x - p.s * 0.12, p.y - p.s * 0.15); c.fill();
          c.fillRect(p.x - p.s * 0.03, p.y + p.s * 0.06, p.s * 0.06, p.s * 0.08);
          c.fillStyle = "#b8862a"; c.fillRect(p.x - p.s * 0.08, p.y + p.s * 0.13, p.s * 0.16, p.s * 0.05);
          c.fillStyle = "rgba(255, 255, 255, 0.4)"; c.fillRect(p.x - p.s * 0.08, p.y - p.s * 0.12, p.s * 0.03, p.s * 0.12);
        }
      }
    }
    if (rasgo === "trofeos") neonPared(c, v, x, lado, 2.3, (za + zb) / 2, "CAMPEONES", zn.neon);
  } else if (rasgo === "pizarron") {
    aqui(1.0, 2.7, za + 0.5, zb - 0.5, "#c9ccd3");
    aqui(1.05, 2.65, za + 0.55, zb - 0.55, "#f4f5f7");
    for (let k = 0; k < 6; k++) {
      const y = 2.3 - k * 0.22;
      aqui(y, y + 0.06, za + 0.8, za + 0.8 + 0.6 + azarFijo(sem + k) * 1.6, k === 0 ? "#e03a52" : "#2a3b7a");
    }
    neonPared(c, v, x, lado, 2.45, za + 1.0, "WOD", "#e03a52", true);
  }
  void reloj;
}

function neonPared(c: CanvasRenderingContext2D, v: Vista, x: number, lado: number, y: number, z: number, texto: string, color: string, plano = false): void {
  const m = proyectar(v, x, y, z);
  if (m.s < 7) return;
  c.save();
  c.translate(m.x, m.y); c.transform(1, -lado * 0.42, 0, 1, 0, 0);
  c.textAlign = plano ? "left" : "center"; c.textBaseline = "middle"; c.fillStyle = color;
  c.font = `900 ${Math.round(m.s * 0.24)}px system-ui, sans-serif`;
  c.fillText(texto, 0, 0, m.s * 2.4);
  c.restore();
}

// ── Lo que se ordena por distancia (utilería, arcos, obstáculos, batidos) ────

export interface Cosa { z: number; pintar: () => void }

/** La utilería del piso de madera y el arco de cada zona, para ordenarse con lo demás. */
export function cosasDeEscena(c: CanvasRenderingContext2D, v: Vista, reloj: number): Cosa[] {
  const cosas: Cosa[] = [];
  const cerca = v.camZ + 0.6;
  for (let k = Math.floor(Math.min(v.lejos, v.camZ + DETALLE) / TRAMO); k >= Math.floor(cerca / TRAMO) - 1; k--) {
    const z0 = k * TRAMO;
    const iz = zonaDe(z0);
    for (const lado of [-1, 1]) {
      const sem = k * 2 + (lado > 0 ? 1 : 0) + 101;
      if (azarFijo(sem * 1.7) > 0.8) continue;
      const tipo = UTILERIA[iz]![Math.floor(azarFijo(sem * 2.3) * UTILERIA[iz]!.length)]!;
      const z = z0 + 1.6 + azarFijo(sem * 4.1) * 1.6;
      if (z < cerca || z > v.camZ + DETALLE) continue;
      cosas.push({ z, pintar: () => pintarUtileria(c, v, tipo, lado, z, sem, reloj) });
    }
  }
  // El arco de cada zona.
  for (let n = 1; n < ZONAS.length; n++) {
    const z = n * METROS_POR_NIVEL;
    if (z > cerca + 0.5 && z < v.lejos) cosas.push({ z, pintar: () => pintarArco(c, v, z, n) });
  }
  return cosas;
}

function pintarArco(c: CanvasRenderingContext2D, v: Vista, z: number, n: number): void {
  const zn = COLORES_ZONA[n]!;
  for (const lado of [-1, 1]) caja3d(c, v, lado * 2.35 - 0.18, lado * 2.35 + 0.18, 0, 3.4, z, z + 0.36, "#1d1b24", "#2b2833", "#15141a");
  caja3d(c, v, -2.53, 2.53, 2.95, 3.55, z, z + 0.36, "#1d1b24", "#2b2833", "#15141a");
  quadFrente(c, v, -2.45, 2.45, 3.0, 3.06, z - 0.001, zn.neon);
  quadFrente(c, v, -2.45, 2.45, 3.44, 3.5, z - 0.001, zn.neon);
  for (const lado of [-1, 1]) quadFrente(c, v, lado * 2.35 - 0.04, lado * 2.35 + 0.04, 0.1, 2.95, z - 0.001, zn.neon);
  const m = proyectar(v, 0, 3.25, z);
  if (m.s > 4) neonTexto(c, `ZONA ${ZONAS[n]!.toUpperCase()}`, m.x, m.y, Math.max(5, m.s * 0.3), zn.neon);
}

function pintarUtileria(c: CanvasRenderingContext2D, v: Vista, tipo: Utileria, lado: number, z: number, sem: number, reloj: number): void {
  const X = lado * 2.98;
  const dentro = X - lado * 0.5, fuera = X + lado * 0.5;
  const x0 = Math.min(dentro, fuera), x1 = Math.max(dentro, fuera);
  const sombra = () => quadPiso(c, v, x0 + 0.05, x1 - 0.05, 0.003, z - 0.1, z + 0.6, "rgba(0, 0, 0, 0.25)");
  switch (tipo) {
    case "planta": {
      sombra();
      caja3d(c, v, X - 0.24, X + 0.24, 0, 0.5, z, z + 0.45, "#c26a3d", "#a95a31", "#8f4b28");
      quadFrente(c, v, X - 0.24, X + 0.24, 0.42, 0.5, z - 0.001, "#d9804f");
      const verdes = ["#2f8f4a", "#3fae5a", "#24753c", "#55c46b"];
      for (let k = 0; k < 7; k++) bola(c, v, X + (azarFijo(sem + k) - 0.5) * 0.5, 0.75 + azarFijo(sem * 2 + k) * 0.7, z + 0.2, 0.17 + azarFijo(k) * 0.08, verdes[k % 4]!, "rgba(255, 255, 255, 0.1)");
      break;
    }
    case "garrafon": {
      sombra();
      caja3d(c, v, X - 0.22, X + 0.22, 0, 1.0, z, z + 0.4, "#e6e9ee", "#f4f6f9", "#c3c8d0");
      quadFrente(c, v, X - 0.12, X + 0.12, 0.7, 0.85, z - 0.001, "#2a2d33");
      bola(c, v, X, 1.28, z + 0.2, 0.24, "rgba(110, 180, 255, 0.75)", "rgba(255, 255, 255, 0.5)");
      break;
    }
    case "caminadora": {
      quadPiso(c, v, x0, x1, 0.003, z - 0.1, z + 2.0, "rgba(0, 0, 0, 0.25)");
      caja3d(c, v, X - 0.38, X + 0.38, 0, 0.22, z, z + 1.9, "#2a2c33", "#3b3e47", "#1f2126");
      quadPiso(c, v, X - 0.3, X + 0.3, 0.221, Math.max(z, v.camZ + 0.5), z + 1.6, "#15161a");
      for (const s of [-1, 1]) caja3d(c, v, X + s * 0.34 - 0.04, X + s * 0.34 + 0.04, 0.2, 1.3, z + 1.65, z + 1.75, "#565b66", "#6a707b", "#41454e");
      caja3d(c, v, X - 0.4, X + 0.4, 1.25, 1.5, z + 1.6, z + 1.8, "#2a2c33", "#3b3e47", "#1f2126");
      quadFrente(c, v, X - 0.25, X + 0.25, 1.3, 1.45, z + 1.6 - 0.001, (Math.floor(reloj * 2 + sem) % 2) ? "#7ef3ff" : "#4fd6e8");
      break;
    }
    case "bici": {
      sombra();
      caja3d(c, v, X - 0.25, X + 0.25, 0, 0.08, z, z + 1.0, "#2a2c33", "#3b3e47", "#1f2126");
      disco3d(c, v, X, 0.38, z + 0.75, 0.3, 0.08, "#c9ced6", "#6a707b");
      caja3d(c, v, X - 0.04, X + 0.04, 0.08, 0.95, z + 0.25, z + 0.33, "#e03a52", "#f04b62", "#b02c40");
      caja3d(c, v, X - 0.13, X + 0.13, 0.95, 1.02, z + 0.12, z + 0.42, "#1d1e22", "#2b2d33", "#141518");
      caja3d(c, v, X - 0.04, X + 0.04, 0.4, 1.15, z + 0.85, z + 0.93, "#e03a52", "#f04b62", "#b02c40");
      caja3d(c, v, X - 0.26, X + 0.26, 1.12, 1.18, z + 0.8, z + 0.88, "#1d1e22", "#2b2d33", "#141518");
      break;
    }
    case "arbolDiscos": {
      sombra();
      caja3d(c, v, X - 0.3, X + 0.3, 0, 0.06, z, z + 0.6, "#2a2c33", "#3b3e47", "#1f2126");
      caja3d(c, v, X - 0.05, X + 0.05, 0.06, 1.35, z + 0.25, z + 0.35, "#3b3e47", "#4b505b", "#2b2e35");
      const cols: [string, string][] = [["#e03a52", "#9e2738"], ["#2f7fe0", "#21589e"], ["#f2c230", "#a8861f"], ["#3bb36a", "#287a48"]];
      for (const [k, y] of [0.45, 0.95].entries()) {
        for (const s of [-1, 1]) {
          const [a, b] = cols[(k * 2 + (s > 0 ? 1 : 0) + sem) % 4]!;
          disco3d(c, v, X + s * 0.16, y, z + 0.3, 0.32 - k * 0.06, 0.07, a, b);
        }
      }
      break;
    }
    case "pilaDiscos": {
      sombra();
      const cols = ["#e03a52", "#e03a52", "#2f7fe0", "#2f7fe0", "#f2c230", "#3bb36a"];
      for (let k = 0; k < 6; k++) {
        const r = 0.42 - k * 0.035;
        caja3d(c, v, X - r, X + r, k * 0.07, k * 0.07 + 0.065, z + 0.42 - r, z + 0.42 + r, cols[k]!, mezclar(cols[k]!, "#ffffff", 0.15), mezclar(cols[k]!, "#000000", 0.3));
      }
      caja3d(c, v, X - 0.05, X + 0.05, 0.42, 0.55, z + 0.37, z + 0.47, "#c9ced6", "#e6e9ee", "#9aa0aa");
      break;
    }
    case "balones": {
      sombra();
      caja3d(c, v, X - 0.3, X + 0.3, 0, 0.5, z, z + 1.3, "#2a2c33", "#3b3e47", "#1f2126");
      const cols = ["#e03a52", "#2f7fe0", "#3bb36a", "#f2c230"];
      for (let k = 0; k < 3; k++) bola(c, v, X, 0.72, z + 1.1 - k * 0.42, 0.21, cols[(k + sem) % 4]!);
      break;
    }
    case "kettlebells": {
      sombra();
      const cols = ["#2b2d33", "#e03a52", "#f2c230", "#2f7fe0"];
      for (let k = 2; k >= 0; k--) {
        const zk = z + k * 0.5, col = cols[(k + sem) % 4]!;
        bola(c, v, X, 0.2, zk, 0.2, col);
        const p = proyectar(v, X, 0.48, zk);
        c.strokeStyle = col; c.lineWidth = Math.max(1, p.s * 0.06);
        c.beginPath(); c.arc(p.x, p.y, p.s * 0.12, Math.PI, 0); c.stroke();
      }
      break;
    }
    case "poleas": {
      sombra();
      for (const s of [-1, 1]) caja3d(c, v, X + s * 0.35 - 0.05, X + s * 0.35 + 0.05, 0, 2.4, z + 0.1, z + 0.2, "#3b3e47", "#4b505b", "#2b2e35");
      caja3d(c, v, X - 0.4, X + 0.4, 2.3, 2.42, z + 0.1, z + 0.2, "#3b3e47", "#4b505b", "#2b2e35");
      caja3d(c, v, X - 0.22, X + 0.22, 0.1, 1.2, z + 0.25, z + 0.4, "#20222a", "#2b2d33", "#15161a");
      for (let k = 0; k < 9; k++) quadFrente(c, v, X - 0.22, X + 0.22, 0.12 + k * 0.12, 0.14 + k * 0.12, z + 0.25 - 0.001, "#4b505b");
      const p = proyectar(v, X, 2.2, z + 0.12);
      c.fillStyle = "#c9ced6"; c.beginPath(); c.arc(p.x, p.y, p.s * 0.08, 0, Math.PI * 2); c.fill();
      const q = proyectar(v, X, 1.2, z + 0.32);
      c.strokeStyle = "#111"; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke();
      break;
    }
    case "cajasPlio": {
      sombra();
      caja3d(c, v, X - 0.42, X + 0.42, 0, 0.6, z, z + 0.7, "#c8955a", "#ddab6f", "#a87a45");
      caja3d(c, v, X - 0.32, X + 0.32, 0.6, 1.05, z + 0.1, z + 0.6, "#d4a066", "#e8b77c", "#b2854f");
      quadFrente(c, v, X - 0.15, X + 0.15, 0.38, 0.46, z - 0.001, "#5a3d22");
      quadFrente(c, v, X - 0.12, X + 0.12, 0.85, 0.92, z + 0.1 - 0.001, "#5a3d22");
      break;
    }
    case "llanta": {
      sombra();
      disco3d(c, v, X, 0.6, z + 0.5, 0.6, 0.35, "#26272c", "#121316");
      break;
    }
    case "saco": {
      const xs = X - lado * 0.15;
      const vaiven = Math.sin(reloj * 1.6 + sem) * 0.04;
      const top = proyectar(v, xs, TECHO, z + 0.3), cad = proyectar(v, xs + vaiven, 2.25, z + 0.3);
      c.strokeStyle = "#8a8f99"; c.lineWidth = Math.max(1, top.s * 0.025);
      c.beginPath(); c.moveTo(top.x, top.y); c.lineTo(cad.x, cad.y); c.stroke();
      caja3d(c, v, xs + vaiven - 0.24, xs + vaiven + 0.24, 0.85, 2.25, z + 0.06, z + 0.54, "#b8283b", "#d03548", "#8c1e2d");
      quadFrente(c, v, xs + vaiven - 0.24, xs + vaiven + 0.24, 1.95, 2.05, z + 0.06 - 0.001, "#1d1d1d");
      quadFrente(c, v, xs + vaiven - 0.24, xs + vaiven + 0.24, 1.05, 1.15, z + 0.06 - 0.001, "#1d1d1d");
      break;
    }
    case "estatua": {
      sombra();
      caja3d(c, v, X - 0.32, X + 0.32, 0, 1.0, z, z + 0.6, "#e9e4d8", "#f6f2e8", "#c9c3b5");
      quadFrente(c, v, X - 0.36, X + 0.36, 0.9, 1.0, z - 0.002, "#d8d1c0");
      // Una mancuerna dorada en su pedestal.
      caja3d(c, v, X - 0.25, X + 0.25, 1.18, 1.24, z + 0.25, z + 0.33, "#f5d76e", "#ffe89a", "#c9a53a");
      for (const s of [-1, 1]) caja3d(c, v, X + s * 0.25 - 0.08, X + s * 0.25 + 0.08, 1.02, 1.4, z + 0.15, z + 0.43, "#e9b93a", "#ffd76a", "#b8862a");
      break;
    }
  }
}

// ── Obstáculos y batidos ─────────────────────────────────────────────────────

/** La banca plana (o, a veces, dos cajas de salto): se salta. */
export function pintarBanca(c: CanvasRenderingContext2D, v: Vista, o: Obstaculo): void {
  const x = o.carril * CARRIL, z0 = o.z, z1 = o.z + LARGO.banca;
  quadPiso(c, v, x - 0.6, x + 0.6, 0.004, Math.max(z0 - 0.1, v.camZ + 0.5), z1 + 0.1, "rgba(0, 0, 0, 0.3)");
  if (azarFijo(o.z * 1.31 + o.carril) < 0.35) {
    // Cajas pliométricas de madera.
    caja3d(c, v, x - 0.55, x + 0.55, 0, 0.3, z0, z1, "#c8955a", "#ddab6f", "#a87a45");
    caja3d(c, v, x - 0.5, x + 0.5, 0.3, 0.56, z0 + 0.1, z1 - 0.1, "#d4a066", "#e8b77c", "#b2854f");
    quadFrente(c, v, x - 0.18, x + 0.18, 0.12, 0.2, z0 - 0.001, "#5a3d22");
    quadFrente(c, v, x - 0.16, x + 0.16, 0.39, 0.46, z0 + 0.1 - 0.001, "#5a3d22");
    return;
  }
  const acero = ["#2c2f37", "#3d414b", "#1f2127"] as const;
  for (const zp of [z0 + 0.12, z1 - 0.3]) {
    caja3d(c, v, x - 0.42, x + 0.42, 0, 0.07, zp - 0.05, zp + 0.23, ...acero);
    caja3d(c, v, x - 0.07, x + 0.07, 0.07, 0.38, zp, zp + 0.14, ...acero);
  }
  caja3d(c, v, x - 0.07, x + 0.07, 0.3, 0.38, z0 + 0.12, z1 - 0.16, ...acero);
  // El cojín, con su costura.
  caja3d(c, v, x - 0.36, x + 0.36, 0.38, 0.58, z0, z1, "#b8243a", "#d8394f", "#8a1a2b");
  quadPiso(c, v, x - 0.3, x + 0.3, 0.581, Math.max(z0 + 0.06, v.camZ + 0.5), z1 - 0.06, "#cf3249");
  quadFrente(c, v, x - 0.3, x + 0.3, 0.52, 0.535, z0 - 0.001, "rgba(255, 255, 255, 0.35)");
  quadFrente(c, v, x - 0.36, x + 0.36, 0.38, 0.4, z0 - 0.001, "rgba(0, 0, 0, 0.3)");
}

/** Franjas de cuidado amarillas y negras en un frente. */
function cuidado(c: CanvasRenderingContext2D, v: Vista, x0: number, x1: number, y0: number, y1: number, z: number, n: number): void {
  for (let k = 0; k < n; k++) quadFrente(c, v, x0, x1, y0 + ((y1 - y0) * k) / n, y0 + ((y1 - y0) * (k + 1)) / n, z, k % 2 ? "#1b1b1b" : "#f2c230");
}

/** La barra en sus soportes, a la altura del pecho: se pasa barriéndose. */
export function pintarBarra(c: CanvasRenderingContext2D, v: Vista, o: Obstaculo): void {
  const x = o.carril * CARRIL, z = o.z;
  const y = ALTO_BARRA + 0.06;
  for (const lado of [-1, 1]) {
    const xp = x + lado * 0.62;
    caja3d(c, v, xp - 0.2, xp + 0.2, 0, 0.05, z - 0.05, z + 0.35, "#262931", "#3a3e48", "#1b1d22");
    caja3d(c, v, xp - 0.05, xp + 0.05, 0.05, y + 0.35, z + 0.1, z + 0.2, "#262931", "#3a3e48", "#1b1d22");
    cuidado(c, v, xp - 0.05, xp + 0.05, 0.3, y - 0.15, z + 0.1 - 0.001, 6);
    // El gancho (J-hook) donde descansa la barra.
    caja3d(c, v, xp - 0.07, xp + 0.07, y - 0.1, y - 0.03, z + 0.03, z + 0.2, "#4b505b", "#5d636e", "#3a3e48");
  }
  caja3d(c, v, x - 1.0, x + 1.0, y - 0.03, y + 0.03, z + 0.12, z + 0.18, "#c7cbd3", "#eef0f4", "#9aa0aa");
  for (const lado of [-1, 1]) {
    disco3d(c, v, x + lado * 0.8, y, z + 0.15, 0.4, 0.08, "#2f7fe0", "#1d4f8f");
    disco3d(c, v, x + lado * 0.9, y, z + 0.15, 0.3, 0.07, "#f2c230", "#a8861f");
  }
}

/** El rack de sentadillas, una jaula con su barra cargada: solo se esquiva. */
export function pintarRack(c: CanvasRenderingContext2D, v: Vista, o: Obstaculo): void {
  const x = o.carril * CARRIL, z0 = o.z, z1 = o.z + LARGO.rack, alto = 2.4;
  const acero = ["#30343d", "#464b56", "#22252b"] as const;
  const poste = (px: number, pz: number, agujeros: boolean) => {
    caja3d(c, v, px - 0.07, px + 0.07, 0, alto, pz, pz + 0.14, ...acero);
    if (agujeros) for (let k = 0; k < 12; k++) {
      const yh = 0.4 + k * 0.15;
      quadFrente(c, v, px - 0.018, px + 0.018, yh, yh + 0.04, pz - 0.001, "#101115");
    }
  };
  quadPiso(c, v, x - 0.75, x + 0.75, 0.004, Math.max(z0, v.camZ + 0.5), z1 + 0.1, "rgba(0, 0, 0, 0.3)");
  poste(x - 0.64, z1 - 0.14, false); poste(x + 0.64, z1 - 0.14, false);
  caja3d(c, v, x - 0.64, x + 0.64, alto - 0.12, alto, z1 - 0.14, z1, ...acero);
  // La plataforma de madera del piso.
  caja3d(c, v, x - 0.72, x + 0.72, 0, 0.05, z0, z1, "#8a6a45", "#a47e54", "#6e5436");
  for (const lado of [-1, 1]) caja3d(c, v, x + lado * 0.64 - 0.04, x + lado * 0.64 + 0.04, 0.72, 0.8, z0, z1, "#9aa0aa", "#c7cbd3", "#6b707a");
  // La barra cargada adentro.
  const y = 1.45, zb = (z0 + z1) / 2;
  caja3d(c, v, x - 0.95, x + 0.95, y - 0.03, y + 0.03, zb - 0.03, zb + 0.03, "#c7cbd3", "#eef0f4", "#9aa0aa");
  for (const lado of [-1, 1]) {
    disco3d(c, v, x + lado * 0.74, y, zb, 0.44, 0.08, "#e03a52", "#9e2738");
    disco3d(c, v, x + lado * 0.83, y, zb, 0.44, 0.08, "#e03a52", "#9e2738");
    disco3d(c, v, x + lado * 0.91, y, zb, 0.3, 0.06, "#3bb36a", "#287a48");
  }
  poste(x - 0.64, z0, true); poste(x + 0.64, z0, true);
  caja3d(c, v, x - 0.64, x + 0.64, alto - 0.12, alto, z0, z0 + 0.14, ...acero);
  // La barra de dominadas, adelante, y el letrero de alto.
  caja3d(c, v, x - 0.7, x + 0.7, alto - 0.04, alto + 0.02, z0 - 0.12, z0 - 0.06, "#c7cbd3", "#eef0f4", "#9aa0aa");
  const p = proyectar(v, x, alto - 0.38, z0);
  if (p.s > 8) {
    const w = p.s * 0.62, h = p.s * 0.22;
    c.fillStyle = "#ffffff"; c.fillRect(p.x - w / 2 - p.s * 0.02, p.y - h / 2 - p.s * 0.02, w + p.s * 0.04, h + p.s * 0.04);
    c.fillStyle = "#e0283e"; c.fillRect(p.x - w / 2, p.y - h / 2, w, h);
    c.fillStyle = "#fff"; c.font = `900 ${Math.round(h * 0.68)}px system-ui, sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("RACK", p.x, p.y + h * 0.04);
  }
}

/** Un batido de proteína: el shaker con su líquido, su tapa y su asa; gira, flota y brilla. */
export function pintarBatido(c: CanvasRenderingContext2D, v: Vista, b: Batido, reloj: number): void {
  const flota = Math.sin(reloj * 4 + b.z) * 0.06;
  const p = proyectar(v, b.carril * CARRIL, b.alto + flota, b.z);
  const giro = Math.cos(reloj * 3 + b.z * 0.7);
  const w = p.s * 0.26 * (0.55 + 0.45 * Math.abs(giro)), h = p.s * 0.42;
  // Brillo de atrás.
  const halo = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, h * 0.95);
  halo.addColorStop(0, "rgba(255, 111, 216, 0.45)"); halo.addColorStop(1, "rgba(255, 111, 216, 0)");
  c.fillStyle = halo; c.fillRect(p.x - h, p.y - h, h * 2, h * 2);
  // El vaso transparente y el batido rosa adentro.
  c.fillStyle = "rgba(235, 245, 255, 0.55)";
  c.beginPath(); c.roundRect(p.x - w / 2, p.y - h / 2, w, h, w * 0.25); c.fill();
  c.fillStyle = "#ff5fc8";
  c.beginPath(); c.roundRect(p.x - w * 0.44, p.y - h * 0.12, w * 0.88, h * 0.58, w * 0.2); c.fill();
  c.fillStyle = "#ffb3e6"; c.fillRect(p.x - w * 0.44, p.y - h * 0.12, w * 0.88, Math.max(1, h * 0.05));
  // La etiqueta.
  c.fillStyle = "#ffffff"; c.fillRect(p.x - w * 0.5, p.y + h * 0.05, w, h * 0.15);
  if (p.s > 30 && Math.abs(giro) > 0.5) {
    c.fillStyle = "#e0283e"; c.font = `900 ${Math.round(h * 0.11)}px system-ui, sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("PRO", p.x, p.y + h * 0.13, w * 0.9);
  }
  // La tapa negra, con su boquilla y su asa.
  c.fillStyle = "#24262c";
  c.beginPath(); c.roundRect(p.x - w * 0.56, p.y - h * 0.64, w * 1.12, h * 0.18, w * 0.1); c.fill();
  c.fillRect(p.x - w * 0.14, p.y - h * 0.76, w * 0.28, h * 0.13);
  c.strokeStyle = "#24262c"; c.lineWidth = Math.max(1, w * 0.1);
  c.beginPath(); c.arc(p.x + w * 0.5 * Math.sign(giro || 1), p.y - h * 0.56, h * 0.1, -Math.PI / 2, Math.PI / 2); c.stroke();
  // El reflejo.
  c.fillStyle = "rgba(255, 255, 255, 0.6)"; c.fillRect(p.x - w * 0.32, p.y - h * 0.4, Math.max(1, w * 0.1), h * 0.7);
  // Destellos que giran.
  for (let k = 0; k < 2; k++) {
    const a = reloj * 2.5 + k * Math.PI + b.z;
    const sx = p.x + Math.cos(a) * h * 0.55, sy = p.y + Math.sin(a) * h * 0.4;
    estrella(c, sx, sy, h * 0.09, "#fff6c9");
  }
}

export function estrella(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  c.fillStyle = color;
  c.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, rr = k % 2 ? r * 0.35 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath(); c.fill();
}

/** Las líneas de velocidad en las orillas: aparecen cuando ya se va rápido. */
export function lineasVelocidad(c: CanvasRenderingContext2D, v: Vista, vel: number): void {
  const f = Math.max(0, Math.min(1, (vel - 16) / 10));
  if (f <= 0) return;
  const cx = v.W / 2, cy = v.hz;
  c.strokeStyle = `rgba(255, 255, 255, ${0.18 * f})`; c.lineWidth = 1.5;
  c.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = Math.random() * Math.PI * 2;
    const r0 = Math.max(v.W, v.H) * (0.45 + Math.random() * 0.2), r1 = r0 + 40 + Math.random() * 80;
    c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
  }
  c.stroke();
}

