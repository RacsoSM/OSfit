import {
  ALTO, ANCHO_BARRA, PISO, RADIO, aletear, avanzar, nuevoVuelo, type Vuelo,
} from "../kettlebellBird";
import { conPartida, htmlLista, type ApiJuego, type EnvioPartida, type TablaDiscos } from "./juegoDiscos";

/**
 * La pantalla de Kettlebell Bird (lógica en `../kettlebellBird.ts`), del Arcade. Como Torre de
 * discos: toda la pestaña es el juego, vive en su propio contenedor (`#kettlebell`) fuera del
 * repintado, el resultado y el récord salen al instante y guardar va por detrás. Su tabla es
 * otra (`guardarPartidaKettlebell` y `tablaKettlebell` en functions).
 *
 * El fondo es un gimnasio que se va recorriendo (entrenador, 2026-11-24): la pared con ventanas
 * y letreros de neón, las máquinas, las lámparas y el piso, cada capa a su velocidad.
 */

type Estado = "inicio" | "jugando" | "pausa" | "fin";
type Guardado = "nada" | "error";

interface Chispa { x: number; y: number; vx: number; vy: number; vida: number; color: string }
interface Letrero { texto: string; x: number; y: number; vida: number }

let caja: HTMLElement | null = null;
let api: ApiJuego | null = null;
let estado: Estado = "inicio";
let vuelo: Vuelo = nuevoVuelo(60);
let inicio = 0;
let duracion = 0;
let chispas: Chispa[] = [];
let letreros: Letrero[] = [];
let sacudida = 0;
let destello = 0;
/** Segundos desde el último aleteo: las alas baten fuerte y luego planean. */
let aleteo = 1;
let cuadro = 0;
let ultimo = 0;
let reloj = 0;
let tabla: TablaDiscos | null = null;
let errorTabla = false;
let guardado: Guardado = "nada";
let record = false;
let hoja = false;
let idPartida = 0;
let pendientes: { envio: EnvioPartida; id: number }[] = [];
let porConfirmar = 0;

// Solo en desarrollo (Vite lo quita del build): deja leer la partida para grabar demos.
if (import.meta.env?.DEV) (globalThis as { __kettlebell?: () => { vuelo: Vuelo; estado: Estado } }).__kettlebell = () => ({ vuelo, estado });

const LLAVE_TABLA = "osfit:kettlebell-tabla";
function tablaGuardada(): TablaDiscos | null {
  try {
    const t = JSON.parse(globalThis.localStorage?.getItem(LLAVE_TABLA) ?? "null") as TablaDiscos | null;
    return t && Array.isArray(t.filas) && typeof t.tuMejor === "number" ? t : null;
  } catch { return null; }
}
function recordarTabla(t: TablaDiscos): void {
  try { globalThis.localStorage?.setItem(LLAVE_TABLA, JSON.stringify(t)); } catch { /* sin almacenamiento */ }
}

// ── HTML ─────────────────────────────────────────────────────────────────────

export function htmlKettlebell(): string {
  return `
    <div class="jd-pantalla kb-pantalla" id="kb-pantalla">
      <canvas id="kb-canvas" aria-label="Kettlebell Bird"></canvas>
      <div class="jd-hud" aria-live="polite">
        <p class="jd-hud-puntos" id="kb-puntos">0</p>
        <p class="jd-hud-record">Récord <b id="kb-record">—</b></p>
      </div>
      <div class="jd-capa" id="kb-capa"></div>
      <section class="jd-hoja" id="kb-hoja" hidden aria-label="Records">
        <div class="jd-hoja-cabeza">
          <p class="jd-hoja-titulo">Records</p>
          <button type="button" class="jd-cerrar" data-kb="cerrar-hoja" aria-label="Cerrar">✕</button>
        </div>
        <p class="jd-hoja-tuyo" id="kb-tuyo"></p>
        <ol class="jd-lista" id="kb-lista"></ol>
        <button type="button" class="jd-boton" data-kb="jugar">Jugar</button>
      </section>
    </div>`;
}

export function htmlCapaKettlebell(e: Estado, puntos: number, g: Guardado, nuevoRecord: boolean): string {
  if (e === "jugando") return "";
  if (e === "pausa") {
    return `<div class="jd-capa-caja"><p class="jd-capa-titulo">Pausa</p>
      <button type="button" class="jd-boton" data-kb="seguir">Seguir</button></div>`;
  }
  if (e === "inicio") {
    return `
      <div class="jd-capa-caja">
        <p class="jd-capa-marca">OSFIT · Arcade</p>
        <p class="jd-capa-titulo">Kettlebell Bird</p>
        <p class="jd-capa-texto">Toca para que la kettlebell aletee y suba. Pasa por el hueco entre las barras sin tocarlas ni caer al piso. Cada barra que pasas es un punto.</p>
        <button type="button" class="jd-boton" data-kb="jugar">Jugar</button>
        <button type="button" class="jd-boton secundario" data-kb="marcador">Ver marcador</button>
      </div>`;
  }
  const nota = g === "error"
    ? `<p class="jd-capa-nota error">No se pudo guardar tu puntuación. <button type="button" class="jd-enlace" data-kb="reintentar-guardar">Intentar de nuevo</button></p>`
    : "";
  return `
    <div class="jd-capa-caja fin">
      ${nuevoRecord ? `<p class="jd-capa-record">¡Nuevo récord!</p>` : `<p class="jd-capa-marca">¡Pum!</p>`}
      <p class="jd-capa-puntos">${puntos}</p>
      <p class="jd-capa-texto">${puntos === 1 ? "barra pasada" : "barras pasadas"}</p>
      ${nota}
      <button type="button" class="jd-boton" data-kb="jugar">Reintentar</button>
      <button type="button" class="jd-boton secundario" data-kb="marcador">Ver marcador</button>
    </div>`;
}

