import {
  ANCHO_TABLERO, avanzar, nuevaPartida, pesoDe, soltar, type Partida,
} from "../juegoDiscos";
import { escapar } from "./tarjetaDia";

/**
 * La ventana del minijuego Torre de discos (lógica en `../juegoDiscos.ts`) y su tabla de
 * puntuaciones, Records (`guardarPartidaDiscos` y `tablaDiscos` en functions).
 *
 * Ocupa toda la pestaña, entre la cabecera y la barra de abajo (entrenador, 2026-11-24: "que sea
 * toda la pestaña el juego"). Vive en su propio contenedor (`#juego`, `contenedorPropio` en
 * `ventanas.ts`), fuera del repintado de `#contenido`: un snapshot de Firestore a media partida
 * no debe tirar el canvas. El DOM se arma una sola vez y después solo se actualizan sus partes.
 *
 * El dibujo es en 3/4: cada disco es un cilindro plano visto un poco desde arriba, de caucho del
 * color de su peso, con el peso impreso, el aro de acero y el hoyo al centro; la torre se para
 * sobre una plataforma de madera bajo un reflector. El disco se desliza pegado a la torre y se
 * queda donde se suelta; lo cortado se desprende girando, un perfecto lanza una onda y chispas, y al perder la cámara se aleja para
 * mostrar la torre completa.
 */

export interface FilaTabla { puesto: number; nombre: string; puntos: number; esTuyo: boolean }
/** Los records: la mejor partida de cada quien, de siempre, con su nombre completo. */
export interface TablaDiscos { filas: FilaTabla[]; tuMejor: number }
export interface EnvioPartida { puntos: number; apilados: number; duracionMs: number }
export interface RespuestaPartida { record: boolean; tabla: TablaDiscos }

export interface ApiJuego {
  guardar: (p: EnvioPartida) => Promise<RespuestaPartida>;
  tabla: () => Promise<TablaDiscos>;
  /** Su nombre, para ponerla en el marcador local antes de que conteste el servidor. */
  nombre: string;
}

type Estado = "inicio" | "jugando" | "pausa" | "fin";
/** Solo se avisa si falla: guardar va por detrás y la clienta no lo espera. */
type Guardado = "nada" | "error";

// ── Geometría (unidades del tablero) ─────────────────────────────────────────

/** Lo que se ve a lo ancho: el tablero más lo que el disco se pasea por fuera. */
const VISTA_ANCHO = ANCHO_TABLERO + 36;
/** Grueso de cada disco. */
const GRUESO = 5.2;
/** Qué tan desde arriba se ven: alto de la elipse ÷ ancho. */
const INCLINACION = 0.3;
/**
 * A qué altura va el disco que se mueve sobre la torre: pegado, deslizándose sobre ella, y al
 * tocar se queda ahí sin caer (entrenador, 2026-11-24: "ese espacio … siento que es raro").
 */
const FLOTA = 0;
/** El piso: la plataforma mide esto de alto bajo la base. */
const PLATAFORMA = 7;

interface Pedazo { x: number; ancho: number; corteX0: number; corteX1: number; y: number; vy: number; vx: number; giro: number; vg: number; kg: string }
interface Onda { x: number; y: number; r: number; vida: number }
interface Chispa { x: number; y: number; vx: number; vy: number; vida: number; color: string }
interface Letrero { texto: string; y: number; vida: number }

let caja: HTMLElement | null = null;
let api: ApiJuego | null = null;
let estado: Estado = "inicio";
let partida: Partida = nuevaPartida();
let inicio = 0;
let duracion = 0;
let pedazos: Pedazo[] = [];
let ondas: Onda[] = [];
let chispas: Chispa[] = [];
let letreros: Letrero[] = [];
const motas: { x: number; y: number; v: number; r: number }[] = [];
let sacudida = 0;
let camY = -60;
let zoom = 1;
let cuadro = 0;
let ultimo = 0;
let reloj = 0;
let tabla: TablaDiscos | null = null;
let errorTabla = false;
let guardado: Guardado = "nada";
let record = false;
let hoja = false;
/** Cuál partida se ve en pantalla: un guardado que termina tarde no toca la siguiente. */
let idPartida = 0;
/** Las que no se pudieron guardar ni al segundo intento; se reintentan con la siguiente. */
let pendientes: { envio: EnvioPartida; id: number }[] = [];
/** Su mejor partida que el servidor aún no confirma: un marcador que llegue antes no la borra. */
let porConfirmar = 0;

