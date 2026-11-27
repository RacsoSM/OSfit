import type { Carrera } from "../pesaRun";
import { CARRIL, proyectar, type Vista } from "./pesaRun3d";
import { estrella } from "./pesaRunEscena";

/**
 * La protagonista de Correle pa (entrenador, 2026-11-27: "que el personaje principal se vea más
 * carismático"): una mancuerna hexagonal con cara. En medio, un mango gordito y cromado que
 * hace de cara, con ojos grandes que se asoman por arriba, cejas, cachetes y boca; una cinta
 * rosa en la frente con sus puntas al viento; las cabezas dicen "OS" y "FIT"; y dos patitas
 * con calcetas y tenis rosas.
 *
 * Tiene gestos: corre decidida, abre la boca al saltar, aprieta los dientes al barrerse, sonríe
 * con los ojos cerrados al tomar un batido, se asusta si viene algo encima y queda mareada al
 * chocar. Rebota al correr, se estira al saltar y se aplasta al caer.
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

/** Un poco más grande que su tamaño real, para que se luzca en el teléfono. */
const TAM = 1.2;
const PIEL = "#d7dce4";

export function pintarMancuerna(c: CanvasRenderingContext2D, v: Vista, car: Carrera, a: AnimMancuerna): void {
  const x = car.x * CARRIL;
  const piso = proyectar(v, x, 0, car.z);
  const s = piso.s * TAM;
  const barriendo = car.barrida > 0 && !car.terminada;
  const enAire = car.y > 0.01;
  const fase = car.z * 2.2;
  const corriendo = !enAire && !barriendo && !car.terminada;
  const bote = corriendo ? Math.abs(Math.cos(fase)) * 0.04 : 0;
  // Altura del centro del cuerpo sobre el piso, en unidades del dibujo (1 = s píxeles).
  const alto = barriendo ? 0.34 : 0.68;
  const centro = proyectar(v, x, car.y + alto * TAM, car.z);

  // La sombra en el piso: más chica entre más alto va.
  const sombra = Math.max(0.35, 1 - car.y * 0.35);
  c.fillStyle = "rgba(0, 0, 0, 0.42)";
  c.beginPath(); c.ellipse(piso.x, piso.y, s * 0.58 * sombra, s * 0.12 * sombra, 0, 0, Math.PI * 2); c.fill();

  let sx = 1, sy = 1;
  if (a.aterrizaje > 0) { sx += 0.18 * a.aterrizaje; sy -= 0.18 * a.aterrizaje; }
  else if (enAire && car.vy > 0) { sx = 0.94; sy = 1.08; }
  if (barriendo) { sx *= 1.06; sy *= 0.9; }

  c.save();
  c.translate(centro.x, centro.y - bote * s);
  c.rotate((car.carril - car.x) * 0.3 + (car.terminada ? Math.sin(a.reloj * 3) * 0.08 : 0));
  c.scale(s * sx, s * sy);
  c.lineCap = "round"; c.lineJoin = "round";

  puntasCinta(c, a.reloj, car.vel);
  patas(c, car, a, fase, alto + bote + car.y / TAM, barriendo, enAire);
  cabezas(c);
  mango(c);
  cinta(c);
  cara(c, car, a);
  if (a.suda && !car.terminada) gota(c, a.reloj);
  c.restore();

  if (car.terminada) {
    for (let k = 0; k < 4; k++) {
      const ang = a.reloj * 3.2 + (k * Math.PI) / 2;
      estrella(c, centro.x + Math.cos(ang) * s * 0.45, centro.y - s * 0.5 + Math.sin(ang) * s * 0.1, s * 0.07, k % 2 ? "#ffe08a" : "#ffffff");
    }
  }
}

// ── Las partes (en unidades del dibujo, con el centro del mango en 0, 0) ─────

