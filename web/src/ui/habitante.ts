/**
 * El habitante de Mi espacio (entrenador, 2026-11-25; backlog 2, punto 29, "ideas tomadas de
 * Tsuki's Odyssey"): un personaje original, a escala con la casa, que vive en el espacio de cada quien y está
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

/**
 * La ropa y el pelo. Proporciones de persona (unas 4.5 cabezas), no de muñequito: el
 * entrenador pidió que se viera a escala con la casa y "estéticamente más cuidado" (2026-11-25).
 */
const ESTILO: Record<Sexo, { arriba: string; arribaSombra: string; abajo: string; abajoSombra: string; pelo: string; peloLuz: string; piernaPiel: boolean }> = {
  // Ella: top deportivo, leggings y pelo largo.
  M: { arriba: "#ef7f97", arribaSombra: "#cf6179", abajo: "#4b3f66", abajoSombra: "#3a3052", pelo: "#5b3524", peloLuz: "#8a5a3f", piernaPiel: false },
  // Él: playera, shorts (se le ven las pantorrillas) y pelo corto.
  H: { arriba: "#4f9fd3", arribaSombra: "#3a80b0", abajo: "#2f3b4a", abajoSombra: "#232d39", pelo: "#33221a", peloLuz: "#5a3d2c", piernaPiel: true },
};
const PIEL = "#f1c4a0", PIEL_SOMBRA = "#d9a47f", CONTORNO = "rgba(45, 28, 22, 0.55)";

/** Una extremidad: un trazo de punta redonda con un contorno suave. */
function trazo(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, ancho: number, color: string): void {
  c.lineCap = "round";
  c.strokeStyle = CONTORNO; c.lineWidth = ancho + Math.max(0.8, ancho * 0.18);
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.strokeStyle = color; c.lineWidth = ancho;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}

function relleno(c: CanvasRenderingContext2D, color: string | CanvasGradient, contorno = true): void {
  c.fillStyle = color; c.fill();
  if (contorno) { c.strokeStyle = CONTORNO; c.lineWidth = 0.9; c.stroke(); }
}

/**
 * Dibuja al habitante con los pies en (x, y). `u` es su escala: mide ~3.4 u de alto. `t` son los
 * segundos del reloj, para la animación (pasos, pelo, parpadeo, respiración).
 */
