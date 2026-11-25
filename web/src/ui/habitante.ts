/**
 * El habitante de Mi espacio (entrenador, 2026-11-25; backlog 2, punto 29, "ideas tomadas de
 * Tsuki's Odyssey"): un personaje chibi, original, que vive en el espacio de cada quien y está
 * contigo en la pestaña donde estés. En la pradera pasea por el camino y se detiene a admirar
 * los árboles; en la casa camina, se sienta en el sillón y se asoma por la ventana; en el
 * gimnasio camina y hace sentadillas en el tapete.
 *
 * Mujer u hombre según el perfil (`sexo`). La posición va en cuadros del piso (i, j) de la vista
 * isométrica de cada lugar; quien dibuja pasa la función que convierte a pantalla.
 */
import type { Sexo } from "../datos";

export type Accion = "camina" | "parado" | "admira" | "sentado" | "ejercicio";
export type LugarHabitante = "pradera" | "casa" | "gimnasio";

interface Punto { i: number; j: number; }
/** Un lugar a donde ir y lo que hace al llegar. */
interface Parada extends Punto { accion: Exclude<Accion, "camina">; segundos: [number, number]; }

/**
 * A dónde puede ir en cada lugar. En la pradera todo pasa por el cruce del camino (6.2, 6.2):
 * así nunca atraviesa la casa ni el gimnasio. Los árboles para admirar son los de enfrente,
 * para que el personaje quede delante de ellos.
 */
const PARADAS: Record<LugarHabitante, Parada[]> = {
  pradera: [
    { i: 6.2, j: 6.2, accion: "parado", segundos: [1, 2] },
    { i: 9.4, j: 9.4, accion: "parado", segundos: [1.5, 3] },
    { i: 4.7, j: 6.55, accion: "parado", segundos: [1.5, 2.5] },
    { i: 6.75, j: 4.6, accion: "parado", segundos: [1.5, 2.5] },
    { i: 10.1, j: 6.4, accion: "admira", segundos: [3, 5] },
    { i: 10.2, j: 8.1, accion: "admira", segundos: [3, 5] },
    { i: 2.9, j: 10.1, accion: "admira", segundos: [3, 5] },
    { i: 7.0, j: 11.9, accion: "admira", segundos: [3, 5] },
  ],
  casa: [
    { i: 3.0, j: 1.2, accion: "sentado", segundos: [5, 8] },
    { i: 0.75, j: 2.8, accion: "admira", segundos: [3, 5] },
    { i: 4.6, j: 4.4, accion: "parado", segundos: [1.5, 3] },
    { i: 1.6, j: 4.6, accion: "parado", segundos: [1.5, 3] },
  ],
  gimnasio: [
    { i: 3.1, j: 3.0, accion: "ejercicio", segundos: [5, 8] },
    { i: 4.8, j: 1.8, accion: "parado", segundos: [1.5, 3] },
    { i: 1.6, j: 4.6, accion: "parado", segundos: [1.5, 3] },
    { i: 4.6, j: 4.6, accion: "parado", segundos: [1.5, 2.5] },
  ],
};
const CRUCE: Punto = { i: 6.2, j: 6.2 };
/** Cuadros por segundo al caminar. */
const VELOCIDAD: Record<LugarHabitante, number> = { pradera: 1.1, casa: 0.9, gimnasio: 0.9 };
/** Dónde aparece al entrar a cada lugar. */
const ENTRADA: Record<LugarHabitante, Punto> = { pradera: { i: 4.7, j: 6.55 }, casa: { i: 4.8, j: 3.2 }, gimnasio: { i: 4.8, j: 3.2 } };

export interface Habitante {
  lugar: LugarHabitante;
  i: number; j: number;
  /** El camino que le falta (en la pradera, a veces pasa primero por el cruce). */
  ruta: Punto[];
  /** Lo que hará al terminar la ruta. */
  meta: Parada | null;
  accion: Accion;
  /** Hasta cuándo (segundos del reloj) sigue haciendo lo que hace. */
  hasta: number;
  /** 1 mira a la derecha, -1 a la izquierda (en pantalla). */
  mira: 1 | -1;
  /** Desde cuándo hace lo que hace: para las animaciones. */
  desde: number;
}