function q<T extends HTMLElement>(s: string): T | null { return caja?.querySelector<T>(s) ?? null; }

function actualizar(): void {
  if (!caja) return;
  const puntos = q("#kb-puntos");
  if (puntos && puntos.textContent !== String(vuelo.puntos)) {
    puntos.textContent = String(vuelo.puntos);
    puntos.classList.remove("pop"); void puntos.offsetWidth; puntos.classList.add("pop");
  }
  const rec = q("#kb-record"); if (rec) rec.textContent = tabla && tabla.tuMejor > 0 ? String(tabla.tuMejor) : "—";
  q("#kb-pantalla")?.classList.toggle("en-juego", estado === "jugando");
  const capa = q("#kb-capa");
  if (capa) {
    const html = htmlCapaKettlebell(estado, vuelo.puntos, guardado, record);
    if (capa.dataset.html !== html) { capa.innerHTML = html; capa.dataset.html = html; }
    capa.hidden = estado === "jugando" || hoja;
  }
  const h = q("#kb-hoja"); if (h) h.hidden = !hoja;
  const lista = q("#kb-lista"); if (lista) lista.innerHTML = htmlLista(tabla, errorTabla);
  const tuyo = q("#kb-tuyo");
  if (tuyo) {
    const mio = tabla?.filas.find((f) => f.esTuyo);
    tuyo.textContent = mio ? `Vas en el lugar #${mio.puesto} con ${mio.puntos} ${mio.puntos === 1 ? "barra" : "barras"}.` : tabla ? "Juega una partida para entrar al marcador." : "";
  }
}

// ── Marcador (igual que en Torre de discos: al instante, guardar por detrás) ──

async function cargarTabla(): Promise<void> {
  if (!api) return;
  try {
    const t = await api.tabla();
    tabla = porConfirmar > t.tuMejor ? conPartida(t, porConfirmar, api.nombre).tabla : t;
    recordarTabla(tabla);
    errorTabla = false;
  } catch { errorTabla = true; }
  actualizar();
}

function terminarPartida(): void {
  idPartida++;
  if (vuelo.puntos === 0 || !api) return;
  const envio: EnvioPartida = { puntos: vuelo.puntos, apilados: vuelo.puntos, duracionMs: Math.round(duracion) };
  porConfirmar = Math.max(porConfirmar, vuelo.puntos);
  if (tabla) {
    const local = conPartida(tabla, vuelo.puntos, api.nombre);
    tabla = local.tabla;
    record = local.record;
    recordarTabla(tabla);
  }
  actualizar();
  void enviar(envio, idPartida, 1);
}

async function enviar(envio: EnvioPartida, id: number, intento: number): Promise<void> {
  if (!api) return;
  try {
    const r = await api.guardar(envio);
    if (r.tabla.tuMejor >= porConfirmar) porConfirmar = 0;
    tabla = porConfirmar > r.tabla.tuMejor ? conPartida(r.tabla, porConfirmar, api.nombre).tabla : r.tabla;
    recordarTabla(tabla);
    errorTabla = false;
    if (id === idPartida) { record = record || r.record; guardado = "nada"; }
    if (pendientes.length > 0) reenviarPendientes();
  } catch {
    if (intento < 2) { setTimeout(() => void enviar(envio, id, intento + 1), 2500); return; }
    pendientes.push({ envio, id });
    if (id === idPartida) guardado = "error";
  }
  actualizar();
}

function reenviarPendientes(): void {
  const todas = pendientes;
  pendientes = [];
  if (todas.some((p) => p.id === idPartida)) guardado = "nada";
  for (const p of todas) void enviar(p.envio, p.id, 2);
  actualizar();
}

// ── Juego ────────────────────────────────────────────────────────────────────

function vistaAncho(): number {
  const c = q<HTMLCanvasElement>("#kb-canvas");
  return c && c.clientHeight > 0 ? (c.clientWidth / c.clientHeight) * ALTO : 55;
}

function jugar(): void {
  vuelo = nuevoVuelo(vistaAncho());
  chispas = []; letreros = []; sacudida = 0; destello = 0;
  guardado = "nada"; record = false; hoja = false;
  estado = "jugando";
  inicio = performance.now();
  duracion = 0;
  aletear(vuelo);
  aleteo = 0;
  actualizar();
}