// Solo en desarrollo (Vite lo quita del build): deja leer la partida para grabar demos.
if (import.meta.env?.DEV) (globalThis as { __torreDiscos?: () => { partida: Partida; estado: Estado } }).__torreDiscos = () => ({ partida, estado });

/** Para los tests. */
export function reiniciarJuego(): void {
  cancelAnimationFrame(cuadro);
  caja = null; api = null; estado = "inicio"; partida = nuevaPartida();
  pedazos = []; ondas = []; chispas = []; letreros = [];
  tabla = null; errorTabla = false; guardado = "nada"; record = false; hoja = false;
  idPartida = 0; pendientes = []; porConfirmar = 0;
}

/**
 * El marcador con su partida ya puesta, sin esperar al servidor: si mejoró su récord, su fila
 * sube (o entra, con su nombre) y se reacomodan los lugares. El servidor después manda la buena.
 */
export function conPartida(t: TablaDiscos, apilados: number, nombre: string): { tabla: TablaDiscos; record: boolean } {
  if (apilados <= t.tuMejor) return { tabla: t, record: false };
  const otras = t.filas.filter((f) => !f.esTuyo);
  const mia = t.filas.find((f) => f.esTuyo);
  const visible = mia?.nombre ?? (nombre.trim().replace(/\s+/g, " ") || "Tú");
  const o = [...otras, { puesto: 0, nombre: visible, puntos: apilados, esTuyo: true }]
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, "es"));
  let puesto = 0;
  const filas = o.map((f, i) => {
    if (i === 0 || o[i - 1]!.puntos !== f.puntos) puesto = i + 1;
    return { ...f, puesto };
  });
  return { tabla: { filas, tuMejor: apilados }, record: true };
}

/** El último marcador, guardado en el teléfono: al abrir el juego sale al instante. */
const LLAVE_TABLA = "osfit:torre-tabla";
function tablaGuardada(): TablaDiscos | null {
  try {
    const t = JSON.parse(globalThis.localStorage?.getItem(LLAVE_TABLA) ?? "null") as TablaDiscos | null;
    return t && Array.isArray(t.filas) && typeof t.tuMejor === "number" ? t : null;
  } catch { return null; }
}
function recordarTabla(t: TablaDiscos): void {
  try { globalThis.localStorage?.setItem(LLAVE_TABLA, JSON.stringify(t)); } catch { /* sin almacenamiento: no pasa nada */ }
}

// ── HTML ─────────────────────────────────────────────────────────────────────

export function htmlJuego(): string {
  return `
    <div class="jd-pantalla" id="jd-pantalla">
      <canvas id="jd-canvas" aria-label="Torre de discos"></canvas>
      <div class="jd-hud" aria-live="polite">
        <p class="jd-hud-puntos" id="jd-puntos">0</p>
        <p class="jd-hud-record">Récord <b id="jd-record">—</b></p>
      </div>
      <div class="jd-capa" id="jd-capa"></div>
      <section class="jd-hoja" id="jd-hoja" hidden aria-label="Records">
        <div class="jd-hoja-cabeza">
          <p class="jd-hoja-titulo">Records</p>
          <button type="button" class="jd-cerrar" data-jd="cerrar-hoja" aria-label="Cerrar">✕</button>
        </div>
        <p class="jd-hoja-tuyo" id="jd-tuyo"></p>
        <ol class="jd-lista" id="jd-lista"></ol>
        <button type="button" class="jd-boton" data-jd="jugar">Jugar</button>
      </section>
    </div>`;
}

/** La capa sobre el juego: portada, pausa o el resultado. */
export function htmlCapa(e: Estado, puntos: number, apilados: number, g: Guardado, nuevoRecord: boolean): string {
  if (e === "jugando") return "";
  if (e === "pausa") {
    return `<div class="jd-capa-caja"><p class="jd-capa-titulo">Pausa</p>
      <button type="button" class="jd-boton" data-jd="seguir">Seguir</button></div>`;
  }
  if (e === "inicio") {
    return `
      <div class="jd-capa-caja">
        <p class="jd-capa-marca">OSFIT</p>
        <p class="jd-capa-titulo">Torre de discos</p>
        <p class="jd-capa-texto">Toca para soltar cada disco sobre la torre. Lo que sobresale se corta y el siguiente sale más ligero. Cada disco que queda en la torre es un punto. Si lo sueltas justo encima es <b>perfecto</b>: no se corta.</p>
        <button type="button" class="jd-boton" data-jd="jugar">Jugar</button>
        <button type="button" class="jd-boton secundario" data-jd="marcador">Ver marcador</button>
      </div>`;
  }
  const nota = g === "error"
    ? `<p class="jd-capa-nota error">No se pudo guardar tu puntuación. <button type="button" class="jd-enlace" data-jd="reintentar-guardar">Intentar de nuevo</button></p>`
    : "";
  return `
    <div class="jd-capa-caja fin">
      ${nuevoRecord ? `<p class="jd-capa-record">¡Nuevo récord!</p>` : `<p class="jd-capa-marca">Se cayó</p>`}
      <p class="jd-capa-puntos">${puntos}</p>
      <p class="jd-capa-texto">${puntos === 1 ? "disco apilado" : "discos apilados"}</p>
      ${nota}
      <button type="button" class="jd-boton" data-jd="jugar">Reintentar</button>
      <button type="button" class="jd-boton secundario" data-jd="marcador">Ver marcador</button>
    </div>`;
}