/** Las dos cabezas hexagonales, de hule negro, con grosor, bisel y su letrero. */
function cabezas(c: CanvasRenderingContext2D): void {
  for (const lado of [-1, 1]) {
    const cx = lado * 0.4, r = 0.29;
    const hex = (x: number, rr: number) => {
      c.beginPath();
      for (let k = 0; k < 6; k++) { const ang = (k * Math.PI) / 3; c.lineTo(x + Math.cos(ang) * rr * 0.86, Math.sin(ang) * rr); }
      c.closePath();
    };
    // El grosor (la cara de adentro, que se asoma hacia el centro).
    c.fillStyle = "#0f1013"; hex(cx - lado * 0.07, r); c.fill();
    const g = c.createLinearGradient(cx - r, -r, cx + r * 0.6, r);
    g.addColorStop(0, "#5b616d"); g.addColorStop(0.45, "#2c2f36"); g.addColorStop(1, "#15171b");
    c.fillStyle = g; hex(cx, r); c.fill();
    c.strokeStyle = "#6c7380"; c.lineWidth = 0.014; hex(cx, r); c.stroke();
    c.fillStyle = "#24272d"; hex(cx, r * 0.76); c.fill();
    c.strokeStyle = "rgba(255, 255, 255, 0.08)"; c.lineWidth = 0.01; hex(cx, r * 0.76); c.stroke();
    // El letrero en relieve.
    // (Con letra de tamaño normal: algunos navegadores no pintan letras de menos de 1 px.)
    c.save(); c.scale(0.01, 0.01);
    c.fillStyle = "rgba(255, 255, 255, 0.85)";
    c.font = "900 15px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(lado < 0 ? "OS" : "FIT", cx * 100, 1);
    c.restore();
    c.fillStyle = "#ff4fa3"; c.fillRect(cx - 0.07, 0.1, 0.14, 0.022);
    // El brillo de arriba.
    c.fillStyle = "rgba(255, 255, 255, 0.16)";
    c.beginPath(); c.moveTo(cx - r * 0.65, -r * 0.55); c.lineTo(cx - r * 0.35, -r * 0.92); c.lineTo(cx + r * 0.15, -r * 0.92); c.lineTo(cx - r * 0.4, -r * 0.4); c.closePath(); c.fill();
  }
  // Los collarines rosas donde el mango entra a cada cabeza.
  for (const lado of [-1, 1]) {
    c.fillStyle = "#ff4fa3";
    c.beginPath(); c.roundRect(lado * 0.17 - 0.02, -0.15, 0.04, 0.3, 0.015); c.fill();
  }
}

/** El mango, gordito y cromado: es su cara. */
function mango(c: CanvasRenderingContext2D): void {
  const g = c.createLinearGradient(0, -0.17, 0, 0.17);
  g.addColorStop(0, "#f4f6f9"); g.addColorStop(0.35, PIEL); g.addColorStop(0.8, "#9ba3af"); g.addColorStop(1, "#7a828e");
  c.fillStyle = g;
  c.beginPath(); c.roundRect(-0.165, -0.17, 0.33, 0.34, 0.11); c.fill();
  c.strokeStyle = "rgba(40, 44, 52, 0.55)"; c.lineWidth = 0.012; c.stroke();
  // El moleteado, solo en las orillas.
  c.strokeStyle = "rgba(60, 66, 76, 0.25)"; c.lineWidth = 0.006;
  for (const lado of [-1, 1]) for (let k = 0; k < 4; k++) {
    const xk = lado * (0.12 + k * 0.012);
    c.beginPath(); c.moveTo(xk, -0.1); c.lineTo(xk + 0.02, 0.1); c.stroke();
  }
  c.fillStyle = "rgba(255, 255, 255, 0.55)";
  c.beginPath(); c.roundRect(-0.11, -0.155, 0.16, 0.035, 0.017); c.fill();
}

/** La cinta rosa de la frente, con su nudo a la derecha. */
function cinta(c: CanvasRenderingContext2D): void {
  c.fillStyle = "#ff3d9a";
  c.beginPath(); c.roundRect(-0.165, -0.17, 0.33, 0.06, 0.03); c.fill();
  c.fillStyle = "#ffffff"; c.fillRect(-0.15, -0.147, 0.3, 0.012);
  c.fillStyle = "#e02a85"; c.beginPath(); c.arc(0.15, -0.14, 0.035, 0, Math.PI * 2); c.fill();
}