function tocar(): void {
  if (estado !== "jugando") return;
  aletear(vuelo);
  aleteo = 0;
}

function ciclo(ahora: number): void {
  const dt = Math.min(0.04, (ahora - ultimo) / 1000);
  ultimo = ahora;
  reloj += dt;
  aleteo += dt;
  if (estado === "jugando") {
    const ev = avanzar(vuelo, dt);
    if (ev === "punto") {
      letreros.push({ texto: "+1", x: vuelo.x + 4, y: vuelo.y - 8, vida: 1 });
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * Math.PI * 2;
        chispas.push({ x: vuelo.x, y: vuelo.y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, vida: 0.5, color: k % 2 ? "#7ef3ff" : "#ff3bd4" });
      }
      actualizar();
    }
    if (ev === "fin") {
      duracion = performance.now() - inicio;
      estado = "fin";
      sacudida = 1;
      destello = 1;
      for (let k = 0; k < 16; k++) {
        const a = Math.random() * Math.PI * 2;
        chispas.push({ x: vuelo.x, y: vuelo.y, vx: Math.cos(a) * 45, vy: Math.sin(a) * 45 - 10, vida: 0.7, color: "#ffd45c" });
      }
      navigator.vibrate?.([40, 30, 60]);
      actualizar();
      terminarPartida();
    }
  } else if (estado === "inicio") {
    // En la portada la kettlebell flota y el gimnasio pasa despacio.
    vuelo.recorrido += 14 * dt;
    vuelo.y = ALTO * 0.42 + Math.sin(reloj * 2.2) * 3;
    if (aleteo > 0.45) aleteo = 0;
  } else if (estado === "fin" && vuelo.y + RADIO < PISO) {
    // Al chocar con una barra, cae al piso.
    vuelo.vy = Math.min(130, vuelo.vy + 250 * dt);
    vuelo.y = Math.min(PISO - RADIO, vuelo.y + vuelo.vy * dt);
  }
  for (const c of chispas) { c.vida -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 40 * dt; }
  chispas = chispas.filter((c) => c.vida > 0);
  for (const l of letreros) { l.vida -= dt * 1.4; l.y -= 10 * dt; }
  letreros = letreros.filter((l) => l.vida > 0);
  sacudida = Math.max(0, sacudida - dt * 2.5);
  destello = Math.max(0, destello - dt * 4);
  dibujar();
  cuadro = requestAnimationFrame(ciclo);
}

function arrancar(): void {
  cancelAnimationFrame(cuadro);
  ultimo = performance.now();
  cuadro = requestAnimationFrame(ciclo);
}

// ── Dibujo ───────────────────────────────────────────────────────────────────

const COLORES = ["#d6372c", "#2a6fd6", "#f0b400", "#24964a"];
const mod = (a: number, b: number) => ((a % b) + b) % b;
/** Un número fijo por posición, para que cada ventana o máquina sea siempre la misma. */
const ruido = (n: number) => mod(Math.sin(n * 12.9898) * 43758.5453, 1);

function caja2(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
}