export function htmlLista(t: TablaDiscos | null, error: boolean): string {
  if (error && !t) return `<li class="jd-vacio">No se pudo cargar el marcador.</li>`;
  if (!t) return `<li class="jd-vacio">Cargando…</li>`;
  if (t.filas.length === 0) return `<li class="jd-vacio">Todavía nadie ha jugado. ¡Pon el primer récord!</li>`;
  return t.filas.map((f) => `
    <li class="${f.esTuyo ? "tuyo" : ""}${f.puesto <= 3 ? ` podio p${f.puesto}` : ""}">
      <span class="jd-puesto">${f.puesto}</span><span class="jd-nombre">${escapar(f.nombre)}${f.esTuyo ? " (tú)" : ""}</span><b>${f.puntos}</b>
    </li>`).join("");
}

function q<T extends HTMLElement>(s: string): T | null { return caja?.querySelector<T>(s) ?? null; }

function actualizar(): void {
  if (!caja) return;
  const puntos = q("#jd-puntos");
  if (puntos && puntos.textContent !== String(partida.puntos)) {
    puntos.textContent = String(partida.puntos);
    puntos.classList.remove("pop"); void puntos.offsetWidth; puntos.classList.add("pop");
  }
  const rec = q("#jd-record"); if (rec) rec.textContent = tabla && tabla.tuMejor > 0 ? String(tabla.tuMejor) : "—";
  q("#jd-pantalla")?.classList.toggle("en-juego", estado === "jugando");
  const capa = q("#jd-capa");
  if (capa) {
    const html = htmlCapa(estado, partida.puntos, partida.apilados, guardado, record);
    if (capa.dataset.html !== html) { capa.innerHTML = html; capa.dataset.html = html; }
    capa.hidden = estado === "jugando" || hoja;
  }
  const h = q("#jd-hoja"); if (h) h.hidden = !hoja;
  const lista = q("#jd-lista"); if (lista) lista.innerHTML = htmlLista(tabla, errorTabla);
  const tuyo = q("#jd-tuyo");
  if (tuyo) {
    const mio = tabla?.filas.find((f) => f.esTuyo);
    tuyo.textContent = mio ? `Vas en el lugar #${mio.puesto} con ${mio.puntos} ${mio.puntos === 1 ? "disco" : "discos"}.` : tabla ? "Juega una partida para entrar al marcador." : "";
  }
}

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