/** Las puntas de la cinta: ondean detrás de la cabeza derecha, más con la velocidad. */
function puntasCinta(c: CanvasRenderingContext2D, t: number, vel: number): void {
  const viento = Math.min(1, vel / 20);
  for (const [k, largo, alto] of [[0, 0.42, -0.3], [1, 0.36, -0.2]] as const) {
    const onda = Math.sin(t * (10 + viento * 8) + k * 1.7) * 0.05;
    c.strokeStyle = k ? "#e02a85" : "#ff3d9a"; c.lineWidth = 0.055;
    c.beginPath();
    c.moveTo(0.15, -0.14);
    c.quadraticCurveTo(0.35, alto - 0.05 + onda, 0.15 + largo + viento * 0.1, alto + onda * 1.6);
    c.stroke();
  }
}

/** Las patitas: piernas, calcetas con franja y tenis rosas. */
function patas(c: CanvasRenderingContext2D, car: Carrera, a: AnimMancuerna, fase: number, suelo: number, barriendo: boolean, enAire: boolean): void {
  for (const lado of [-1, 1]) {
    const cadera = { x: lado * 0.08, y: 0.13 };
    let pie: { x: number; y: number }, rodilla: { x: number; y: number }, tenis = 1;
    if (car.terminada) {
      pie = { x: lado * 0.3, y: suelo - 0.03 }; rodilla = { x: lado * 0.25, y: 0.3 };
    } else if (barriendo) {
      // Estiradas hacia adelante (hacia la cámara): los tenis se ven más grandes.
      pie = { x: lado * 0.17, y: suelo - 0.04 }; rodilla = { x: lado * 0.16, y: 0.2 }; tenis = 1.25;
    } else if (enAire) {
      const recoge = car.vy > 0 ? 1 : 0.6;
      pie = { x: lado * 0.17, y: 0.4 - recoge * 0.04 }; rodilla = { x: lado * 0.22, y: 0.24 };
    } else {
      const alza = Math.max(0, Math.sin(fase + (lado > 0 ? Math.PI : 0)));
      pie = { x: lado * 0.12, y: suelo - alza * 0.17 };
      rodilla = { x: lado * (0.13 + alza * 0.05), y: (cadera.y + pie.y) / 2 - alza * 0.04 };
    }
    c.strokeStyle = "#32343b"; c.lineWidth = 0.065;
    c.beginPath(); c.moveTo(cadera.x, cadera.y); c.quadraticCurveTo(rodilla.x, rodilla.y, pie.x, pie.y - 0.02); c.stroke();
    // La calceta.
    c.strokeStyle = "#ffffff"; c.lineWidth = 0.072;
    const dx = (rodilla.x - pie.x) * 0.35, dy = (rodilla.y - pie.y) * 0.35;
    c.beginPath(); c.moveTo(pie.x, pie.y - 0.02); c.lineTo(pie.x + dx, pie.y - 0.02 + dy); c.stroke();
    c.strokeStyle = "#7ef3ff"; c.lineWidth = 0.074;
    c.beginPath(); c.moveTo(pie.x + dx * 0.7, pie.y - 0.02 + dy * 0.7); c.lineTo(pie.x + dx * 0.85, pie.y - 0.02 + dy * 0.85); c.stroke();
    tenisRosa(c, pie.x + lado * 0.015, pie.y, tenis);
  }
  void a;
}

function tenisRosa(c: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  // La suela blanca, el cuerpo rosa, la puntera y las agujetas.
  c.fillStyle = "#f6f6f8";
  c.beginPath(); c.roundRect(x - 0.1 * t, y + 0.005, 0.2 * t, 0.045 * t, 0.02 * t); c.fill();
  c.fillStyle = "#ff4fa3";
  c.beginPath(); c.ellipse(x, y, 0.095 * t, 0.06 * t, 0, Math.PI, Math.PI * 2); c.fill();
  c.fillRect(x - 0.095 * t, y - 0.001, 0.19 * t, 0.012 * t);
  c.fillStyle = "#ffffff";
  c.beginPath(); c.ellipse(x, y - 0.005 * t, 0.05 * t, 0.025 * t, 0, Math.PI, Math.PI * 2); c.fill();
  c.strokeStyle = "#ffffff"; c.lineWidth = 0.01 * t;
  for (const k of [0, 1]) { c.beginPath(); c.moveTo(x - 0.025 * t, y - 0.035 * t - k * 0.016 * t); c.lineTo(x + 0.025 * t, y - 0.035 * t - k * 0.016 * t); c.stroke(); }
  c.fillStyle = "#c92a7a"; c.fillRect(x - 0.1 * t, y + 0.035 * t, 0.2 * t, 0.012 * t);
}

