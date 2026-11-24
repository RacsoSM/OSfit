/**
 * El gimnasio de fondo de Kettlebell Bird (entrenador, 2026-11-24: "sé más creativo con el fondo,
 * que haya más detalles"). Cada nivel es una zona distinta del gimnasio, y por los ventanales
 * pasa el día: de la noche en la recepción al amanecer en las pesas, la mañana en el cardio, el
 * mediodía en el box, el atardecer en el boxeo y la noche de neón en la arena.
 *
 * Capas, de atrás hacia adelante, cada una a su velocidad (`r` es lo recorrido):
 *   pared → ventanales y decoración de la pared (0.15) → tuberías y lámparas del techo (0.4)
 *   → aparatos de la zona (0.55) → piso (1) → polvo en el aire.
 * Todo lo que varía por posición sale de `ruido`, así cada ventana o aparato es siempre el mismo.
 */

export interface Zona {
  nombre: string;
  pared: [string, string];
  cielo: [string, string];
  /** Sol, luna o nada en los ventanales. */
  astro: "luna" | "sol-bajo" | "sol" | "sol-alto" | "atardecer" | "ninguno";
  luz: [number, number, number];
  piso: "caucho" | "plataforma" | "pasto" | "lona" | "neon";
  aparatos: "recepcion" | "pesas" | "cardio" | "box" | "boxeo" | "arena";
  /** El color del polvo que flota (magnesio, confeti de neón…). */
  polvo: string;
}

export const ZONAS: readonly Zona[] = [
  { nombre: "Recepción", pared: ["#1a1428", "#2a1d33"], cielo: ["#070b24", "#24183f"], astro: "luna", luz: [255, 220, 170], piso: "caucho", aparatos: "recepcion", polvo: "255, 240, 210" },
  { nombre: "Zona de pesas", pared: ["#24192b", "#36242c"], cielo: ["#2c2456", "#f39a6e"], astro: "sol-bajo", luz: [255, 205, 150], piso: "plataforma", aparatos: "pesas", polvo: "255, 255, 255" },
  { nombre: "Cardio", pared: ["#152130", "#1f2e3d"], cielo: ["#4f9be3", "#c9e8ff"], astro: "sol", luz: [210, 235, 255], piso: "caucho", aparatos: "cardio", polvo: "220, 240, 255" },
  { nombre: "Box funcional", pared: ["#1e201b", "#2d3026"], cielo: ["#3c95e8", "#a6d8ff"], astro: "sol-alto", luz: [255, 250, 235], piso: "pasto", aparatos: "box", polvo: "255, 255, 255" },
  { nombre: "Boxeo", pared: ["#2a1516", "#3d1e1a"], cielo: ["#5a2a6a", "#f07a3c"], astro: "atardecer", luz: [255, 170, 110], piso: "lona", aparatos: "boxeo", polvo: "255, 200, 150" },
  { nombre: "Arena neón", pared: ["#0b0918", "#1a0c2c"], cielo: ["#04061a", "#160a2e"], astro: "ninguno", luz: [255, 80, 220], piso: "neon", aparatos: "arena", polvo: "126, 243, 255" },
];

const mod = (a: number, b: number) => ((a % b) + b) % b;
export const ruido = (n: number) => mod(Math.sin(n * 12.9898) * 43758.5453, 1);
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

/** Recorre los huecos de una capa: `paso` es su separación en px y `corre` lo que se ha movido. */
function repetir(W: number, paso: number, corre: number, f: (i: number, x: number) => void): void {
  for (let i = Math.floor(corre / paso) - 1; i * paso - corre < W + paso; i++) f(i, i * paso - corre);
}

function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color; c.fillRect(x, y, w, h);
}

// ── Capa lejana: ventanales y lo que cuelga en la pared ──────────────────────