function dibujar(): void {
  const canvas = q<HTMLCanvasElement>("#kb-canvas");
  if (!canvas) return;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (W === 0 || H === 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const c = canvas.getContext("2d");
  if (!c) return;
  const e = H / ALTO;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (sacudida > 0) c.translate((Math.random() - 0.5) * 10 * sacudida, (Math.random() - 0.5) * 8 * sacudida);
  const r = vuelo.recorrido;
  const piso = PISO * e;

  // Pared del fondo.
  const pared = c.createLinearGradient(0, 0, 0, piso);
  pared.addColorStop(0, "#160f26");
  pared.addColorStop(1, "#2a1a33");
  c.fillStyle = pared;
  c.fillRect(-20, -20, W + 40, piso + 20);

  // Capa lejana (0.15): ventanales con la ciudad de noche y letreros de neón.
  const lejos = r * 0.15 * e;
  const paso1 = 70 * e;
  for (let i = Math.floor(lejos / paso1) - 1; i * paso1 - lejos < W + paso1; i++) {
    const x = i * paso1 - lejos;
    if (ruido(i) < 0.62) {
      const vx = x + 8 * e, vy = 10 * e, vw = 40 * e, vh = 34 * e;
      const cielo = c.createLinearGradient(0, vy, 0, vy + vh);
      cielo.addColorStop(0, "#1b2a55"); cielo.addColorStop(1, "#3a2457");
      c.fillStyle = cielo; c.fillRect(vx, vy, vw, vh);
      // Edificios y luces de la ciudad.
      for (let k = 0; k < 6; k++) {
        const bh = (8 + ruido(i * 7 + k) * 18) * e, bx = vx + (k * vw) / 6;
        c.fillStyle = "#0f1330"; c.fillRect(bx, vy + vh - bh, vw / 6 - 2, bh);
        c.fillStyle = "rgba(255, 214, 120, 0.7)";
        for (let w = 0; w < 4; w++) if (ruido(i * 31 + k * 5 + w) > 0.5) c.fillRect(bx + 3, vy + vh - bh + 4 + w * 6, 2.5, 2.5);
      }
      c.strokeStyle = "#3b2d4d"; c.lineWidth = Math.max(2, e * 0.8);
      c.strokeRect(vx, vy, vw, vh);
      c.beginPath(); c.moveTo(vx + vw / 2, vy); c.lineTo(vx + vw / 2, vy + vh); c.stroke();
    } else {
      // Letrero de neón.
      const texto = ruido(i + 3) < 0.5 ? "OSFIT" : "NO PAIN NO GAIN";
      const color = ruido(i + 5) < 0.5 ? "#ff3bd4" : "#7ef3ff";
      // Atenuado: es fondo, no debe competir con las barras.
      const prende = 0.28 + 0.08 * Math.sin(reloj * 3 + i);
      c.save();
      c.font = `900 ${Math.round((texto.length > 6 ? 5 : 9) * e)}px system-ui, sans-serif`;
      c.textAlign = "center";
      c.shadowColor = color; c.shadowBlur = 10;
      c.fillStyle = color; c.globalAlpha = prende;
      c.fillText(texto, x + 28 * e, 30 * e);
      c.restore();
    }
  }

  // Lámparas colgando (0.4) con su cono de luz.
  const medio = r * 0.4 * e;
  const paso2 = 46 * e;
  for (let i = Math.floor(medio / paso2) - 1; i * paso2 - medio < W + paso2; i++) {
    const x = i * paso2 - medio + 20 * e;
    c.strokeStyle = "#2c2238"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 7 * e); c.stroke();
    c.fillStyle = "#3a3048"; c.beginPath(); c.moveTo(x - 4 * e, 9 * e); c.lineTo(x + 4 * e, 9 * e); c.lineTo(x + 2 * e, 6.5 * e); c.lineTo(x - 2 * e, 6.5 * e); c.fill();
    const cono = c.createLinearGradient(0, 9 * e, 0, piso);
    cono.addColorStop(0, "rgba(255, 228, 170, 0.16)"); cono.addColorStop(1, "rgba(255, 228, 170, 0)");
    c.fillStyle = cono;
    c.beginPath(); c.moveTo(x - 4 * e, 9 * e); c.lineTo(x + 4 * e, 9 * e); c.lineTo(x + 18 * e, piso); c.lineTo(x - 18 * e, piso); c.fill();
  }

  // Máquinas (0.55): racks, mancuerneros y caminadoras, en silueta.
  const cerca = r * 0.55 * e;
  const paso3 = 52 * e;
  c.save();
  for (let i = Math.floor(cerca / paso3) - 1; i * paso3 - cerca < W + paso3; i++) {
    const x = i * paso3 - cerca;
    const tipo = Math.floor(ruido(i * 3 + 1) * 3);
    c.fillStyle = "#231a30"; c.strokeStyle = "#3a2c4c"; c.lineWidth = Math.max(2, e * 0.9);
    if (tipo === 0) {
      // Rack de sentadilla con su barra.
      const a = piso - 40 * e;
      c.strokeRect(x + 6 * e, a, 26 * e, 40 * e);
      c.beginPath(); c.moveTo(x + 6 * e, a + 14 * e); c.lineTo(x + 32 * e, a + 14 * e); c.stroke();
      c.fillStyle = "#4a3c5e"; c.fillRect(x + 2 * e, a + 11 * e, 34 * e, 1.6 * e);
      c.fillStyle = "#33284a"; c.fillRect(x + 1 * e, a + 7 * e, 3 * e, 10 * e); c.fillRect(x + 34 * e, a + 7 * e, 3 * e, 10 * e);
    } else if (tipo === 1) {
      // Mancuernero.
      const a = piso - 20 * e;
      c.fillRect(x + 4 * e, a, 38 * e, 3 * e); c.fillRect(x + 4 * e, a + 9 * e, 38 * e, 3 * e);
      c.fillRect(x + 6 * e, a, 2 * e, 20 * e); c.fillRect(x + 38 * e, a, 2 * e, 20 * e);
      for (let k = 0; k < 5; k++) for (const fila of [a - 2.5 * e, a + 6.5 * e]) {
        c.fillStyle = "#3d3052"; c.fillRect(x + (9 + k * 6.5) * e, fila, 1.6 * e, 3 * e); c.fillRect(x + (12.4 + k * 6.5) * e, fila, 1.6 * e, 3 * e);
        c.fillStyle = "#2e2440"; c.fillRect(x + (10.6 + k * 6.5) * e, fila + 1 * e, 1.8 * e, 1 * e);
      }
    } else {
      // Caminadora.
      const a = piso - 8 * e;
      c.beginPath(); c.moveTo(x + 4 * e, piso); c.lineTo(x + 34 * e, piso); c.lineTo(x + 30 * e, a); c.lineTo(x + 8 * e, a); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x + 30 * e, a); c.lineTo(x + 34 * e, piso - 30 * e); c.lineTo(x + 26 * e, piso - 30 * e); c.stroke();
      c.fillStyle = "rgba(126, 243, 255, 0.5)"; c.fillRect(x + 27 * e, piso - 31.5 * e, 6 * e, 2.5 * e);
    }
  }
  c.restore();

  // Piso de caucho, que corre a la velocidad del juego.
  const gp = c.createLinearGradient(0, piso, 0, H);
  gp.addColorStop(0, "#26222c"); gp.addColorStop(1, "#121015");
  c.fillStyle = gp; c.fillRect(-20, piso, W + 40, H - piso + 20);
  c.fillStyle = "#3b3346"; c.fillRect(-20, piso, W + 40, Math.max(2, e * 0.8));
  const losa = 16 * e, des = mod(r * e, losa);
  c.strokeStyle = "rgba(255, 255, 255, 0.05)"; c.lineWidth = 1;
  for (let x = -des; x < W + losa; x += losa) { c.beginPath(); c.moveTo(x, piso); c.lineTo(x - 6 * e, H); c.stroke(); }

  // Las barras: una barra de acero con sus discos en la punta, colgando del techo y parada en el piso.
  for (const b of vuelo.barras) {
    const x = b.x * e, w = ANCHO_BARRA * e;
    const arriba = (b.centro - b.hueco / 2) * e, abajo = (b.centro + b.hueco / 2) * e;
    // El color sale de la altura de su hueco: es fijo para cada barra mientras cruza.
    const color = COLORES[Math.floor(ruido(Math.round(b.centro * 100)) * 4)] ?? COLORES[0]!;
    pintarObstaculo(c, x, w, -10, arriba, true, color, e);
    pintarObstaculo(c, x, w, abajo, piso, false, color, e);
  }

  // La kettlebell.
  pintarKettlebell(c, vuelo.x * e, vuelo.y * e, RADIO * e, estado === "fin" ? 1.3 : Math.max(-0.45, Math.min(1.2, vuelo.vy / 110)));

  for (const ch of chispas) {
    c.globalAlpha = Math.max(0, Math.min(1, ch.vida * 2));
    c.fillStyle = ch.color;
    c.beginPath(); c.arc(ch.x * e, ch.y * e, Math.max(1.5, e * 0.45), 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  c.textAlign = "center";
  c.font = `900 ${Math.round(5 * e)}px system-ui, sans-serif`;
  for (const l of letreros) {
    c.fillStyle = `rgba(126, 243, 255, ${Math.max(0, l.vida)})`;
    c.fillText(l.texto, l.x * e, l.y * e);
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (destello > 0) { c.fillStyle = `rgba(255, 255, 255, ${destello * 0.5})`; c.fillRect(0, 0, W, H); }
  const vin = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8);
  vin.addColorStop(0, "rgba(0, 0, 0, 0)"); vin.addColorStop(1, "rgba(0, 0, 0, 0.45)");
  c.fillStyle = vin; c.fillRect(0, 0, W, H);
}

// TEMPORAL: selector para comparar las tres propuestas de obstáculos.
function varianteObstaculo(): string {
  try { return globalThis.localStorage?.getItem("osfit:kb-barras") ?? "a"; } catch { return "a"; }
}

function pintarObstaculo(c: CanvasRenderingContext2D, x: number, w: number, y0: number, y1: number, cuelga: boolean, color: string, e: number): void {
  const v = varianteObstaculo();
  if (v === "b") pintarBarraOlimpica(c, x, w, y0, y1, cuelga, e);
  else if (v === "c") pintarRack(c, x, w, y0, y1, cuelga, e);
  else pintarColumna(c, x, w, y0, y1, cuelga, e);
  void color;
}

function cromo(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "#5c6168"); g.addColorStop(0.35, "#f2f4f6"); g.addColorStop(0.6, "#aeb3ba"); g.addColorStop(1, "#4f545b");
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
}

