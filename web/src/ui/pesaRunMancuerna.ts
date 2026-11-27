import type { Carrera } from "../pesaRun";
import { CARRIL, proyectar, type Vista } from "./pesaRun3d";
import { estrella } from "./pesaRunEscena";

/**
 * La protagonista de Correle pa (entrenador, 2026-11-27: eligió la "Chibi compacta" de las
 * propuestas ninja neón). Una mancuerna parada con proporciones de chibi: el disco de arriba es
 * una cabeza enorme, negro mate con filo rosa; en vez de cara, una visera oscura con dos ojos de
 * luz cian; una cinta de luz cian con sus puntas largas al viento; el mango cromado, cortito, es
 * el cuerpo; el disco de abajo, chico, las caderas; y dos patitas negras con botines de suela
 * rosa.
 *
 * Los gestos están en la luz de la visera: ojos rasgados al correr, redondos al saltar, una
 * rayita al barrerse, ^ ^ al tomar un batido, redondos con gotita de sudor si viene algo encima
 * y en cruz al chocar. Rebota al correr, se estira al saltar, se aplasta al caer y se agacha al
 * barrerse.
 */

export type Gesto = "corre" | "salta" | "barre" | "feliz" | "susto" | "mareo";

export interface AnimMancuerna {
  reloj: number;
  gesto: Gesto;
  /** De 1 a 0 tras caer de un salto (para aplastarse). */
  aterrizaje: number;
  /** Suda en los niveles altos. */
  suda: boolean;
}

/** Metros que mide de alto la unidad del dibujo (la cabeza llega a ~1.36). */
const TAM = 0.9;
const CIAN = "#7ef3ff", CIAN2 = "#3fc6d8", ROSA = "#ff3d9a", NEGRO = "#16151c", NEGRO2 = "#0b0a10";
const TAU = Math.PI * 2;

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath(); c.roundRect(x, y, w, h, r);
}

export function pintarMancuerna(c: CanvasRenderingContext2D, v: Vista, car: Carrera, a: AnimMancuerna): void {
  const x = car.x * CARRIL;
  const piso = proyectar(v, x, car.suelo, car.z);
  const pies = proyectar(v, x, car.y, car.z);
  const s = piso.s * TAM;
  const barriendo = car.barrida > 0 && !car.terminada;
  const sobre = car.y - car.suelo;
  const enAire = sobre > 0.01;
  const fase = car.z * 2.4;
  const corriendo = !enAire && !barriendo && !car.terminada;
  const bote = corriendo ? Math.abs(Math.cos(fase)) * 0.06 : 0;

  // La sombra en el piso: más chica entre más alto va.
  const sombra = Math.max(0.35, 1 - sobre * 0.35);
  c.fillStyle = "rgba(0, 0, 0, 0.42)";
  c.beginPath(); c.ellipse(piso.x, piso.y, s * 0.55 * sombra, s * 0.11 * sombra, 0, 0, TAU); c.fill();

  let sx = 1, sy = 1;
  if (a.aterrizaje > 0) { sx += 0.16 * a.aterrizaje; sy -= 0.16 * a.aterrizaje; }
  else if (enAire && car.vy > 0) { sx = 0.94; sy = 1.08; }

  c.save();
  c.translate(pies.x, pies.y);
  // Se inclina hacia donde se cambia de carril; al chocar, se bambolea.
  c.rotate((car.carril - car.x) * 0.3 + (car.terminada ? Math.sin(a.reloj * 3) * 0.1 : 0));
  c.scale(s * sx, s * sy);
  c.translate(0, -bote);
  c.lineCap = "round"; c.lineJoin = "round";

  // Lo alto de cada parte (y hacia arriba es negativo): al barrerse, todo más abajo.
  const cadera = barriendo ? -0.12 : -0.27;
  const cuelloArriba = barriendo ? -0.38 : -0.6;
  const cy = barriendo ? -0.72 : -1.0;
  const viento = Math.min(1, car.vel / 20);

  patas(c, car, fase, barriendo, enAire, cadera);
  // Caderas: el disco chico.
  c.fillStyle = NEGRO2; rr(c, -0.24, cadera - 0.07, 0.48, 0.16, 0.07); c.fill();
  c.fillStyle = NEGRO; rr(c, -0.24, cadera - 0.09, 0.48, 0.13, 0.065); c.fill();
  c.fillStyle = ROSA; c.fillRect(-0.2, cadera + 0.02, 0.4, 0.014);
  // El mango cromado.
  const g = c.createLinearGradient(-0.075, 0, 0.075, 0);
  g.addColorStop(0, "#5d646f"); g.addColorStop(0.45, "#e9edf2"); g.addColorStop(1, "#555c67");
  c.fillStyle = g; rr(c, -0.075, cuelloArriba, 0.15, cadera - 0.06 - cuelloArriba, 0.04); c.fill();
  c.strokeStyle = "rgba(0, 0, 0, 0.2)"; c.lineWidth = 0.008;
  for (let y = cuelloArriba + 0.04; y < cadera - 0.09; y += 0.045) { c.beginPath(); c.moveTo(-0.065, y); c.lineTo(0.065, y + 0.02); c.stroke(); }
  // Las puntas de la cinta de luz, detrás de la cabeza.
  puntas(c, 0.55, cy - 0.15, a.reloj, car.terminada ? 0.3 : 0.45 + viento * 0.35, car.terminada ? 0.2 : 0.4 + viento * 0.6);
  // La cabeza.
  c.fillStyle = NEGRO2; rr(c, -0.58, cy - 0.32, 1.16, 0.72, 0.32); c.fill();
  c.fillStyle = NEGRO; rr(c, -0.58, cy - 0.36, 1.16, 0.66, 0.32); c.fill();
  c.strokeStyle = ROSA; c.lineWidth = 0.025; rr(c, -0.54, cy - 0.32, 1.08, 0.58, 0.28); c.stroke();
  c.fillStyle = "rgba(255, 255, 255, 0.07)"; rr(c, -0.46, cy - 0.31, 0.5, 0.06, 0.03); c.fill();
  c.fillStyle = CIAN; rr(c, -0.58, cy - 0.3, 1.16, 0.06, 0.03); c.fill();
  c.fillStyle = CIAN2; c.beginPath(); c.arc(0.55, cy - 0.27, 0.045, 0, TAU); c.fill();
  visor(c, cy - 0.01, a.gesto, a.reloj);
  if (a.gesto === "susto" || (a.suda && !car.terminada && a.reloj % 1.6 < 0.7)) gota(c, a.gesto === "susto" ? 0 : (a.reloj % 1.6) / 0.7, cy);
  c.restore();

  if (car.terminada) {
    const centro = proyectar(v, x, car.y + 1.25 * TAM, car.z);
    for (let k = 0; k < 4; k++) {
      const ang = a.reloj * 3.2 + (k * Math.PI) / 2;
      estrella(c, centro.x + Math.cos(ang) * s * 0.5, centro.y + Math.sin(ang) * s * 0.1, s * 0.07, k % 2 ? CIAN : "#ffffff");
    }
  }
}