export function nuevoHabitante(lugar: LugarHabitante, ahora: number): Habitante {
  const e = ENTRADA[lugar];
  return { lugar, i: e.i, j: e.j, ruta: [], meta: null, accion: "parado", hasta: ahora + 1.2, mira: 1, desde: ahora };
}

function elegirParada(h: Habitante, azar: () => number): Parada {
  const opciones = PARADAS[h.lugar].filter((p) => Math.hypot(p.i - h.i, p.j - h.j) > 0.5);
  return opciones[Math.floor(azar() * opciones.length)] ?? PARADAS[h.lugar][0]!;
}

/** Avanza `dt` segundos: camina hacia su meta o, al llegar, hace lo suyo un rato. */
export function avanzarHabitante(h: Habitante, ahora: number, dt: number, aPantallaX: (i: number, j: number) => number, azar: () => number = Math.random): void {
  if (h.accion !== "camina") {
    if (ahora < h.hasta) return;
    const meta = elegirParada(h, azar);
    // En la pradera se va por el cruce, salvo que ya esté ahí.
    h.ruta = h.lugar === "pradera" && Math.hypot(h.i - CRUCE.i, h.j - CRUCE.j) > 0.3 && Math.hypot(meta.i - CRUCE.i, meta.j - CRUCE.j) > 0.3 ? [CRUCE, meta] : [meta];
    h.meta = meta;
    h.accion = "camina"; h.desde = ahora;
  }
  const destino = h.ruta[0];
  if (!destino) return;
  const di = destino.i - h.i, dj = destino.j - h.j, d = Math.hypot(di, dj);
  const paso = VELOCIDAD[h.lugar] * dt;
  const dx = aPantallaX(destino.i, destino.j) - aPantallaX(h.i, h.j);
  if (Math.abs(dx) > 0.5) h.mira = dx > 0 ? 1 : -1;
  if (d <= paso) {
    h.i = destino.i; h.j = destino.j;
    h.ruta.shift();
    if (h.ruta.length === 0 && h.meta) {
      const [a, b] = h.meta.segundos;
      h.accion = h.meta.accion; h.desde = ahora; h.hasta = ahora + a + azar() * (b - a);
      // Al sentarse o hacer ejercicio, de frente; al admirar, hacia el árbol (atrás a la izquierda).
      if (h.accion === "admira") h.mira = h.lugar === "pradera" ? -1 : 1;
    }
  } else {
    h.i += (di / d) * paso; h.j += (dj / d) * paso;
  }
}

// ── Dibujo ──────────────────────────────────────────────────────────────────

const ROPA: Record<Sexo, { playera: string; playeraSombra: string; pants: string; pelo: string; tenis: string }> = {
  M: { playera: "#f08a9c", playeraSombra: "#d2697c", pants: "#4a3f63", pelo: "#5a3826", tenis: "#ffffff" },
  H: { playera: "#5aa6d6", playeraSombra: "#3f86b8", pants: "#33404f", pelo: "#3a2618", tenis: "#ffffff" },
};
const PIEL = "#f3c9a6", PIEL_SOMBRA = "#e3b08a";