/**
 * A · La columna de placas de una máquina de poleas: guías cromadas, placas de acero con su
 * número de kilos y el hoyo del perno; la de la orilla lleva el perno selector. Arriba cuelga de
 * su viga y abajo se apoya en su base.
 */
function pintarColumna(c: CanvasRenderingContext2D, x: number, w: number, y0: number, y1: number, cuelga: boolean, e: number): void {
  const rw = Math.max(2, w * 0.07);
  cromo(c, x + w * 0.2 - rw / 2, y0, rw, y1 - y0);
  cromo(c, x + w * 0.8 - rw / 2, y0, rw, y1 - y0);
  const h = 2.5 * e, sep = 0.3 * e;
  const n = Math.min(16, Math.floor((y1 - y0) / (h + sep)) - 1);
  for (let k = 0; k < n; k++) {
    const py = cuelga ? y1 - (k + 1) * (h + sep) : y0 + sep + k * (h + sep);
    const orilla = k === 0;
    const g = c.createLinearGradient(0, py, 0, py + h);
    if (orilla) { g.addColorStop(0, "#c9cdd3"); g.addColorStop(0.5, "#8e949c"); g.addColorStop(1, "#5d626a"); }
    else { g.addColorStop(0, "#4a4e56"); g.addColorStop(0.45, "#2c2f35"); g.addColorStop(1, "#1a1c20"); }
    c.fillStyle = g;
    caja2(c, x, py, w, h, Math.min(3, h * 0.25));
    c.fill();
    // Brillo del canto de arriba y sombra del de abajo.
    c.fillStyle = "rgba(255, 255, 255, 0.18)"; c.fillRect(x + 2, py + 0.5, w - 4, Math.max(1, h * 0.08));
    c.fillStyle = "rgba(0, 0, 0, 0.35)"; c.fillRect(x + 2, py + h - Math.max(1, h * 0.1), w - 4, Math.max(1, h * 0.1));
    // Los hoyos de las guías y el del perno.
    c.fillStyle = "#0b0c0e";
    c.fillRect(x + w * 0.2 - rw * 0.8, py, rw * 1.6, h * 0.3);
    c.fillRect(x + w * 0.8 - rw * 0.8, py, rw * 1.6, h * 0.3);
    if (!orilla) {
      c.beginPath(); c.arc(x + w / 2, py + h / 2, Math.max(1.5, h * 0.17), 0, Math.PI * 2); c.fill();
      // El número de kilos, en su calcomanía.
      if (w > 30) {
        c.fillStyle = "#e9e7e1";
        caja2(c, x + w * 0.62, py + h * 0.22, w * 0.13, h * 0.56, 1.5); c.fill();
        c.fillStyle = "#16171a";
        c.font = `800 ${Math.max(7, Math.round(h * 0.42))}px system-ui, sans-serif`;
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(String((k) * 5), x + w * 0.685, py + h * 0.52);
      }
    } else {
      // El perno selector: la perilla roja asomando.
      c.fillStyle = "#c9302a";
      c.beginPath(); c.arc(x + w * 0.42, py + h / 2, Math.max(2, h * 0.24), 0, Math.PI * 2); c.fill();
      c.fillStyle = "#9aa0a8"; c.fillRect(x + w * 0.42, py + h * 0.42, w * 0.18, h * 0.16);
      if (cuelga) {
        // El vástago que sube por en medio de la pila.
        cromo(c, x + w / 2 - rw * 0.6, y0, rw * 1.2, py - y0);
      }
    }
  }
  // Viga de arriba o base de abajo.
  c.fillStyle = "#1d1f24";
  if (cuelga) { c.fillRect(x - w * 0.12, y0, w * 1.24, 3 * e); c.fillStyle = "rgba(255,255,255,0.08)"; c.fillRect(x - w * 0.12, y0 + 3 * e - 2, w * 1.24, 2); }
  else { c.fillRect(x - w * 0.12, y1 - 1.6 * e, w * 1.24, 1.6 * e); c.fillStyle = "#111"; c.fillRect(x - w * 0.05, y1 - 0.5 * e, w * 0.2, 0.5 * e); c.fillRect(x + w * 0.85, y1 - 0.5 * e, w * 0.2, 0.5 * e); }
}