/** La visera: panel oscuro con dos ojos de luz que cambian con el gesto. */
function visor(c: CanvasRenderingContext2D, y: number, gesto: Gesto, t: number): void {
  const w = 0.86, h = 0.3;
  c.fillStyle = "rgba(126, 243, 255, 0.16)"; rr(c, -w / 2 - 0.04, y - h / 2 - 0.04, w + 0.08, h + 0.08, (h + 0.08) / 2); c.fill();
  c.fillStyle = "#06141a"; rr(c, -w / 2, y - h / 2, w, h, h / 2); c.fill();
  c.fillStyle = "rgba(255, 255, 255, 0.1)"; rr(c, -w / 2 + 0.05, y - h / 2 + 0.025, w * 0.5, h * 0.17, h * 0.085); c.fill();
  // Parpadea de vez en cuando (la luz se apaga un instante).
  const parpadea = (gesto === "corre" || gesto === "salta") && t % 3.3 < 0.1;
  c.fillStyle = CIAN; c.strokeStyle = CIAN; c.lineCap = "round";
  for (const l of [-1, 1]) {
    const ex = l * 0.19, ey = y + 0.006;
    if (parpadea || gesto === "barre") {
      c.lineWidth = 0.03; c.beginPath(); c.moveTo(ex - 0.09, ey + 0.02 + (gesto === "barre" ? l * -0.012 : 0)); c.lineTo(ex + 0.09, ey + 0.02 + (gesto === "barre" ? l * 0.012 : 0)); c.stroke();
    } else if (gesto === "feliz") {
      c.lineWidth = 0.045; c.beginPath(); c.arc(ex, ey + 0.045, 0.075, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
    } else if (gesto === "susto" || gesto === "salta") {
      const r = gesto === "susto" ? 0.07 : 0.06;
      c.beginPath(); c.arc(ex, ey, r, 0, TAU); c.fill();
      c.fillStyle = "#06141a"; c.beginPath(); c.arc(ex, ey, r * 0.42, 0, TAU); c.fill(); c.fillStyle = CIAN;
    } else if (gesto === "mareo") {
      c.lineWidth = 0.032;
      c.beginPath(); c.moveTo(ex - 0.06, ey - 0.05); c.lineTo(ex + 0.06, ey + 0.05); c.moveTo(ex + 0.06, ey - 0.05); c.lineTo(ex - 0.06, ey + 0.05); c.stroke();
    } else {
      // Rasgados y decididos (inclinados hacia adentro).
      const k = 0.11;
      c.beginPath();
      c.moveTo(ex - k, ey + (l < 0 ? -0.014 : 0.032)); c.lineTo(ex + k, ey + (l < 0 ? 0.032 : -0.014));
      c.lineTo(ex + k * 0.8, ey + 0.058); c.lineTo(ex - k * 0.8, ey + 0.058);
      c.closePath(); c.fill();
    }
  }
}

/** Las puntas de la cinta de luz: largas, ondeando hacia atrás con el viento. */
function puntas(c: CanvasRenderingContext2D, x: number, y: number, t: number, largo: number, viento: number): void {
  c.lineCap = "round";
  ([[0, 0, CIAN], [1, 0.11, CIAN2]] as const).forEach(([k, dy, col]) => {
    const o = Math.sin(t * 13 + k * 1.8) * 0.06 * viento, o2 = Math.sin(t * 13 + k * 1.8 + 1.3) * 0.08 * viento;
    c.strokeStyle = col; c.lineWidth = 0.06 - k * 0.012;
    c.beginPath(); c.moveTo(x, y);
    c.bezierCurveTo(x + largo * 0.35, y - 0.05 + dy + o, x + largo * 0.65, y + dy + o2, x + largo, y - 0.03 + dy * 1.4 + o2 * 1.4);
    c.stroke();
  });
}

/** Las patitas: corren, se recogen en el aire, se estiran al barrerse y se abren al chocar. */
function patas(c: CanvasRenderingContext2D, car: Carrera, fase: number, barriendo: boolean, enAire: boolean, cadera: number): void {
  for (const lado of [-1, 1]) {
    let pie: { x: number; y: number }, rodilla: { x: number; y: number }, k = 0.9;
    if (car.terminada) { pie = { x: lado * 0.3, y: 0 }; rodilla = { x: lado * 0.27, y: cadera * 0.5 }; }
    else if (barriendo) { pie = { x: lado * 0.2, y: 0.02 }; rodilla = { x: lado * 0.22, y: cadera * 0.4 }; k = 1.1; }
    else if (enAire) { const r = car.vy > 0 ? 0.1 : 0.05; pie = { x: lado * 0.16, y: -r }; rodilla = { x: lado * 0.22, y: cadera * 0.6 - r * 0.5 }; }
    else {
      const alza = Math.max(0, Math.sin(fase + (lado > 0 ? Math.PI : 0)));
      pie = { x: lado * 0.12, y: -alza * 0.2 };
      rodilla = { x: lado * (0.16 + alza * 0.06), y: (cadera + pie.y) / 2 - alza * 0.03 };
    }
    c.strokeStyle = NEGRO; c.lineWidth = 0.075;
    c.beginPath(); c.moveTo(lado * 0.08, cadera); c.quadraticCurveTo(rodilla.x, rodilla.y, pie.x, pie.y - 0.03); c.stroke();
    // Una franja de luz en el tobillo.
    c.strokeStyle = CIAN; c.lineWidth = 0.08;
    const dx = (rodilla.x - pie.x) * 0.18, dy = (rodilla.y - pie.y) * 0.18;
    c.beginPath(); c.moveTo(pie.x + dx * 0.8, pie.y - 0.03 + dy * 0.8); c.lineTo(pie.x + dx, pie.y - 0.03 + dy); c.stroke();
    botin(c, pie.x, pie.y, k);
  }
}

/** El botín ninja: negro, de dedo partido, con suela rosa. */
function botin(c: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  c.fillStyle = NEGRO;
  c.beginPath(); c.ellipse(x, y - 0.01, 0.1 * k, 0.07 * k, 0, Math.PI, TAU); c.fill();
  c.fillRect(x - 0.1 * k, y - 0.012, 0.2 * k, 0.02);
  c.fillStyle = ROSA; rr(c, x - 0.11 * k, y + 0.005, 0.22 * k, 0.035 * k, 0.017 * k); c.fill();
  c.strokeStyle = "#2a2933"; c.lineWidth = 0.012;
  c.beginPath(); c.moveTo(x + 0.035 * k, y - 0.06 * k); c.lineTo(x + 0.035 * k, y + 0.005); c.stroke();
}

/** Una gota de sudor: fija al asustarse; volando de vez en cuando en los niveles altos. */
function gota(c: CanvasRenderingContext2D, f: number, cy: number): void {
  const x = 0.62 + f * 0.15, y = cy - 0.3 - f * 0.1 + f * f * 0.2;
  c.globalAlpha = 1 - f * 0.9;
  c.fillStyle = "#8fd8ff";
  c.beginPath(); c.moveTo(x, y - 0.06); c.quadraticCurveTo(x + 0.04, y, x, y + 0.025); c.quadraticCurveTo(x - 0.04, y, x, y - 0.06); c.fill();
  c.globalAlpha = 1;
}