function ventanal(c: CanvasRenderingContext2D, z: Zona, i: number, x: number, e: number, t: number): void {
  const vx = x + 8 * e, vy = 10 * e, vw = 40 * e, vh = 34 * e;
  const cielo = c.createLinearGradient(0, vy, 0, vy + vh);
  cielo.addColorStop(0, z.cielo[0]); cielo.addColorStop(1, z.cielo[1]);
  c.fillStyle = cielo; c.fillRect(vx, vy, vw, vh);
  c.save(); c.beginPath(); c.rect(vx, vy, vw, vh); c.clip();
  const noche = z.astro === "luna" || z.astro === "ninguno";
  if (noche) for (let k = 0; k < 9; k++) {
    c.fillStyle = `rgba(255, 255, 255, ${0.3 + 0.5 * Math.abs(Math.sin(t * 1.5 + k + i))})`;
    c.fillRect(vx + ruido(i * 13 + k) * vw, vy + ruido(i * 17 + k) * vh * 0.5, 1.5, 1.5);
  }
  // El sol o la luna, a la altura de la hora del día.
  const alto = { "luna": 0.25, "sol-bajo": 0.72, "sol": 0.35, "sol-alto": 0.12, "atardecer": 0.62, "ninguno": -1 }[z.astro];
  if (alto >= 0 && ruido(i * 3) < 0.5) {
    const ax = vx + vw * (0.3 + ruido(i) * 0.4), ay = vy + vh * alto, ar = 4.5 * e;
    const halo = c.createRadialGradient(ax, ay, 0, ax, ay, ar * 3);
    halo.addColorStop(0, z.astro === "luna" ? "rgba(220, 230, 255, 0.5)" : "rgba(255, 220, 150, 0.6)"); halo.addColorStop(1, "rgba(255, 220, 150, 0)");
    c.fillStyle = halo; c.fillRect(ax - ar * 3, ay - ar * 3, ar * 6, ar * 6);
    c.fillStyle = z.astro === "luna" ? "#e8ecf7" : z.astro === "atardecer" || z.astro === "sol-bajo" ? "#ffb45c" : "#fff4c8";
    c.beginPath(); c.arc(ax, ay, ar, 0, Math.PI * 2); c.fill();
  }
  // Nubes de día.
  if (!noche) for (let k = 0; k < 2; k++) {
    const nx = vx + mod(ruido(i * 7 + k) * vw + t * 4 * e * 0.2, vw + 20 * e) - 10 * e, ny = vy + (6 + k * 9) * e;
    c.fillStyle = z.astro === "atardecer" ? "rgba(255, 190, 160, 0.55)" : "rgba(255, 255, 255, 0.7)";
    for (const [dx, dy, rr] of [[0, 0, 3], [3, -1.2, 3.4], [6.5, 0, 2.8]] as const) { c.beginPath(); c.arc(nx + dx * e, ny + dy * e, rr * e, 0, Math.PI * 2); c.fill(); }
  }
  // La ciudad, con luces de noche.
  for (let k = 0; k < 7; k++) {
    const bh = (7 + ruido(i * 7 + k) * 17) * e, bx = vx + (k * vw) / 7;
    rect(c, bx, vy + vh - bh, vw / 7 - 1.5, bh, noche ? "#0d1130" : "rgba(60, 70, 100, 0.75)");
    if (noche) { c.fillStyle = "rgba(255, 214, 120, 0.75)"; for (let w = 0; w < 5; w++) if (ruido(i * 31 + k * 5 + w) > 0.5) c.fillRect(bx + 2.5, vy + vh - bh + 4 + w * 5.5, 2.2, 2.2); }
  }
  c.restore();
  // Marco con su cruceta.
  c.strokeStyle = "#3b2d4d"; c.lineWidth = Math.max(2, e * 0.8);
  c.strokeRect(vx, vy, vw, vh);
  c.beginPath(); c.moveTo(vx + vw / 2, vy); c.lineTo(vx + vw / 2, vy + vh); c.moveTo(vx, vy + vh * 0.55); c.lineTo(vx + vw, vy + vh * 0.55); c.stroke();
  // Reflejo en el vidrio.
  c.fillStyle = "rgba(255, 255, 255, 0.06)";
  c.beginPath(); c.moveTo(vx + vw * 0.1, vy); c.lineTo(vx + vw * 0.25, vy); c.lineTo(vx + vw * 0.05, vy + vh); c.lineTo(vx - vw * 0.1 + vw * 0.1, vy + vh); c.fill();
}