/**
 * B · Una barra olímpica de verdad, parada: el acero con su moleteado, el hombro, la manga
 * cromada con discos de caucho de distintos tamaños y el seguro en la punta del hueco.
 */
function pintarBarraOlimpica(c: CanvasRenderingContext2D, x: number, w: number, y0: number, y1: number, cuelga: boolean, e: number): void {
  const bw = w * 0.2, bx = x + (w - bw) / 2;
  // La manga y los discos, desde la punta (la orilla del hueco) hacia adentro.
  const piezas: { h: number; ancho: number; color: string | null }[] = [
    { h: 0.9 * e, ancho: 0.36, color: null },          // tapa de la manga
    { h: 1.5 * e, ancho: 0.55, color: "seguro" },      // seguro
    { h: 1.7 * e, ancho: 0.72, color: "#24964a" },     // 10 kg
    { h: 2.3 * e, ancho: 1, color: "#2a6fd6" },        // 20 kg
    { h: 2.6 * e, ancho: 1, color: "#d6372c" },        // 25 kg
    { h: 2.2 * e, ancho: 0.34, color: null },          // manga hasta el hombro
    { h: 1.1 * e, ancho: 0.48, color: "hombro" },      // hombro
  ];
  let pos = cuelga ? y1 : y0;
  for (const p of piezas) {
    const py = cuelga ? pos - p.h : pos;
    const pw = w * p.ancho, px = x + (w - pw) / 2;
    if (p.color === null) cromo(c, px, py, pw, p.h);
    else if (p.color === "seguro") {
      c.fillStyle = "#1b1c20"; caja2(c, px, py, pw, p.h, 2); c.fill();
      c.fillStyle = "#c9302a"; c.fillRect(px + pw * 0.75, py + p.h * 0.2, pw * 0.4, p.h * 0.35);
    } else if (p.color === "hombro") cromo(c, px, py, pw, p.h);
    else {
      const g = c.createLinearGradient(px, 0, px + pw, 0);
      g.addColorStop(0, shade(p.color, 0.45)); g.addColorStop(0.3, shade(p.color, 1.05)); g.addColorStop(0.55, p.color); g.addColorStop(1, shade(p.color, 0.4));
      c.fillStyle = g;
      caja2(c, px, py + 0.4, pw, p.h - 0.8, p.h * 0.3); c.fill();
      // El labio del caucho y la ranura del medio.
      c.fillStyle = "rgba(255, 255, 255, 0.18)"; c.fillRect(px + 3, py + p.h * 0.2, pw - 6, Math.max(1, p.h * 0.07));
      c.fillStyle = "rgba(0, 0, 0, 0.3)"; c.fillRect(px + 3, py + p.h * 0.5, pw - 6, Math.max(1, p.h * 0.06));
    }
    pos = cuelga ? py : py + p.h;
  }
  // La barra: acero con moleteado en diagonal.
  const ya = cuelga ? y0 : pos, yb = cuelga ? pos : y1;
  cromo(c, bx, ya, bw, yb - ya);
  c.save();
  c.beginPath(); c.rect(bx, ya, bw, yb - ya); c.clip();
  c.strokeStyle = "rgba(40, 44, 50, 0.45)"; c.lineWidth = 1;
  for (let yy = ya - bw; yy < yb + bw; yy += 3) {
    c.beginPath(); c.moveTo(bx, yy); c.lineTo(bx + bw, yy + bw * 0.6); c.stroke();
    c.beginPath(); c.moveTo(bx + bw, yy); c.lineTo(bx, yy + bw * 0.6); c.stroke();
  }
  c.restore();
}