function ojoAbierto(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, mira: number, iris: number, parpado: number): void {
  c.fillStyle = "#ffffff";
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#1c1d22"; c.lineWidth = 0.013; c.stroke();
  c.save();
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = "#3a2a6b"; c.beginPath(); c.arc(x + mira * rx * 0.45, y + ry * 0.12, iris, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#0f0f14"; c.beginPath(); c.arc(x + mira * rx * 0.45, y + ry * 0.12, iris * 0.58, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#ffffff";
  c.beginPath(); c.arc(x + mira * rx * 0.45 + iris * 0.35, y + ry * 0.12 - iris * 0.4, iris * 0.32, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(x + mira * rx * 0.45 - iris * 0.3, y + ry * 0.12 + iris * 0.35, iris * 0.14, 0, Math.PI * 2); c.fill();
  // El párpado (al barrerse, medio cerrado y decidido).
  if (parpado > 0) {
    c.fillStyle = PIEL; c.fillRect(x - rx, y - ry, rx * 2, ry * 2 * parpado);
    c.strokeStyle = "#1c1d22"; c.lineWidth = 0.013;
    c.beginPath(); c.moveTo(x - rx, y - ry + ry * 2 * parpado); c.lineTo(x + rx, y - ry + ry * 2 * parpado); c.stroke();
  }
  c.restore();
}

/** Los ojos, las cejas, los cachetes y la boca, según el gesto. */
function cara(c: CanvasRenderingContext2D, car: Carrera, a: AnimMancuerna): void {
  const g = a.gesto;
  const ey = -0.1, sep = 0.075;
  const parpadea = g !== "mareo" && g !== "feliz" && (a.reloj % 3.3 < 0.11 || (a.reloj % 3.3 > 0.22 && a.reloj % 3.3 < 0.3 && Math.floor(a.reloj / 3.3) % 3 === 0));
  const mira = Math.max(-1, Math.min(1, (car.carril - car.x) * 1.5));

  // Cachetes.
  c.fillStyle = g === "feliz" ? "rgba(255, 90, 150, 0.7)" : "rgba(255, 110, 160, 0.45)";
  for (const lado of [-1, 1]) { c.beginPath(); c.ellipse(lado * 0.11, 0.035, 0.035, 0.018, 0, 0, Math.PI * 2); c.fill(); }

  // Ojos.
  for (const lado of [-1, 1]) {
    const ex = lado * sep;
    if (g === "feliz") {
      c.strokeStyle = "#1c1d22"; c.lineWidth = 0.02;
      c.beginPath(); c.arc(ex, ey + 0.02, 0.045, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else if (g === "mareo") {
      c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ex, ey, 0.066, 0.084, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#1c1d22"; c.lineWidth = 0.013; c.stroke();
      c.beginPath();
      for (let k = 0; k < 28; k++) {
        const ang = k * 0.55 + a.reloj * 6 * lado, r = 0.004 + k * 0.0018;
        c.lineTo(ex + Math.cos(ang) * r, ey + Math.sin(ang) * r * 1.2);
      }
      c.stroke();
    } else if (parpadea) {
      c.strokeStyle = "#1c1d22"; c.lineWidth = 0.018;
      c.beginPath(); c.moveTo(ex - 0.05, ey + 0.01); c.quadraticCurveTo(ex, ey + 0.035, ex + 0.05, ey + 0.01); c.stroke();
    } else {
      const grande = g === "susto" ? 1.12 : g === "salta" ? 1.06 : 1;
      const iris = g === "susto" ? 0.028 : g === "salta" ? 0.036 : 0.042;
      ojoAbierto(c, ex, ey, 0.066 * grande, 0.084 * grande, g === "susto" ? 0 : mira, iris, g === "barre" ? 0.42 : g === "corre" ? 0.12 : 0);
    }
  }

  // Cejas.
  c.strokeStyle = "#1c1d22"; c.lineWidth = 0.026;
  for (const lado of [-1, 1]) {
    let adentro = -0.2, afuera = -0.215;
    if (g === "corre" || g === "barre") { adentro = -0.19; afuera = -0.225; }
    if (g === "susto" || g === "salta") { adentro = -0.235; afuera = -0.225; }
    if (g === "feliz") { adentro = -0.205; afuera = -0.2; }
    if (g === "mareo") { adentro = -0.215 + Math.sin(a.reloj * 5) * 0.01 * lado; afuera = -0.2; }
    c.beginPath(); c.moveTo(lado * 0.03, adentro); c.lineTo(lado * 0.115, afuera); c.stroke();
  }

  // Boca.
  const by = 0.065;
  c.fillStyle = "#3a1622"; c.strokeStyle = "#3a1622"; c.lineWidth = 0.014;
  if (g === "feliz") {
    c.beginPath(); c.moveTo(-0.06, by - 0.01); c.quadraticCurveTo(0, by - 0.02, 0.06, by - 0.01); c.quadraticCurveTo(0.05, by + 0.09, 0, by + 0.09); c.quadraticCurveTo(-0.05, by + 0.09, -0.06, by - 0.01); c.fill();
    c.fillStyle = "#ffffff"; c.fillRect(-0.04, by - 0.01, 0.08, 0.018);
    c.fillStyle = "#ff6f8f"; c.beginPath(); c.ellipse(0, by + 0.065, 0.03, 0.018, 0, 0, Math.PI * 2); c.fill();
  } else if (g === "salta") {
    c.beginPath(); c.ellipse(0, by + 0.025, 0.035, 0.04, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ff6f8f"; c.beginPath(); c.ellipse(0, by + 0.05, 0.022, 0.012, 0, 0, Math.PI * 2); c.fill();
  } else if (g === "susto") {
    c.beginPath(); c.ellipse(0, by + 0.02, 0.02, 0.026, 0, 0, Math.PI * 2); c.fill();
  } else if (g === "barre") {
    c.fillStyle = "#ffffff"; c.beginPath(); c.roundRect(-0.05, by, 0.1, 0.04, 0.012); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-0.05, by + 0.02); c.lineTo(0.05, by + 0.02); for (const k of [-0.017, 0.017]) { c.moveTo(k, by); c.lineTo(k, by + 0.04); } c.stroke();
  } else if (g === "mareo") {
    c.beginPath(); c.moveTo(-0.05, by + 0.02);
    for (let k = 1; k <= 4; k++) c.quadraticCurveTo(-0.05 + (k - 0.5) * 0.025, by + (k % 2 ? 0.0 : 0.04), -0.05 + k * 0.025, by + 0.02);
    c.stroke();
  } else {
    // Sonrisa de lado, decidida.
    c.beginPath(); c.moveTo(-0.045, by); c.quadraticCurveTo(0.005, by + 0.06, 0.055, by - 0.01); c.quadraticCurveTo(0.005, by + 0.025, -0.045, by); c.fill();
  }
}

/** Una gota de sudor que sale volando de vez en cuando. */
function gota(c: CanvasRenderingContext2D, t: number): void {
  const f = (t % 1.6) / 0.7;
  if (f > 1) return;
  const x = -0.22 - f * 0.18, y = -0.26 - f * 0.12 + f * f * 0.22;
  c.globalAlpha = 1 - f;
  c.fillStyle = "#8fd8ff";
  c.beginPath(); c.moveTo(x, y - 0.05); c.quadraticCurveTo(x + 0.03, y, x, y + 0.02); c.quadraticCurveTo(x - 0.03, y, x, y - 0.05); c.fill();
  c.globalAlpha = 1;
}