function neon(c: CanvasRenderingContext2D, texto: string, x: number, y: number, tam: number, color: string, t: number, k: number): void {
  const prende = Math.sin(t * 7 + k) > -0.97 ? 1 : 0.3; // a veces parpadea
  c.save();
  c.font = `900 ${Math.round(tam)}px system-ui, sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.shadowColor = color; c.shadowBlur = 10 * prende;
  c.fillStyle = color; c.globalAlpha = 0.45 * prende;
  c.fillText(texto, x, y);
  c.restore();
}

/** Lo que cuelga en la pared entre ventanales: cambia con la zona. */
function decoracion(c: CanvasRenderingContext2D, z: Zona, i: number, x: number, e: number, t: number): void {
  const cx = x + 28 * e;
  switch (z.aparatos) {
    case "recepcion":
      if (ruido(i + 9) < 0.5) neon(c, "OSFIT", cx, 26 * e, 9 * e, "#ff3bd4", t, i);
      else reloj(c, cx, 24 * e, 6 * e, t);
      break;
    case "pesas": {
      // Espejo de pared con su reflejo y un póster.
      rect(c, x + 6 * e, 12 * e, 44 * e, 40 * e, "rgba(150, 170, 200, 0.10)");
      c.strokeStyle = "rgba(220, 230, 255, 0.25)"; c.lineWidth = 2; c.strokeRect(x + 6 * e, 12 * e, 44 * e, 40 * e);
      c.fillStyle = "rgba(255, 255, 255, 0.08)";
      c.beginPath(); c.moveTo(x + 12 * e, 12 * e); c.lineTo(x + 20 * e, 12 * e); c.lineTo(x + 10 * e, 52 * e); c.lineTo(x + 6 * e, 52 * e); c.fill();
      c.save(); c.font = `900 ${Math.round(4 * e)}px system-ui, sans-serif`; c.textAlign = "center"; c.fillStyle = "rgba(255, 205, 150, 0.55)";
      c.fillText(ruido(i) < 0.5 ? "NO PAIN" : "LIFT", cx, 8 * e); c.restore();
      break;
    }
    case "cardio":
      // Pantallas con la frecuencia cardiaca.
      rect(c, x + 12 * e, 14 * e, 32 * e, 18 * e, "#0b1622");
      c.strokeStyle = "#ff5a6a"; c.lineWidth = Math.max(1.5, e * 0.5); c.beginPath();
      for (let k = 0; k <= 32; k++) {
        const fase = (k + t * 18) % 12;
        const yy = 23 * e - (fase > 5 && fase < 6 ? 7 : fase > 6 && fase < 7 ? -4 : 0) * e;
        if (k === 0) c.moveTo(x + 12 * e + k * e, yy); else c.lineTo(x + 12 * e + k * e, yy);
      }
      c.stroke();
      c.save(); c.font = `800 ${Math.round(3 * e)}px ui-monospace, monospace`; c.fillStyle = "#7ef3ff";
      c.fillText(`${128 + Math.round(ruido(i) * 30)} BPM`, x + 14 * e, 30 * e); c.restore();
      break;
    case "box": {
      // Pizarrón con el WOD del día.
      rect(c, x + 10 * e, 12 * e, 36 * e, 28 * e, "#1d2a22");
      c.strokeStyle = "#6b5a3a"; c.lineWidth = Math.max(2, e * 0.8); c.strokeRect(x + 10 * e, 12 * e, 36 * e, 28 * e);
      c.save(); c.fillStyle = "rgba(240, 240, 230, 0.8)"; c.font = `700 ${Math.round(3.2 * e)}px "Comic Sans MS", system-ui, sans-serif`;
      const lineas = ruido(i) < 0.5 ? ["WOD", "21-15-9", "Thrusters", "Pull-ups"] : ["AMRAP 12", "10 Wall balls", "10 Box jumps", "10 Swings"];
      lineas.forEach((l, k) => c.fillText(l, x + 13 * e, (18 + k * 5.5) * e));
      c.restore();
      break;
    }
    case "boxeo":
      // Cartel de pelea.
      rect(c, x + 14 * e, 10 * e, 26 * e, 36 * e, "#e8d9b0");
      rect(c, x + 14 * e, 10 * e, 26 * e, 8 * e, "#b3261e");
      c.save(); c.textAlign = "center"; c.fillStyle = "#fff"; c.font = `900 ${Math.round(4 * e)}px system-ui, sans-serif`;
      c.fillText("FIGHT", cx - 1 * e, 15.5 * e);
      c.fillStyle = "#1a1a1a"; c.font = `900 ${Math.round(3.4 * e)}px system-ui, sans-serif`;
      c.fillText("NIGHT", cx - 1 * e, 25 * e); c.font = `700 ${Math.round(2.4 * e)}px system-ui, sans-serif`;
      c.fillText("OSFIT · SÁB 21:00", cx - 1 * e, 31 * e);
      c.restore();
      break;
    case "arena":
      neon(c, ruido(i) < 0.5 ? "LEVEL UP" : "ARCADE", cx, 24 * e, 6 * e, ruido(i + 1) < 0.5 ? "#ff3bd4" : "#7ef3ff", t, i);
      break;
  }
}

function reloj(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  c.fillStyle = "#f2efe8"; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#2a2a2a"; c.lineWidth = Math.max(2, r * 0.12); c.stroke();
  c.lineWidth = Math.max(1, r * 0.08);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); c.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); c.stroke(); }
  const aguja = (a: number, l: number, w: number, col: string) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); };
  aguja(-Math.PI / 2 + t * 0.05, r * 0.5, Math.max(2, r * 0.12), "#2a2a2a");
  aguja(-Math.PI / 2 + t * 0.6, r * 0.75, Math.max(1.5, r * 0.08), "#2a2a2a");
  aguja(-Math.PI / 2 + t * 6, r * 0.8, 1, "#c9302a");
}

// ── El techo: tuberías y lámparas ────────────────────────────────────────────

function techo(c: CanvasRenderingContext2D, z: Zona, W: number, e: number, piso: number, r: number, t: number): void {
  const corre = r * 0.4 * e;
  // Dos tuberías largas con sus abrazaderas.
  for (const [yy, grosor, color] of [[2.5, 2.2, "#3a3346"], [5.5, 1.3, "#4a3f3a"]] as const) {
    const g = c.createLinearGradient(0, yy * e, 0, (yy + grosor) * e);
    g.addColorStop(0, color); g.addColorStop(0.35, "#6a6278"); g.addColorStop(1, "#1d1826");
    c.fillStyle = g; c.fillRect(0, yy * e, W, grosor * e);
    repetir(W, 30 * e, corre, (_, x) => rect(c, x, (yy - 0.4) * e, 1.2 * e, (grosor + 0.8) * e, "#1a1622"));
  }
  // Lámparas industriales con su cono de luz.
  repetir(W, 46 * e, corre, (i, x0) => {
    const x = x0 + 20 * e;
    c.strokeStyle = "#2c2238"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, 4 * e); c.lineTo(x, 9 * e); c.stroke();
    const luz: [number, number, number] = z.aparatos === "arena" ? (i % 2 ? [255, 59, 212] : [126, 243, 255]) : z.luz;
    c.fillStyle = "#3a3048"; c.beginPath(); c.moveTo(x - 4.5 * e, 11.5 * e); c.lineTo(x + 4.5 * e, 11.5 * e); c.lineTo(x + 2 * e, 9 * e); c.lineTo(x - 2 * e, 9 * e); c.fill();
    c.fillStyle = rgba(luz, 0.9); c.beginPath(); c.ellipse(x, 11.5 * e, 3.6 * e, 0.8 * e, 0, 0, Math.PI * 2); c.fill();
    const cono = c.createLinearGradient(0, 11.5 * e, 0, piso);
    cono.addColorStop(0, rgba(luz, z.aparatos === "arena" ? 0.22 : 0.17)); cono.addColorStop(1, rgba(luz, 0));
    c.fillStyle = cono;
    const vaiven = z.aparatos === "arena" ? Math.sin(t * 1.4 + i) * 10 * e : 0;
    c.beginPath(); c.moveTo(x - 4 * e, 11.5 * e); c.lineTo(x + 4 * e, 11.5 * e); c.lineTo(x + 18 * e + vaiven, piso); c.lineTo(x - 18 * e + vaiven, piso); c.fill();
  });
}

// ── Los aparatos de cada zona ────────────────────────────────────────────────

const SIL = "#241b31", BORDE = "#3a2c4c";

function aparatos(c: CanvasRenderingContext2D, z: Zona, W: number, e: number, piso: number, r: number, t: number): void {
  const corre = r * 0.55 * e;
  c.save();
  c.lineWidth = Math.max(2, e * 0.9);
  repetir(W, 52 * e, corre, (i, x) => {
    c.fillStyle = SIL; c.strokeStyle = BORDE;
    const k = Math.floor(ruido(i * 3 + 1) * 3);
    switch (z.aparatos) {
      case "recepcion":
        if (k === 0) {
          // Mostrador con el logo.
          c.fillRect(x + 4 * e, piso - 14 * e, 40 * e, 14 * e); c.strokeRect(x + 4 * e, piso - 14 * e, 40 * e, 14 * e);
          rect(c, x + 2 * e, piso - 15.5 * e, 44 * e, 2 * e, "#4a3a5e");
          c.save(); c.font = `900 ${Math.round(4.5 * e)}px system-ui, sans-serif`; c.textAlign = "center"; c.fillStyle = "rgba(255, 59, 212, 0.6)"; c.fillText("OSFIT", x + 24 * e, piso - 5 * e); c.restore();
        } else if (k === 1) {
          // Maceta con su planta.
          rect(c, x + 16 * e, piso - 9 * e, 10 * e, 9 * e, "#3d2c26");
          c.fillStyle = "#1f4a33";
          for (let h = 0; h < 7; h++) { const a = -Math.PI / 2 + (h - 3) * 0.32 + Math.sin(t + h) * 0.03; c.beginPath(); c.ellipse(x + 21 * e + Math.cos(a) * 8 * e, piso - 9 * e + Math.sin(a) * 9 * e, 2.4 * e, 6 * e, a + Math.PI / 2, 0, Math.PI * 2); c.fill(); }
        } else {
          // Lockers.
          for (let l = 0; l < 4; l++) { c.fillRect(x + (6 + l * 9) * e, piso - 30 * e, 8 * e, 30 * e); c.strokeRect(x + (6 + l * 9) * e, piso - 30 * e, 8 * e, 30 * e); rect(c, x + (12 + l * 9) * e, piso - 18 * e, 0.8 * e, 3 * e, "#7a6a8e"); }
        }
        break;
      case "pesas":
        if (k === 0) {
          const a = piso - 40 * e;
          c.strokeRect(x + 6 * e, a, 26 * e, 40 * e);
          c.beginPath(); c.moveTo(x + 6 * e, a + 14 * e); c.lineTo(x + 32 * e, a + 14 * e); c.stroke();
          rect(c, x - 2 * e, a + 11 * e, 42 * e, 1.6 * e, "#5a4c6e");
          for (const dx of [-1, 34]) for (const [w, h] of [[2.6, 11], [2, 8]] as const) rect(c, x + (dx + (dx < 0 ? 0 : 0)) * e, a + (12 - h / 2) * e, w * e, h * e, "#3a2f4c");
        } else if (k === 1) {
          const a = piso - 20 * e;
          c.fillRect(x + 4 * e, a, 40 * e, 3 * e); c.fillRect(x + 4 * e, a + 9 * e, 40 * e, 3 * e);
          for (let m = 0; m < 6; m++) for (const fila of [a - 2.5 * e, a + 6.5 * e]) { rect(c, x + (6 + m * 6.5) * e, fila, 1.6 * e, 3 * e, "#4a3d60"); rect(c, x + (9.4 + m * 6.5) * e, fila, 1.6 * e, 3 * e, "#4a3d60"); }
        } else {
          // Banca con su barra en los soportes.
          c.fillRect(x + 10 * e, piso - 7 * e, 22 * e, 2.5 * e); c.fillRect(x + 12 * e, piso - 7 * e, 1.6 * e, 7 * e); c.fillRect(x + 28 * e, piso - 7 * e, 1.6 * e, 7 * e);
          c.fillRect(x + 8 * e, piso - 18 * e, 1.6 * e, 18 * e); c.fillRect(x + 32 * e, piso - 18 * e, 1.6 * e, 18 * e);
          rect(c, x + 2 * e, piso - 17 * e, 38 * e, 1.2 * e, "#5a4c6e");
          rect(c, x + 1 * e, piso - 21 * e, 2.4 * e, 9 * e, "#3a2f4c"); rect(c, x + 38.6 * e, piso - 21 * e, 2.4 * e, 9 * e, "#3a2f4c");
        }
        break;
      case "cardio":
        for (let m = 0; m < 2; m++) {
          const mx = x + m * 24 * e;
          if ((k + m) % 2 === 0) {
            // Caminadora con su pantalla encendida.
            c.beginPath(); c.moveTo(mx + 2 * e, piso); c.lineTo(mx + 20 * e, piso); c.lineTo(mx + 18 * e, piso - 5 * e); c.lineTo(mx + 4 * e, piso - 5 * e); c.closePath(); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(mx + 18 * e, piso - 5 * e); c.lineTo(mx + 21 * e, piso - 24 * e); c.stroke();
            rect(c, mx + 16 * e, piso - 26 * e, 8 * e, 3 * e, "rgba(126, 243, 255, 0.55)");
          } else {
            // Bicicleta fija.
            c.beginPath(); c.arc(mx + 8 * e, piso - 5 * e, 5 * e, 0, Math.PI * 2); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(mx + 8 * e, piso - 5 * e); c.lineTo(mx + 14 * e, piso - 16 * e); c.lineTo(mx + 18 * e, piso - 18 * e); c.moveTo(mx + 8 * e, piso - 5 * e); c.lineTo(mx + 6 * e, piso - 15 * e); c.stroke();
            rect(c, mx + 3 * e, piso - 16 * e, 6 * e, 1.6 * e, BORDE);
          }
        }
        break;
      case "box":
        if (k === 0) {
          // El rig: estructura con barras de dominadas y cuerdas que se mecen.
          c.strokeRect(x + 4 * e, piso - 44 * e, 40 * e, 44 * e);
          c.beginPath(); c.moveTo(x + 4 * e, piso - 34 * e); c.lineTo(x + 44 * e, piso - 34 * e); c.stroke();
          c.strokeStyle = "#8a6a3e"; c.lineWidth = Math.max(2, e * 0.9);
          for (const cx of [14, 30]) { const vaiven = Math.sin(t * 1.3 + cx + i) * 2.2 * e; c.beginPath(); c.moveTo(x + cx * e, piso - 44 * e); c.quadraticCurveTo(x + cx * e + vaiven, piso - 22 * e, x + cx * e + vaiven * 1.6, piso - 4 * e); c.stroke(); }
        } else if (k === 1) {
          // Cajones de salto apilados.
          for (const [bx, by, bw, bh] of [[6, 0, 18, 12], [26, 0, 16, 10], [10, 12, 14, 9]] as const) { c.fillRect(x + bx * e, piso - (by + bh) * e, bw * e, bh * e); c.strokeRect(x + bx * e, piso - (by + bh) * e, bw * e, bh * e); }
        } else {
          // Llantas y balones medicinales.
          c.fillStyle = "#151218";
          c.beginPath(); c.ellipse(x + 16 * e, piso - 4 * e, 12 * e, 4 * e, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = "#3a2f2a"; c.beginPath(); c.ellipse(x + 16 * e, piso - 4 * e, 6 * e, 1.8 * e, 0, 0, Math.PI * 2); c.fill();
          for (const bx of [34, 40]) { c.fillStyle = "#3d3050"; c.beginPath(); c.arc(x + bx * e, piso - 3 * e, 3 * e, 0, Math.PI * 2); c.fill(); }
        }
        break;
      case "boxeo":
        if (k <= 1) {
          // Costal colgando que se mece.
          const ang = Math.sin(t * 1.6 + i) * 0.08;
          c.save(); c.translate(x + 22 * e, 10 * e); c.rotate(ang);
          c.strokeStyle = "#5a4c6e"; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 14 * e); c.stroke();
          const g = c.createLinearGradient(-4 * e, 0, 4 * e, 0); g.addColorStop(0, "#4a1a18"); g.addColorStop(0.4, "#8a2a24"); g.addColorStop(1, "#3a1412");
          c.fillStyle = g; caja(c, -4.5 * e, 14 * e, 9 * e, 26 * e, 3 * e); c.fill();
          rect(c, -4.5 * e, 20 * e, 9 * e, 1.2 * e, "#1a0a0a"); rect(c, -4.5 * e, 34 * e, 9 * e, 1.2 * e, "#1a0a0a");
          c.restore();
        } else {
          // Esquina del ring con sus cuerdas.
          c.fillStyle = "#3a3048"; c.fillRect(x + 4 * e, piso - 22 * e, 3 * e, 22 * e);
          for (const [h, col] of [[19, "#c9302a"], [14, "#f2efe8"], [9, "#2a5fbf"]] as const) rect(c, x + 7 * e, piso - h * e, 44 * e, 1 * e, col);
        }
        break;
      case "arena":
        // Bocinas y armazón de luces.
        c.fillRect(x + 6 * e, piso - 22 * e, 12 * e, 22 * e); c.strokeRect(x + 6 * e, piso - 22 * e, 12 * e, 22 * e);
        for (const [yy, rr] of [[6, 3.4], [15, 4.2]] as const) {
          const pulso = 1 + Math.max(0, Math.sin(t * 8 + i)) * 0.12;
          c.fillStyle = "#0b0a12"; c.beginPath(); c.arc(x + 12 * e, piso - (22 - yy) * e, rr * e * pulso, 0, Math.PI * 2); c.fill();
          c.strokeStyle = "rgba(126, 243, 255, 0.5)"; c.stroke();
        }
        c.strokeStyle = "rgba(255, 59, 212, 0.35)";
        c.strokeRect(x + 24 * e, piso - 36 * e, 22 * e, 36 * e);
        break;
    }
  });
  c.restore();
}

function caja(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// ── El piso ──────────────────────────────────────────────────────────────────

function pisoZona(c: CanvasRenderingContext2D, z: Zona, W: number, H: number, e: number, piso: number, r: number, t: number): void {
  const corre = r * e;
  const base: Record<Zona["piso"], [string, string]> = {
    caucho: ["#26222c", "#121015"], plataforma: ["#24202a", "#121015"], pasto: ["#1f5a2e", "#123a1d"], lona: ["#3a1a1a", "#1a0c0c"], neon: ["#0c0a18", "#05040b"],
  };
  const g = c.createLinearGradient(0, piso, 0, H);
  g.addColorStop(0, base[z.piso][0]); g.addColorStop(1, base[z.piso][1]);
  c.fillStyle = g; c.fillRect(-20, piso, W + 40, H - piso + 20);
  rect(c, -20, piso, W + 40, Math.max(2, e * 0.8), z.piso === "neon" ? "#ff3bd4" : z.piso === "pasto" ? "#2f7a40" : "#3b3346");
  c.lineWidth = 1;
  if (z.piso === "pasto") {
    // Líneas blancas con sus números, como en un box.
    repetir(W, 20 * e, corre, (i, x) => {
      rect(c, x, piso + 1, Math.max(2, e * 0.5), H - piso, "rgba(255, 255, 255, 0.55)");
      c.save(); c.font = `800 ${Math.round(3 * e)}px system-ui, sans-serif`; c.fillStyle = "rgba(255, 255, 255, 0.6)"; c.fillText(String(mod(i, 10) * 10), x + 1.5 * e, piso + 5 * e); c.restore();
    });
  } else if (z.piso === "plataforma") {
    repetir(W, 60 * e, corre, (_, x) => {
      rect(c, x + 10 * e, piso + 1, 30 * e, H - piso, "#7a5230");
      c.strokeStyle = "rgba(40, 22, 10, 0.5)";
      for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(x + (10 + k * 6) * e, piso); c.lineTo(x + (10 + k * 6) * e - 4 * e, H); c.stroke(); }
    });
  } else if (z.piso === "neon") {
    c.strokeStyle = "rgba(255, 59, 212, 0.5)";
    repetir(W, 12 * e, corre, (_, x) => { c.beginPath(); c.moveTo(x, piso); c.lineTo(x - 8 * e, H); c.stroke(); });
    for (let k = 1; k < 4; k++) { const yy = piso + ((H - piso) * k) / 4; c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); }
    c.strokeStyle = `rgba(126, 243, 255, ${0.3 + 0.2 * Math.sin(t * 4)})`; c.beginPath(); c.moveTo(0, piso + 2); c.lineTo(W, piso + 2); c.stroke();
  } else {
    c.strokeStyle = z.piso === "lona" ? "rgba(255, 255, 255, 0.07)" : "rgba(255, 255, 255, 0.05)";
    repetir(W, 16 * e, corre, (_, x) => { c.beginPath(); c.moveTo(x, piso); c.lineTo(x - 6 * e, H); c.stroke(); });
  }
}

// ── Todo junto ───────────────────────────────────────────────────────────────

const motas: { x: number; y: number; v: number; r: number }[] = [];

/** Pinta la zona `z` completa: pared, ventanales y decoración, techo, aparatos y piso. */
export function pintarZona(c: CanvasRenderingContext2D, z: Zona, W: number, H: number, e: number, piso: number, r: number, t: number): void {
  const pared = c.createLinearGradient(0, 0, 0, piso);
  pared.addColorStop(0, z.pared[0]); pared.addColorStop(1, z.pared[1]);
  c.fillStyle = pared; c.fillRect(-20, -20, W + 40, piso + 20);
  // Zoclo y una franja de color en la pared.
  rect(c, -20, piso - 4 * e, W + 40, 4 * e, "rgba(0, 0, 0, 0.25)");
  rect(c, -20, 52 * e, W + 40, 1.2 * e, rgba(z.luz, 0.12));
  const lejos = r * 0.15 * e;
  repetir(W, 70 * e, lejos, (i, x) => {
    if (ruido(i) < 0.6 || ruido(i - 1) >= 0.6) ventanal(c, z, i, x, e, t);
    else decoracion(c, z, i, x, e, t);
  });
  techo(c, z, W, e, piso, r, t);
  aparatos(c, z, W, e, piso, r, t);
  pisoZona(c, z, W, H, e, piso, r, t);
}

/** El polvo (magnesio en las pesas, confeti de luz en la arena) que flota delante de todo. */
export function pintarPolvo(c: CanvasRenderingContext2D, z: Zona, W: number, H: number, dt: number, t: number): void {
  if (motas.length === 0) for (let k = 0; k < 34; k++) motas.push({ x: Math.random(), y: Math.random(), v: 0.01 + Math.random() * 0.03, r: 0.6 + Math.random() * 1.6 });
  for (const m of motas) {
    m.y -= m.v * dt; m.x -= 0.02 * dt;
    if (m.y < 0) { m.y = 1; m.x = Math.random(); }
    if (m.x < 0) m.x = 1;
    c.fillStyle = `rgba(${z.polvo}, ${0.1 + 0.14 * Math.sin(t * 1.3 + m.x * 9) ** 2})`;
    c.beginPath(); c.arc(W * m.x + Math.sin(t * 0.5 + m.y * 6) * 6, H * m.y, m.r, 0, Math.PI * 2); c.fill();
  }
}