/**
 * C · El poste de un rack de potencia: tubo cuadrado de acero negro con su fila de agujeros, y
 * en la orilla del hueco el gancho J (arriba) o el brazo de seguridad (abajo). Atornillado a una
 * viga en el techo o a su placa en el piso.
 */
function pintarRack(c: CanvasRenderingContext2D, x: number, w: number, y0: number, y1: number, cuelga: boolean, e: number): void {
  const pw = w * 0.56, px = x + (w - pw) / 2;
  const g = c.createLinearGradient(px, 0, px + pw, 0);
  g.addColorStop(0, "#0f1013"); g.addColorStop(0.3, "#2e3138"); g.addColorStop(0.5, "#24262b"); g.addColorStop(1, "#0c0d10");
  c.fillStyle = g;
  c.fillRect(px, y0, pw, y1 - y0);
  // La fila de agujeros, cada 2 e, con su número cada cinco.
  const paso = 2.1 * e;
  let k = 0;
  for (let yy = cuelga ? y1 - 4 * e : y0 + 4 * e; cuelga ? yy > y0 : yy < y1; yy += cuelga ? -paso : paso, k++) {
    c.fillStyle = "#020203";
    caja2(c, px + pw * 0.35, yy - 0.45 * e, pw * 0.3, 0.9 * e, 0.45 * e); c.fill();
    c.fillStyle = "rgba(255, 255, 255, 0.12)"; c.fillRect(px + pw * 0.35, yy + 0.45 * e, pw * 0.3, 1);
    if (k % 5 === 0 && w > 30) {
      c.fillStyle = "rgba(255, 255, 255, 0.55)";
      c.font = `700 ${Math.max(7, Math.round(e * 1.1))}px system-ui, sans-serif`;
      c.textAlign = "right"; c.textBaseline = "middle";
      c.fillText(String(k + 1), px - 2, yy);
    }
  }
  // La orilla del hueco: gancho J arriba, brazo de seguridad abajo.
  const ah = 2.2 * e;
  if (cuelga) {
    const ay = y1 - ah;
    c.fillStyle = "#b8302a"; caja2(c, x, ay, w, ah, 2); c.fill();
    c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(x + 2, ay + 1, w - 4, Math.max(1, ah * 0.12));
    // El forro de plástico del gancho, y su pestaña.
    c.fillStyle = "#16171a"; c.fillRect(x + w * 0.62, ay - ah * 0.55, w * 0.38, ah * 0.6);
    c.fillStyle = "#b8302a"; c.fillRect(x + w * 0.9, ay - ah * 0.9, w * 0.1, ah * 0.95);
  } else {
    const ay = y0;
    cromo(c, x - w * 0.08, ay, w * 1.16, ah * 0.8);
    c.fillStyle = "#16171a"; c.fillRect(x - w * 0.08, ay, w * 0.18, ah * 0.8); c.fillRect(x + w * 0.9, ay, w * 0.18, ah * 0.8);
    c.fillStyle = "#c9302a"; c.beginPath(); c.arc(x + w / 2, ay + ah * 0.4, Math.max(2, ah * 0.16), 0, Math.PI * 2); c.fill();
  }
  // Viga o placa base con tornillos.
  c.fillStyle = "#14151a";
  if (cuelga) c.fillRect(x - w * 0.2, y0, w * 1.4, 2.6 * e);
  else {
    c.fillRect(x - w * 0.2, y1 - 1.2 * e, w * 1.4, 1.2 * e);
    c.fillStyle = "#8e949c";
    for (const bxx of [x - w * 0.1, x + w * 1.02]) { c.beginPath(); c.arc(bxx, y1 - 0.6 * e, Math.max(1.5, e * 0.3), 0, Math.PI * 2); c.fill(); }
  }
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const k = (v: number) => Math.round(Math.max(0, Math.min(255, v * f)));
  return `rgb(${k((n >> 16) & 255)}, ${k((n >> 8) & 255)}, ${k(n & 255)})`;
}