export function pintarHabitante(c: CanvasRenderingContext2D, x: number, y: number, u: number, sexo: Sexo, h: Pick<Habitante, "accion" | "mira" | "desde">, t: number): void {
  const e = ESTILO[sexo];
  const accion = h.accion;
  const fase = (t - h.desde) * 8.5;
  const camina = accion === "camina";
  const andar = camina ? Math.sin(fase) : 0;
  const baja = accion === "ejercicio" ? (1 - Math.cos((t - h.desde) * 3.6)) / 2 : 0;
  const sentado = accion === "sentado";
  const rebote = camina ? Math.abs(Math.cos(fase)) * 0.06 * u : Math.sin(t * 2) * 0.015 * u;

  c.save();
  c.translate(x, y);
  // Sombra en el piso.
  c.fillStyle = "rgba(20, 30, 15, 0.28)";
  c.beginPath(); c.ellipse(0, 0, u * 0.42, u * 0.13, 0, 0, Math.PI * 2); c.fill();
  c.scale(h.mira, 1);

  // Alturas del cuerpo.
  const cadera = sentado ? -0.95 * u : -(1.5 - baja * 0.55) * u - rebote;
  const inclina = baja * 0.25 * u;
  const hombro = cadera - 1.0 * u;
  const cuello = hombro - 0.12 * u;
  const cabeza = cuello - 0.36 * u;
  const r = 0.35 * u;

  // Pelo largo de ella, detrás del cuerpo: cae por la espalda y se mece al caminar.
  if (sexo === "M") peloLargo(c, u, r, inclina, cabeza, hombro, e.pelo, e.peloLuz, camina ? fase : t * 1.6, camina, h.mira);

  // Piernas: muslo y pantorrilla; la de atrás un poco más oscura.
  const pierna = (lado: number, color: string, piel: string) => {
    const hx = lado * 0.1 * u;
    let rodX: number, rodY: number, pieX: number, pieY: number;
    if (sentado) {
      rodX = hx + 0.55 * u; rodY = cadera; pieX = hx + 0.62 * u; pieY = 0;
    } else if (baja > 0) {
      pieX = hx; pieY = 0; rodX = hx + 0.45 * u * baja; rodY = (cadera + pieY) / 2;
    } else {
      // El muslo va y viene; la pantorrilla lo sigue a medias (la rodilla apenas se dobla) y el
      // pie que va atrás se levanta un poquito del piso.
      const a = andar * lado * 0.36;
      rodX = hx + Math.sin(a) * 0.72 * u; rodY = cadera + Math.cos(a) * 0.72 * u;
      const b = a * 0.45 - (a < 0 ? 0.25 * -a : 0);
      pieX = rodX + Math.sin(b) * 0.72 * u; pieY = Math.min(0, rodY + Math.cos(b) * 0.72 * u);
    }
    trazo(c, hx, cadera, rodX, rodY, 0.24 * u, color);
    trazo(c, rodX, rodY, pieX, pieY - 0.05 * u, (e.piernaPiel ? 0.19 : 0.21) * u, piel);
    // Tenis.
    c.beginPath(); c.ellipse(pieX + 0.08 * u, pieY - 0.05 * u, 0.17 * u, 0.08 * u, 0, 0, Math.PI * 2);
    relleno(c, "#f7f7f7");
    c.fillStyle = sexo === "M" ? "#ef7f97" : "#4f9fd3"; c.fillRect(pieX - 0.04 * u, pieY - 0.07 * u, 0.18 * u, 0.03 * u);
  };
  pierna(-1, e.abajoSombra, e.piernaPiel ? PIEL_SOMBRA : e.abajoSombra);

  // Brazo de atrás.
  const brazo = (lado: number, color: string, piel: string) => {
    const sx = lado * 0.2 * u + inclina, sy = hombro + 0.1 * u;
    let a = -andar * lado * 0.55;
    if (baja > 0 || accion === "ejercicio") a = -1.45;
    if (accion === "admira" && lado > 0) a = -2.5 + Math.sin(t * 3) * 0.08;
    if (sentado) a = -0.5;
    const cx = sx + Math.sin(-a) * 0.45 * u, cy = sy + Math.cos(a) * 0.45 * u;
    const a2 = a * (sentado ? 1.6 : 1.15);
    const mx = cx + Math.sin(-a2) * 0.42 * u, my = cy + Math.cos(a2) * 0.42 * u;
    trazo(c, sx, sy, cx, cy, 0.16 * u, color);
    trazo(c, cx, cy, mx, my, 0.14 * u, piel);
    c.beginPath(); c.arc(mx, my, 0.085 * u, 0, Math.PI * 2); relleno(c, piel);
  };
  brazo(-1, sexo === "M" ? PIEL_SOMBRA : e.arribaSombra, PIEL_SOMBRA);

  // Torso: él con playera recta; ella con top y cintura.
  c.beginPath();
  if (sexo === "M") {
    c.moveTo(-0.22 * u + inclina, hombro + 0.02 * u);
    c.quadraticCurveTo(0 + inclina, hombro - 0.06 * u, 0.22 * u + inclina, hombro + 0.02 * u);
    c.quadraticCurveTo(0.16 * u + inclina * 0.5, cadera - 0.45 * u, 0.2 * u, cadera + 0.04 * u);
    c.lineTo(-0.2 * u, cadera + 0.04 * u);
    c.quadraticCurveTo(-0.16 * u + inclina * 0.5, cadera - 0.45 * u, -0.22 * u + inclina, hombro + 0.02 * u);
  } else {
    c.moveTo(-0.26 * u + inclina, hombro + 0.02 * u);
    c.quadraticCurveTo(0 + inclina, hombro - 0.07 * u, 0.26 * u + inclina, hombro + 0.02 * u);
    c.lineTo(0.22 * u, cadera + 0.06 * u);
    c.lineTo(-0.22 * u, cadera + 0.06 * u);
  }
  c.closePath();
  const torso = c.createLinearGradient(-0.25 * u, 0, 0.25 * u, 0);
  if (sexo === "M") {
    // Piel en la panza y el top encima.
    torso.addColorStop(0, PIEL_SOMBRA); torso.addColorStop(1, PIEL);
    relleno(c, torso);
    c.beginPath();
    c.moveTo(-0.22 * u + inclina, hombro + 0.02 * u);
    c.quadraticCurveTo(inclina, hombro - 0.06 * u, 0.22 * u + inclina, hombro + 0.02 * u);
    c.lineTo(0.19 * u + inclina * 0.7, hombro + 0.48 * u); c.lineTo(-0.19 * u + inclina * 0.7, hombro + 0.48 * u); c.closePath();
    const top = c.createLinearGradient(-0.25 * u, 0, 0.25 * u, 0); top.addColorStop(0, e.arribaSombra); top.addColorStop(1, e.arriba);
    relleno(c, top);
    // Leggings de talle alto.
    c.beginPath(); c.moveTo(-0.2 * u, cadera - 0.22 * u); c.lineTo(0.2 * u, cadera - 0.22 * u); c.lineTo(0.22 * u, cadera + 0.08 * u); c.lineTo(-0.22 * u, cadera + 0.08 * u); c.closePath();
    relleno(c, e.abajo);
  } else {
    torso.addColorStop(0, e.arribaSombra); torso.addColorStop(1, e.arriba);
    relleno(c, torso);
    c.beginPath(); c.moveTo(-0.22 * u, cadera - 0.06 * u); c.lineTo(0.22 * u, cadera - 0.06 * u); c.lineTo(0.23 * u, cadera + 0.1 * u); c.lineTo(-0.23 * u, cadera + 0.1 * u); c.closePath();
    relleno(c, e.abajo);
  }

  // Pierna y brazo de enfrente.
  pierna(1, e.abajo, e.piernaPiel ? PIEL : e.abajo);
  brazo(1, sexo === "M" ? PIEL : e.arriba, PIEL);

  // Cuello y cabeza (tres cuartos, mirando hacia donde va).
  trazo(c, inclina, hombro, inclina + 0.02 * u, cuello, 0.14 * u, PIEL_SOMBRA);
  const hx = inclina + 0.02 * u;
  const cara = c.createRadialGradient(hx + r * 0.3, cabeza - r * 0.3, r * 0.1, hx, cabeza, r);
  cara.addColorStop(0, "#f7d3b4"); cara.addColorStop(1, PIEL);
  c.beginPath(); c.ellipse(hx, cabeza, r * 0.92, r, 0, 0, Math.PI * 2); relleno(c, cara);
  // Oreja (a ella se la tapa el pelo).
  if (sexo === "H") { c.beginPath(); c.ellipse(hx - r * 0.25, cabeza + r * 0.05, r * 0.14, r * 0.2, 0, 0, Math.PI * 2); relleno(c, PIEL_SOMBRA); }
  // Cara: ojos (parpadean), ceja, nariz y boca.
  const mirarArriba = accion === "admira" ? -r * 0.18 : 0;
  const ojoY = cabeza + r * 0.02 + mirarArriba;
  const parpadea = (t % 4.3) < 0.12 || sentado && (t % 6) < 1.5;
  c.fillStyle = "#2a1a14";
  for (const ox of [hx + r * 0.32, hx + r * 0.7]) {
    if (parpadea) c.fillRect(ox - r * 0.09, ojoY, r * 0.18, Math.max(0.6, r * 0.04));
    else { c.beginPath(); c.ellipse(ox, ojoY, r * 0.06, r * 0.1, 0, 0, Math.PI * 2); c.fill(); }
  }
  c.strokeStyle = e.pelo; c.lineWidth = Math.max(0.6, r * 0.06); c.lineCap = "round";
  c.beginPath(); c.moveTo(hx + r * 0.22, ojoY - r * 0.2); c.lineTo(hx + r * 0.42, ojoY - r * 0.24); c.stroke();
  c.beginPath(); c.moveTo(hx + r * 0.62, ojoY - r * 0.24); c.lineTo(hx + r * 0.8, ojoY - r * 0.2); c.stroke();
  c.fillStyle = "rgba(235, 120, 120, 0.35)"; c.beginPath(); c.ellipse(hx + r * 0.5, ojoY + r * 0.25, r * 0.12, r * 0.07, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#9a4f3d"; c.lineWidth = Math.max(0.6, r * 0.06);
  c.beginPath(); c.arc(hx + r * 0.55, ojoY + r * 0.38, r * 0.12, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  c.lineCap = "butt";

  // Pelo de enfrente.
  if (sexo === "M") flequillo(c, hx, cabeza, r, e.pelo, e.peloLuz);
  else peloCorto(c, hx, cabeza, r, e.pelo, e.peloLuz);
  c.restore();

  // Lo que flota arriba: corazoncitos al admirar, notitas sentado, gotitas de sudor al hacer ejercicio.
  const k = (t * 0.7) % 1;
  const arriba = y + cabeza - r * 1.6;
  if (accion === "admira") {
    c.fillStyle = `rgba(255, 110, 150, ${1 - k})`;
    corazon(c, x + h.mira * u * 0.45, arriba - k * u * 0.6, u * 0.16);
  } else if (accion === "sentado") {
    c.fillStyle = `rgba(255, 255, 255, ${0.9 - k * 0.9})`;
    c.font = `800 ${Math.max(8, Math.round(u * 0.4))}px system-ui, sans-serif`; c.textAlign = "center";
    c.fillText("♪", x + u * 0.5, arriba - k * u * 0.5);
  } else if (accion === "ejercicio") {
    c.fillStyle = `rgba(140, 200, 255, ${1 - k})`;
    c.beginPath(); c.ellipse(x + u * 0.45, arriba + u * 0.3 + k * u * 0.4, u * 0.05, u * 0.08, 0, 0, Math.PI * 2); c.fill();
  }
}

/**
 * El pelo largo de ella por detrás: baja hasta media espalda y, al caminar, se va hacia atrás y
 * se mece en ondas (cada mechón con su propio tiempo).
 */
function peloLargo(c: CanvasRenderingContext2D, u: number, r: number, inclina: number, cabeza: number, hombro: number, pelo: string, luz: string, fase: number, camina: boolean, mira: number): void {
  void mira;
  const hx = inclina + 0.02 * u;
  const largo = hombro + 0.85 * u;
  const atras = camina ? 0.16 * u : 0.04 * u;
  const onda = (k: number) => Math.sin(fase * (camina ? 0.5 : 1) + k) * (camina ? 0.07 : 0.025) * u;
  c.beginPath();
  c.moveTo(hx - r * 0.95, cabeza - r * 0.2);
  c.bezierCurveTo(hx - r * 1.25 - atras * 0.4, cabeza + r * 0.8, hx - r * 1.1 - atras + onda(0), largo - 0.3 * u, hx - r * 0.85 - atras + onda(0.6), largo);
  c.quadraticCurveTo(hx - r * 0.35 - atras * 0.7 + onda(1.2), largo + 0.08 * u, hx + r * 0.05 - atras * 0.4 + onda(1.8), largo - 0.06 * u);
  c.bezierCurveTo(hx + r * 0.25 + onda(2.2) * 0.5, hombro + 0.2 * u, hx + r * 0.55, cabeza + r * 0.6, hx + r * 0.6, cabeza - r * 0.3);
  c.closePath();
  const g = c.createLinearGradient(hx - r, 0, hx + r * 0.5, 0);
  g.addColorStop(0, pelo); g.addColorStop(1, luz);
  relleno(c, g);
  // Mechones: líneas de brillo que siguen la onda.
  c.strokeStyle = "rgba(255, 220, 190, 0.22)"; c.lineWidth = Math.max(0.6, u * 0.03);
  for (const f of [0.25, 0.55]) {
    c.beginPath();
    c.moveTo(hx - r * (0.9 - f), cabeza + r * 0.3);
    c.quadraticCurveTo(hx - r * (1.05 - f) - atras * 0.6 + onda(f * 3), hombro + 0.3 * u, hx - r * (0.8 - f) - atras + onda(f * 3 + 0.8), largo - 0.08 * u);
    c.stroke();
  }
}

/** Fleco y coronilla de ella (lo que va encima de la cabeza). */
function flequillo(c: CanvasRenderingContext2D, hx: number, cy: number, r: number, pelo: string, luz: string): void {
  c.beginPath();
  c.moveTo(hx - r * 0.95, cy + r * 0.2);
  c.bezierCurveTo(hx - r * 1.05, cy - r * 1.15, hx + r * 0.6, cy - r * 1.35, hx + r * 0.95, cy - r * 0.25);
  c.quadraticCurveTo(hx + r * 0.65, cy - r * 0.45, hx + r * 0.35, cy - r * 0.35);
  c.quadraticCurveTo(hx + r * 0.05, cy - r * 0.2, hx - r * 0.3, cy - r * 0.35);
  c.quadraticCurveTo(hx - r * 0.55, cy - r * 0.1, hx - r * 0.95, cy + r * 0.2);
  c.closePath();
  const g = c.createLinearGradient(hx - r, cy - r, hx + r, cy);
  g.addColorStop(0, pelo); g.addColorStop(1, luz);
  relleno(c, g);
  c.strokeStyle = "rgba(255, 230, 200, 0.3)"; c.lineWidth = Math.max(0.6, r * 0.08); c.lineCap = "round";
  c.beginPath(); c.arc(hx, cy - r * 0.1, r * 0.78, Math.PI * 1.2, Math.PI * 1.45); c.stroke();
  c.lineCap = "butt";
}

/** Pelo corto de él, con un copete. */
function peloCorto(c: CanvasRenderingContext2D, hx: number, cy: number, r: number, pelo: string, luz: string): void {
  c.beginPath();
  c.moveTo(hx - r * 0.92, cy + r * 0.15);
  c.bezierCurveTo(hx - r * 1.05, cy - r * 1.1, hx + r * 0.2, cy - r * 1.45, hx + r * 0.95, cy - r * 0.6);
  c.quadraticCurveTo(hx + r * 0.75, cy - r * 0.45, hx + r * 0.5, cy - r * 0.5);
  c.quadraticCurveTo(hx - r * 0.1, cy - r * 0.45, hx - r * 0.45, cy - r * 0.15);
  c.quadraticCurveTo(hx - r * 0.6, cy + r * 0.05, hx - r * 0.92, cy + r * 0.15);
  c.closePath();
  const g = c.createLinearGradient(hx - r, cy - r, hx + r, cy);
  g.addColorStop(0, pelo); g.addColorStop(1, luz);
  relleno(c, g);
}

function corazon(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.2, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  c.fill();
}