function redondo(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/**
 * Dibuja al habitante con los pies en (x, y). `u` es su tamaño: mide ~2.6 u de alto. `t` son los
 * segundos del reloj, para la animación (pasos, parpadeo, respiración).
 */
export function pintarHabitante(c: CanvasRenderingContext2D, x: number, y: number, u: number, sexo: Sexo, h: Pick<Habitante, "accion" | "mira" | "desde">, t: number): void {
  const ropa = ROPA[sexo];
  const accion = h.accion;
  const fase = (t - h.desde) * 9;
  const andar = accion === "camina" ? Math.sin(fase) : 0;
  // Sentadilla: baja y sube cada ~1.6 s.
  const baja = accion === "ejercicio" ? (1 - Math.cos((t - h.desde) * 4)) / 2 : 0;
  const respira = accion === "camina" ? Math.abs(Math.sin(fase)) * 0.06 : Math.sin(t * 2.2) * 0.02;
  const sentado = accion === "sentado";

  c.save();
  c.translate(x, y);
  // Sombra en el piso.
  c.fillStyle = "rgba(20, 30, 15, 0.25)";
  c.beginPath(); c.ellipse(0, 0, u * 0.55, u * 0.18, 0, 0, Math.PI * 2); c.fill();
  c.scale(h.mira, 1);

  const cadera = sentado ? -u * 0.55 : -u * (0.9 - baja * 0.35) - respira * u;
  // Piernas: alternan al caminar; sentado, hacia adelante.
  c.fillStyle = ropa.pants;
  if (sentado) {
    redondo(c, -u * 0.05, cadera - u * 0.05, u * 0.55, u * 0.26, u * 0.12); c.fill();
    redondo(c, u * 0.38, cadera, u * 0.2, u * 0.5, u * 0.1); c.fill();
    c.fillStyle = ropa.tenis; redondo(c, u * 0.34, cadera + u * 0.45, u * 0.32, u * 0.14, u * 0.07); c.fill();
  } else {
    for (const lado of [-1, 1]) {
      // Cada pierna gira desde la cadera: una adelante y la otra atrás.
      const largo = -cadera - u * 0.04;
      c.save();
      c.translate(lado * u * 0.12, cadera);
      c.rotate(-andar * lado * 0.45);
      redondo(c, -u * 0.11, 0, u * 0.22, largo, u * 0.1); c.fill();
      c.fillStyle = ropa.tenis;
      redondo(c, -u * 0.12, largo - u * 0.12, u * 0.32, u * 0.15, u * 0.07); c.fill();
      c.fillStyle = ropa.pants;
      c.restore();
    }
  }
  // Cuerpo: una playera redondita.
  const hombros = cadera - u * 0.62;
  c.fillStyle = ropa.playera;
  redondo(c, -u * 0.32, hombros, u * 0.64, u * 0.68, u * 0.22); c.fill();
  c.fillStyle = ropa.playeraSombra;
  redondo(c, -u * 0.32, hombros + u * 0.5, u * 0.64, u * 0.18, u * 0.12); c.fill();
  // Brazos: se mecen al caminar, al frente en la sentadilla, arriba al admirar (señalando).
  c.fillStyle = ropa.playera;
  for (const lado of [-1, 1]) {
    c.save();
    c.translate(lado * u * 0.3, hombros + u * 0.12);
    let giro = -andar * lado * 0.5;
    // Brazos al frente para equilibrarse (rotar negativo lleva el brazo hacia donde mira).
    if (accion === "ejercicio") giro = -1.4 * (0.7 + baja * 0.3);
    if (accion === "admira" && lado > 0) giro = -2.4 + Math.sin(t * 3) * 0.08;
    if (sentado) giro = lado * 0.25;
    c.rotate(giro);
    redondo(c, -u * 0.09, 0, u * 0.18, u * 0.46, u * 0.09); c.fill();
    c.fillStyle = PIEL; c.beginPath(); c.arc(0, u * 0.48, u * 0.09, 0, Math.PI * 2); c.fill();
    c.fillStyle = ropa.playera;
    c.restore();
  }
  // Cabeza grande (chibi).
  const cy = hombros - u * 0.52;
  const r = u * 0.58;
  const mirarArriba = accion === "admira" ? -u * 0.08 : 0;
  // Cola de caballo (detrás de la cabeza) o nada.
  if (sexo === "M") {
    c.fillStyle = ropa.pelo;
    const cola = Math.sin(t * (accion === "camina" ? 9 : 2)) * 0.15;
    c.save(); c.translate(-r * 0.75, cy - r * 0.1); c.rotate(0.5 + cola);
    c.beginPath(); c.ellipse(0, r * 0.35, r * 0.22, r * 0.5, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  c.fillStyle = PIEL; c.beginPath(); c.arc(0, cy, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = PIEL_SOMBRA; c.beginPath(); c.arc(-r * 0.05, cy + r * 0.08, r * 0.92, Math.PI * 0.15, Math.PI * 0.85); c.fill();
  c.fillStyle = PIEL; c.beginPath(); c.arc(0, cy - r * 0.04, r * 0.92, 0, Math.PI * 2); c.fill();
  // Orejas.
  c.fillStyle = PIEL_SOMBRA; c.beginPath(); c.arc(-r * 0.9, cy + r * 0.08, r * 0.16, 0, Math.PI * 2); c.fill();
  // Pelo: casquito con fleco; ella con un moño arriba.
  c.fillStyle = ropa.pelo;
  c.save();
  // Todo el pelo dentro de la silueta de la cabeza (un poquito más grande): sin esquinas.
  c.beginPath(); c.arc(0, cy - r * 0.02, r * 1.06, 0, Math.PI * 2); c.clip();
  c.beginPath();
  c.moveTo(-r * 1.1, cy + r * 0.25);
  c.quadraticCurveTo(-r * 0.75, cy - r * 0.05, -r * 0.3, cy - r * 0.12);
  c.quadraticCurveTo(r * 0.05, cy - r * 0.2, r * 0.25, cy - r * 0.48);
  c.quadraticCurveTo(r * 0.5, cy - r * 0.12, r * 1.1, cy - r * 0.1);
  c.lineTo(r * 1.1, cy - r * 1.2); c.lineTo(-r * 1.1, cy - r * 1.2); c.closePath(); c.fill();
  // Brillo del pelo.
  c.strokeStyle = "rgba(255, 255, 255, 0.18)"; c.lineWidth = Math.max(1, r * 0.08); c.lineCap = "round";
  c.beginPath(); c.arc(0, cy - r * 0.05, r * 0.82, Math.PI * 1.2, Math.PI * 1.45); c.stroke();
  c.restore();
  if (sexo === "M") {
    c.beginPath(); c.arc(-r * 0.25, cy - r * 1.05, r * 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = ropa.playera; c.beginPath(); c.ellipse(-r * 0.05, cy - r * 0.92, r * 0.16, r * 0.1, 0.4, 0, Math.PI * 2); c.fill();
  } else {
    // Un mechón parado.
    c.beginPath(); c.moveTo(r * 0.05, cy - r * 0.95); c.quadraticCurveTo(r * 0.3, cy - r * 1.35, r * 0.45, cy - r * 1.1); c.quadraticCurveTo(r * 0.25, cy - r * 1.0, r * 0.2, cy - r * 0.9); c.fill();
  }
  // Cara: ojos que parpadean, cachetitos y sonrisa; mira hacia donde va.
  const ojoY = cy + r * 0.12 + mirarArriba;
  const parpadea = (t % 4.2) < 0.12 || accion === "sentado" && (t % 6) < 1.4;
  c.fillStyle = "#2a1d17";
  for (const ox of [r * 0.12, r * 0.58]) {
    if (parpadea) { c.fillRect(ox - r * 0.1, ojoY, r * 0.2, r * 0.05); continue; }
    c.beginPath(); c.ellipse(ox, ojoY, r * 0.08, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(ox + r * 0.03, ojoY - r * 0.05, r * 0.03, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#2a1d17";
  }
  c.fillStyle = "rgba(240, 120, 120, 0.45)";
  for (const ox of [r * 0.02, r * 0.72]) { c.beginPath(); c.ellipse(ox, ojoY + r * 0.24, r * 0.12, r * 0.07, 0, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = "#7a3f30"; c.lineWidth = Math.max(1, u * 0.04); c.lineCap = "round";
  c.beginPath(); c.arc(r * 0.36, ojoY + r * 0.22, r * 0.1, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  c.lineCap = "butt";
  c.restore();

  // Lo que flota arriba: corazoncitos al admirar, "z" sentado, gotitas de sudor al hacer ejercicio.
  const k = (t * 0.7) % 1;
  if (accion === "admira") {
    c.fillStyle = `rgba(255, 110, 150, ${1 - k})`;
    corazon(c, x + h.mira * u * 0.5, y - u * 3.1 - k * u * 0.8, u * 0.22);
  } else if (accion === "sentado") {
    c.fillStyle = `rgba(255, 255, 255, ${0.9 - k * 0.9})`;
    c.font = `800 ${Math.round(u * 0.45)}px system-ui, sans-serif`; c.textAlign = "center";
    c.fillText("♪", x + u * 0.6, y - u * 2.8 - k * u * 0.7);
  } else if (accion === "ejercicio") {
    c.fillStyle = `rgba(140, 200, 255, ${1 - k})`;
    c.beginPath(); c.ellipse(x + u * 0.6, y - u * 2.4 + k * u * 0.6, u * 0.06, u * 0.1, 0, 0, Math.PI * 2); c.fill();
  }
}

function corazon(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.2, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  c.fill();
}