/** La kettlebell negra con su asa, su peso y dos alas que baten al tocar. */
function pintarKettlebell(c: CanvasRenderingContext2D, x: number, y: number, r: number, inclinacion: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(inclinacion * 0.6);
  // Alas: baten fuerte justo después del toque y luego planean.
  const bate = aleteo < 0.25 ? Math.sin((aleteo / 0.25) * Math.PI * 2) : Math.sin(reloj * 3) * 0.15;
  for (const lado of [-1, 1]) {
    c.save();
    c.translate(lado * r * 0.75, -r * 0.2);
    c.rotate(lado * (-0.4 + bate * 0.9));
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(lado * r * 1.6, -r * 1.4, lado * r * 2.1, -r * 0.3);
    c.quadraticCurveTo(lado * r * 1.4, -r * 0.2, lado * r * 1.5, r * 0.2);
    c.quadraticCurveTo(lado * r * 0.8, r * 0.1, 0, r * 0.35);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(160, 170, 190, 0.8)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(lado * r * 0.5, -r * 0.1); c.quadraticCurveTo(lado * r * 1.2, -r * 0.6, lado * r * 1.7, -r * 0.4); c.stroke();
    c.restore();
  }
  // Asa.
  c.strokeStyle = "#2a2c31"; c.lineWidth = r * 0.32;
  c.beginPath(); c.arc(0, -r * 0.75, r * 0.62, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  c.beginPath(); c.moveTo(-r * 0.6, -r * 0.7); c.lineTo(-r * 0.55, -r * 0.3); c.moveTo(r * 0.6, -r * 0.7); c.lineTo(r * 0.55, -r * 0.3); c.stroke();
  // Cuerpo.
  const g = c.createRadialGradient(-r * 0.35, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, "#6b6f78"); g.addColorStop(0.55, "#2a2c31"); g.addColorStop(1, "#0f1013");
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#ffd45c";
  c.font = `900 ${Math.round(r * 0.62)}px system-ui, sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("16", 0, r * 0.12);
  c.restore();
}

// ── Montaje ──────────────────────────────────────────────────────────────────

function ajustarMarco(): void {
  const pantalla = q("#kb-pantalla");
  if (!pantalla) return;
  const cab = document.querySelector<HTMLElement>(".cabecera");
  const barra = [...document.querySelectorAll<HTMLElement>("#barra, #barra > *")].find((b) => b.offsetHeight > 0) ?? null;
  pantalla.style.top = `${cab ? Math.max(0, cab.getBoundingClientRect().bottom + 6) : 0}px`;
  pantalla.style.bottom = `${barra ? Math.max(0, window.innerHeight - barra.getBoundingClientRect().top) : 0}px`;
}

/** Muestra u oculta el juego. La primera vez arma su DOM; al salir a media partida la pausa. */
export function mostrarKettlebell(contenedor: HTMLElement, visible: boolean, conexion: ApiJuego): void {
  const estaba = !contenedor.hidden;
  if (estaba === visible && caja) return;
  contenedor.hidden = !visible;
  if (!visible) {
    if (estado === "jugando") { estado = "pausa"; duracion = performance.now() - inicio; }
    cancelAnimationFrame(cuadro);
    actualizar();
    return;
  }
  if (caja !== contenedor) {
    caja = contenedor;
    api = conexion;
    contenedor.innerHTML = htmlKettlebell();
    conectar(contenedor);
    tabla = tabla ?? tablaGuardada();
  }
  window.scrollTo(0, 0);
  ajustarMarco();
  requestAnimationFrame(() => {
    ajustarMarco();
    if (estado === "inicio") vuelo = nuevoVuelo(vistaAncho());
  });
  actualizar();
  arrancar();
  void cargarTabla();
}

/** El récord de cada quien que guarda el teléfono: el Arcade lo usa para su tarjeta. */
export function tablaKettlebellGuardada(): TablaDiscos | null { return tabla ?? tablaGuardada(); }

function conectar(c: HTMLElement): void {
  const pantalla = c.querySelector<HTMLElement>("#kb-pantalla");
  pantalla?.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button, .jd-hoja")) return;
    if (estado !== "jugando") return;
    e.preventDefault();
    tocar();
  });
  c.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-kb]");
    if (!b) return;
    const que = b.dataset.kb;
    if (que === "jugar") jugar();
    if (que === "seguir") { estado = "jugando"; inicio = performance.now() - duracion; aletear(vuelo); aleteo = 0; actualizar(); }
    if (que === "reintentar-guardar") reenviarPendientes();
    if (que === "marcador") { hoja = true; actualizar(); void cargarTabla(); }
    if (que === "cerrar-hoja") { hoja = false; actualizar(); }
  });
  document.addEventListener("keydown", (e) => {
    if (c.hidden || estado !== "jugando" || (e.key !== " " && e.key !== "Enter" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    tocar();
  });
  window.addEventListener("resize", () => { if (!c.hidden) ajustarMarco(); });
}