/** Termina la partida: el resultado y el récord salen ya; guardar va por detrás. */
function terminarPartida(): void {
  idPartida++;
  if (partida.apilados === 0 || !api) return;
  const envio: EnvioPartida = { puntos: partida.puntos, apilados: partida.apilados, duracionMs: Math.round(duracion) };
  porConfirmar = Math.max(porConfirmar, partida.apilados);
  if (tabla) {
    const local = conPartida(tabla, partida.apilados, api.nombre);
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
    // Si alguna anterior se había quedado sin guardar, ahora que hay conexión va también.
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

function jugar(): void {
  partida = nuevaPartida();
  pedazos = []; ondas = []; chispas = []; letreros = [];
  sacudida = 0;
  guardado = "nada"; record = false; hoja = false;
  estado = "jugando";
  inicio = performance.now();
  duracion = 0;
  actualizar();
}

/** Un letrero a la vez: el nuevo reemplaza al anterior para que no se encimen. */
function avisar(l: Letrero): void { letreros = [l]; }

/** Lo alto (unidades) de la cara de arriba del disco `i` de la torre (0 = la base). */
const alturaDe = (i: number) => (i + 1) * GRUESO;

function tocar(): void {
  if (estado !== "jugando") return;
  const movil = { ...partida.movil };
  const r = soltar(partida);
  const n = partida.torre.length;
  if (r.tipo === "fallo") {
    // Cae completo junto a la torre.
    pedazos.push({ x: movil.x, ancho: movil.ancho, corteX0: movil.x, corteX1: movil.x + movil.ancho, y: alturaDe(n) + FLOTA,
      vy: 0, vx: (movil.x + movil.ancho / 2 < ANCHO_TABLERO / 2 ? -1 : 1) * 10, giro: 0, vg: (Math.random() < 0.5 ? -1 : 1) * 2.2, kg: pesoDe(movil.ancho).kg });
    duracion = performance.now() - inicio;
    estado = "fin";
    sacudida = 1;
    navigator.vibrate?.([40, 30, 60]);
    actualizar();
    terminarPartida();
    return;
  }
  const tope = partida.torre[n - 1]!;
  if (r.tipo === "corte") {
    pedazos.push({ x: movil.x, ancho: movil.ancho, corteX0: r.cortado.x, corteX1: r.cortado.x + r.cortado.ancho, y: alturaDe(n - 1),
      vy: 4, vx: (r.cortado.x < tope.x ? -1 : 1) * 14, giro: 0, vg: (r.cortado.x < tope.x ? -1 : 1) * 3, kg: pesoDe(movil.ancho).kg });
    if (pesoDe(movil.ancho).kg !== pesoDe(tope.ancho).kg) avisar({ texto: `${pesoDe(tope.ancho).kg} kg`, y: alturaDe(n - 1), vida: 1 });
  } else {
    const cx = tope.x + tope.ancho / 2;
    ondas.push({ x: cx, y: alturaDe(n - 1), r: tope.ancho / 2, vida: 1 });
    for (let k = 0; k < 18; k++) {
      const a = Math.random() * Math.PI * 2;
      chispas.push({ x: cx + Math.cos(a) * tope.ancho / 2, y: alturaDe(n - 1), vx: Math.cos(a) * (18 + Math.random() * 22),
        vy: 10 + Math.random() * 26, vida: 0.6 + Math.random() * 0.5, color: Math.random() < 0.5 ? "#ffffff" : "#ffd45c" });
    }
    const racha = partida.perfectosSeguidos;
    avisar({ texto: r.crecio ? "¡Perfecto! +ancho" : racha > 1 ? `¡Perfecto! ×${racha}` : "¡Perfecto!", y: alturaDe(n - 1), vida: 1 });
    navigator.vibrate?.(12);
  }
  actualizar();
}

function ciclo(ahora: number): void {
  const dt = Math.min(0.05, (ahora - ultimo) / 1000);
  ultimo = ahora;
  reloj += dt;
  // En la portada el disco también se pasea, más despacio, para que la escena esté viva.
  if (estado === "jugando" || estado === "inicio") avanzar(partida, estado === "inicio" ? dt * 0.6 : dt);
  for (const p of pedazos) { p.vy -= 160 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.corteX0 += p.vx * dt; p.corteX1 += p.vx * dt; p.giro += p.vg * dt; }
  pedazos = pedazos.filter((p) => p.y > camY - 60);
  for (const o of ondas) { o.vida -= dt * 1.6; o.r += dt * 40; }
  ondas = ondas.filter((o) => o.vida > 0);
  for (const ch of chispas) { ch.vida -= dt; ch.vy -= 60 * dt; ch.x += ch.vx * dt; ch.y += ch.vy * dt; }
  chispas = chispas.filter((ch) => ch.vida > 0);
  for (const l of letreros) { l.vida -= dt * 0.8; l.y += 10 * dt; }
  letreros = letreros.filter((l) => l.vida > 0);
  sacudida = Math.max(0, sacudida - dt * 2.2);
  dibujar(dt);
  cuadro = requestAnimationFrame(ciclo);
}

function arrancar(): void {
  cancelAnimationFrame(cuadro);
  ultimo = performance.now();
  cuadro = requestAnimationFrame(ciclo);
}

// ── Dibujo ───────────────────────────────────────────────────────────────────

function oscurecer(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

const BASE = { color: "#1f1f24", texto: "#f0efec" };

/**
 * Una sombra suave en forma de elipse, dibujada una vez y estirada a cada disco: `filter: blur`
 * por disco y por cuadro es lento en teléfonos (y Safari no lo tiene).
 */
let sombra: HTMLCanvasElement | null = null;
function pintarSombra(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, alfa: number): void {
  if (!sombra) {
    sombra = document.createElement("canvas");
    sombra.width = 128; sombra.height = 128;
    const s = sombra.getContext("2d")!;
    const g = s.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(0, 0, 0, 1)");
    g.addColorStop(0.6, "rgba(0, 0, 0, 0.7)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    s.fillStyle = g;
    s.fillRect(0, 0, 128, 128);
  }
  c.globalAlpha = alfa;
  c.drawImage(sombra, cx - rx, cy - ry, rx * 2, ry * 2);
  c.globalAlpha = 1;
}

/**
 * Un disco en 3/4 con su cara de arriba centrada en (cx, cy): el canto de caucho, la cara con
 * su brillo, el borde, el peso impreso, el aro de acero y el hoyo.
 */
function pintarDisco(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, grueso: number, ancho: number, base = false): void {
  const ry = rx * INCLINACION;
  const peso = pesoDe(ancho);
  const color = base ? BASE.color : peso.color;
  // Sombra suave debajo (oclusión): lo separa del disco de abajo.
  pintarSombra(c, cx, cy + grueso + ry * 0.15, rx * 1.12, ry * 1.25, 0.55);
  // Canto.
  const canto = c.createLinearGradient(cx - rx, 0, cx + rx, 0);
  canto.addColorStop(0, oscurecer(color, 0.35));
  canto.addColorStop(0.35, oscurecer(color, 0.72));
  canto.addColorStop(0.6, oscurecer(color, 0.62));
  canto.addColorStop(1, oscurecer(color, 0.3));
  c.fillStyle = canto;
  c.beginPath();
  c.moveTo(cx - rx, cy);
  c.lineTo(cx - rx, cy + grueso);
  c.ellipse(cx, cy + grueso, rx, ry, 0, Math.PI, 0, true);
  c.lineTo(cx + rx, cy);
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI, false);
  c.closePath();
  c.fill();
  // Las estrías del caucho en el canto.
  c.save();
  c.clip();
  c.strokeStyle = "rgba(0, 0, 0, 0.18)";
  c.lineWidth = 1;
  for (let k = 1; k < 3; k++) {
    c.beginPath(); c.ellipse(cx, cy + (grueso * k) / 3, rx, ry, 0, 0, Math.PI); c.stroke();
  }
  c.restore();
  // Cara.
  const cara = c.createRadialGradient(cx - rx * 0.35, cy - ry * 0.6, rx * 0.05, cx, cy, rx * 1.05);
  cara.addColorStop(0, oscurecer(color, 1.18));
  cara.addColorStop(0.55, color);
  cara.addColorStop(1, oscurecer(color, 0.78));
  c.fillStyle = cara;
  c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill();
  if (rx < 7) return;
  // Borde levantado y el anillo interior, como los discos de caucho.
  c.lineWidth = Math.max(1, rx * 0.035);
  c.strokeStyle = oscurecer(color, 0.62);
  c.beginPath(); c.ellipse(cx, cy, rx * 0.93, ry * 0.93, 0, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = "rgba(255, 255, 255, 0.12)";
  c.beginPath(); c.ellipse(cx, cy - 1, rx * 0.93, ry * 0.93, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  c.strokeStyle = oscurecer(color, 0.7);
  c.beginPath(); c.ellipse(cx, cy, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2); c.stroke();
  // El peso impreso, al frente, y la marca atrás (en el plano de la cara).
  if (rx > 22) {
    c.save();
    c.translate(cx, cy);
    c.scale(1, INCLINACION);
    c.fillStyle = base ? BASE.texto : peso.texto;
    c.globalAlpha = 0.92;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `900 ${Math.round(rx * 0.2)}px system-ui, -apple-system, sans-serif`;
    c.fillText(base ? "OSFIT" : `${peso.kg} KG`, 0, rx * 0.7);
    c.globalAlpha = 0.55;
    c.font = `800 ${Math.round(rx * 0.12)}px system-ui, -apple-system, sans-serif`;
    c.fillText(base ? "TORRE DE DISCOS" : "OSFIT", 0, -rx * 0.7);
    c.restore();
  }
  // Aro de acero y hoyo.
  const rh = rx * 0.2;
  const acero = c.createLinearGradient(cx - rh, cy - rh * INCLINACION, cx + rh, cy + rh * INCLINACION);
  acero.addColorStop(0, "#f4f6f8");
  acero.addColorStop(0.45, "#8e949c");
  acero.addColorStop(0.7, "#d8dce1");
  acero.addColorStop(1, "#5f656d");
  c.fillStyle = acero;
  c.beginPath(); c.ellipse(cx, cy, rh, rh * INCLINACION, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#0a0a0c";
  c.beginPath(); c.ellipse(cx, cy + rh * INCLINACION * 0.08, rh * 0.5, rh * 0.5 * INCLINACION, 0, 0, Math.PI * 2); c.fill();
  // Brillo de la luz de arriba sobre la cara.
  c.save();
  c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.clip();
  const brillo = c.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.2, cy + ry);
  brillo.addColorStop(0, "rgba(255, 255, 255, 0.16)");
  brillo.addColorStop(0.5, "rgba(255, 255, 255, 0)");
  c.fillStyle = brillo;
  c.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  c.restore();
}

function dibujar(dt: number): void {
  const canvas = q<HTMLCanvasElement>("#jd-canvas");
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
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Cámara: sube con la torre; al perder se aleja para ver la torre entera.
  const n = partida.torre.length;
  const tope = alturaDe(n - 1);
  const e0 = W / VISTA_ANCHO;
  const alto = tope + PLATAFORMA + 30;
  const zoomMeta = estado === "fin" ? Math.min(1, (H * 0.62) / (alto * e0)) : 1;
  zoom += (zoomMeta - zoom) * Math.min(1, dt * 2.5);
  const e = e0 * zoom;
  const visibles = H / e;
  const camMeta = estado === "fin" ? -PLATAFORMA - 6 - Math.max(0, visibles - alto) * 0.35
    // Al principio la plataforma queda a un cuarto de la orilla de abajo; luego sube con la torre.
    : Math.max(-visibles * 0.26, tope + FLOTA + 10 - visibles * 0.58);
  camY += (camMeta - camY) * Math.min(1, dt * 3.2);
  const sx = (x: number) => W / 2 + (x - ANCHO_TABLERO / 2) * e;
  const sy = (y: number) => H - (y - camY) * e;

  // Fondo: la pared oscura del gym, con un reflector cálido desde arriba.
  const fondo = c.createLinearGradient(0, 0, 0, H);
  fondo.addColorStop(0, "#0d0e13");
  fondo.addColorStop(1, "#17151a");
  c.fillStyle = fondo;
  c.fillRect(0, 0, W, H);
  const foco = c.createRadialGradient(W / 2, -H * 0.1, 10, W / 2, -H * 0.1, H * 1.1);
  foco.addColorStop(0, "rgba(255, 228, 180, 0.22)");
  foco.addColorStop(0.45, "rgba(255, 210, 150, 0.07)");
  foco.addColorStop(1, "rgba(0, 0, 0, 0)");
  c.fillStyle = foco;
  c.fillRect(0, 0, W, H);
  // El cono del reflector y el polvo que flota en él.
  c.save();
  c.globalCompositeOperation = "lighter";
  const cono = c.createLinearGradient(0, 0, 0, H);
  cono.addColorStop(0, "rgba(255, 236, 200, 0.08)");
  cono.addColorStop(1, "rgba(255, 236, 200, 0)");
  c.fillStyle = cono;
  c.beginPath(); c.moveTo(W * 0.42, 0); c.lineTo(W * 0.58, 0); c.lineTo(W * 0.95, H); c.lineTo(W * 0.05, H); c.closePath(); c.fill();
  if (motas.length === 0) for (let k = 0; k < 28; k++) motas.push({ x: Math.random(), y: Math.random(), v: 0.01 + Math.random() * 0.02, r: 0.6 + Math.random() * 1.4 });
  for (const m of motas) {
    m.y -= m.v * dt; if (m.y < 0) { m.y = 1; m.x = Math.random(); }
    c.fillStyle = `rgba(255, 240, 210, ${0.08 + 0.12 * Math.sin(reloj * 1.3 + m.x * 9) ** 2})`;
    c.beginPath(); c.arc(W * (0.2 + m.x * 0.6) + Math.sin(reloj * 0.4 + m.y * 6) * 6, H * m.y, m.r, 0, Math.PI * 2); c.fill();
  }
  c.restore();

  // Sacudida al perder.
  if (sacudida > 0) c.translate((Math.random() - 0.5) * 10 * sacudida, (Math.random() - 0.5) * 8 * sacudida);

  // Marcas de altura cada 10 discos, en la pared.
  c.font = "700 11px system-ui, sans-serif";
  c.textAlign = "left";
  for (let k = 10; k < n + 40; k += 10) {
    const y = sy(alturaDe(k));
    if (y < -20 || y > H + 20) continue;
    c.strokeStyle = "rgba(255, 255, 255, 0.07)";
    c.setLineDash([3, 7]);
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    c.setLineDash([]);
    c.fillStyle = "rgba(255, 255, 255, 0.3)";
    c.fillText(`${k}`, 8, y - 5);
  }

  // Piso de caucho y plataforma de madera, como las de halterofilia.
  const piso = sy(-PLATAFORMA);
  if (piso < H + 40) {
    const gPiso = c.createLinearGradient(0, piso, 0, H);
    gPiso.addColorStop(0, "#1b1b1f");
    gPiso.addColorStop(1, "#0b0b0d");
    c.fillStyle = gPiso;
    c.fillRect(-20, piso, W + 40, H - piso + 20);
    const px0 = sx(-4), px1 = sx(ANCHO_TABLERO + 4), arriba = sy(0), fondoP = (px1 - px0) * INCLINACION * 0.5;
    const madera = c.createLinearGradient(0, arriba, 0, piso);
    madera.addColorStop(0, "#8a5a32");
    madera.addColorStop(1, "#5a3a20");
    c.fillStyle = madera;
    c.fillRect(px0, arriba, px1 - px0, piso - arriba);
    c.beginPath();
    c.moveTo(px0, arriba); c.lineTo(px1, arriba); c.lineTo(px1 - fondoP * 0.6, arriba - fondoP); c.lineTo(px0 + fondoP * 0.6, arriba - fondoP); c.closePath();
    const cubierta = c.createLinearGradient(0, arriba - fondoP, 0, arriba);
    cubierta.addColorStop(0, "#a8774a");
    cubierta.addColorStop(1, "#c08a55");
    c.fillStyle = cubierta; c.fill();
    c.fillStyle = "#151518";
    const franja = (px1 - px0) * 0.18;
    c.beginPath(); c.moveTo(px0, arriba); c.lineTo(px0 + franja, arriba); c.lineTo(px0 + franja + fondoP * 0.1, arriba - fondoP); c.lineTo(px0 + fondoP * 0.6, arriba - fondoP); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(px1, arriba); c.lineTo(px1 - franja, arriba); c.lineTo(px1 - franja - fondoP * 0.1, arriba - fondoP); c.lineTo(px1 - fondoP * 0.6, arriba - fondoP); c.closePath(); c.fill();
    c.strokeStyle = "rgba(60, 35, 15, 0.35)";
    c.lineWidth = 1;
    for (let k = 1; k < 5; k++) { const yy = arriba - (fondoP * k) / 5; c.beginPath(); c.moveTo(px0 + franja, yy); c.lineTo(px1 - franja, yy); c.stroke(); }
  }

  // La torre, de abajo hacia arriba (los de arriba tapan a los de abajo).
  partida.torre.forEach((d, i) => {
    const cy = sy(alturaDe(i));
    if (cy > H + 80 || cy < -80) return;
    pintarDisco(c, sx(d.x + d.ancho / 2), cy, (d.ancho / 2) * e, GRUESO * e, d.ancho, i === 0);
  });

  // El disco que se mueve, con su sombra sobre la torre.
  if (estado !== "fin") {
    const m = partida.movil;
    const t = partida.torre[n - 1]!;
    c.save();
    c.beginPath(); c.ellipse(sx(t.x + t.ancho / 2), sy(tope), (t.ancho / 2) * e, (t.ancho / 2) * e * INCLINACION, 0, 0, Math.PI * 2); c.clip();
    pintarSombra(c, sx(m.x + m.ancho / 2), sy(tope) + 2, (m.ancho / 2) * e, (m.ancho / 2) * e * INCLINACION, 0.5);
    c.restore();
    pintarDisco(c, sx(m.x + m.ancho / 2), sy(tope + GRUESO + FLOTA), (m.ancho / 2) * e, GRUESO * e, m.ancho);
  }

  // Lo cortado: el mismo disco recortado a su pedazo, cayendo y girando.
  for (const p of pedazos) {
    const cx = sx(p.x + p.ancho / 2), cy = sy(p.y);
    const x0 = sx(p.corteX0), x1 = sx(p.corteX1);
    c.save();
    c.translate((x0 + x1) / 2, cy);
    c.rotate(p.giro);
    c.translate(-(x0 + x1) / 2, -cy);
    c.beginPath(); c.rect(x0, cy - p.ancho * e, x1 - x0, p.ancho * e * 2); c.clip();
    pintarDisco(c, cx, cy, (p.ancho / 2) * e, GRUESO * e, p.ancho);
    c.restore();
  }

  // Perfecto: una onda sobre la cara y chispas.
  for (const o of ondas) {
    c.strokeStyle = `rgba(255, 255, 255, ${o.vida * 0.9})`;
    c.lineWidth = 2.5 * o.vida + 0.5;
    c.beginPath(); c.ellipse(sx(o.x), sy(o.y), o.r * e, o.r * e * INCLINACION, 0, 0, Math.PI * 2); c.stroke();
  }
  c.save();
  c.globalCompositeOperation = "lighter";
  for (const ch of chispas) {
    c.fillStyle = ch.color;
    c.globalAlpha = Math.max(0, Math.min(1, ch.vida * 1.6));
    c.beginPath(); c.arc(sx(ch.x), sy(ch.y), 1.8, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  c.textAlign = "center";
  for (const l of letreros) {
    const a = Math.max(0, Math.min(1, l.vida * 1.5));
    const s = 1 + (1 - Math.min(1, (1 - l.vida) * 6)) * 0.4;
    c.save();
    c.translate(W / 2, sy(l.y + 16));
    c.scale(s, s);
    c.font = "900 22px system-ui, -apple-system, sans-serif";
    c.lineWidth = 5;
    c.strokeStyle = `rgba(0, 0, 0, ${a * 0.55})`;
    c.strokeText(l.texto, 0, 0);
    c.fillStyle = l.texto.startsWith("¡") ? `rgba(255, 212, 92, ${a})` : `rgba(255, 255, 255, ${a})`;
    c.fillText(l.texto, 0, 0);
    c.restore();
  }
  // Viñeta: oscurece las orillas.
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vin = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.8);
  vin.addColorStop(0, "rgba(0, 0, 0, 0)");
  vin.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  c.fillStyle = vin;
  c.fillRect(0, 0, W, H);
}

// ── Montaje ──────────────────────────────────────────────────────────────────

/** El juego va de la cabecera a la barra de abajo. */
function ajustarMarco(): void {
  const pantalla = q("#jd-pantalla");
  if (!pantalla) return;
  const cab = document.querySelector<HTMLElement>(".cabecera");
  // `#barra` es solo el contenedor (mide 0): lo que se ve es la barra fija adentro.
  const barra = [...document.querySelectorAll<HTMLElement>("#barra, #barra > *")].find((b) => b.offsetHeight > 0) ?? null;
  const arriba = cab ? Math.max(0, cab.getBoundingClientRect().bottom + 6) : 0;
  const abajo = barra ? Math.max(0, window.innerHeight - barra.getBoundingClientRect().top) : 0;
  pantalla.style.top = `${arriba}px`;
  pantalla.style.bottom = `${abajo}px`;
}

/** Muestra u oculta la ventana. La primera vez arma su DOM; al salir a media partida la pausa. */
export function mostrarJuego(contenedor: HTMLElement, visible: boolean, conexion: ApiJuego): void {
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
    contenedor.innerHTML = htmlJuego();
    conectar(contenedor);
    tabla = tabla ?? tablaGuardada();
  }
  window.scrollTo(0, 0);
  ajustarMarco();
  requestAnimationFrame(ajustarMarco);
  actualizar();
  arrancar();
  void cargarTabla();
}

function conectar(c: HTMLElement): void {
  const pantalla = c.querySelector<HTMLElement>("#jd-pantalla");
  // pointerdown y no click: en el teléfono el click llega tarde y se siente pegajoso.
  pantalla?.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button, .jd-hoja")) return;
    if (estado !== "jugando") return;
    e.preventDefault();
    tocar();
  });
  c.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-jd]");
    if (!b) return;
    const que = b.dataset.jd;
    if (que === "jugar") jugar();
    if (que === "seguir") { estado = "jugando"; inicio = performance.now() - duracion; actualizar(); }
    if (que === "reintentar-guardar") reenviarPendientes();
    if (que === "marcador") { hoja = true; actualizar(); void cargarTabla(); }
    if (que === "cerrar-hoja") { hoja = false; actualizar(); }
  });
  document.addEventListener("keydown", (e) => {
    if (c.hidden || estado !== "jugando" || (e.key !== " " && e.key !== "Enter")) return;
    e.preventDefault();
    tocar();
  });
  window.addEventListener("resize", () => { if (!c.hidden) ajustarMarco(); });
}
