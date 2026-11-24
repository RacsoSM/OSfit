import {
  ANCHO_TABLERO, avanzar, nuevaPartida, soltar, type Disco, type Partida,
} from "../juegoDiscos";
import { escapar } from "./tarjetaDia";

/**
 * La ventana del minijuego Torre de discos (lógica en `../juegoDiscos.ts`) y su tabla de
 * puntuaciones (`guardarPartidaDiscos` y `tablaDiscos` en functions).
 *
 * Vive en su propio contenedor (`#juego`, `contenedorPropio` en `ventanas.ts`), fuera del
 * repintado de `#contenido`: un snapshot de Firestore a media partida no debe tirar el canvas.
 * Por eso el DOM se arma una sola vez y después solo se actualizan sus partes.
 */

export interface FilaTabla { puesto: number; nombre: string; puntos: number; esTuyo: boolean }
/** Los records: la mejor partida de cada quien, de siempre, con su nombre completo. */
export interface TablaDiscos { filas: FilaTabla[]; tuMejor: number }
export interface EnvioPartida { puntos: number; apilados: number; duracionMs: number }
export interface RespuestaPartida { record: boolean; tabla: TablaDiscos }

export interface ApiJuego {
  guardar: (p: EnvioPartida) => Promise<RespuestaPartida>;
  tabla: () => Promise<TablaDiscos>;
}

/** Los discos de colores de un gym (25, 20, 15, 10 y 5 kg). */
export const COLORES_DISCO = ["#e0453a", "#3b8fff", "#ffb703", "#2fae5a", "#e9e7e1"];
const BASE = "#4a4a52";
/** Alto de un disco en unidades del tablero. */
const ALTO_DISCO = 7;
/** Lo que se ve a lo ancho: el tablero más lo que el disco se pasea por fuera. */
const VISTA_X0 = -16, VISTA_ANCHO = ANCHO_TABLERO + 32;

type Estado = "inicio" | "jugando" | "pausa" | "fin";

interface Pieza extends Disco { y: number; vy: number; giro: number; vg: number }
interface Destello { texto: string; y: number; vida: number }

let caja: HTMLElement | null = null;
let api: ApiJuego | null = null;
let estado: Estado = "inicio";
let partida: Partida = nuevaPartida();
let inicio = 0;
let duracion = 0;
let piezas: Pieza[] = [];
let destellos: Destello[] = [];
let brillo = 0;
let camara = 0;
let cuadro = 0;
let ultimo = 0;
let tabla: TablaDiscos | null = null;
let errorTabla = false;
let guardado: "nada" | "guardando" | "guardado" | "error" = "nada";
let record = false;

// Solo en desarrollo (Vite lo quita del build): deja leer la partida para grabar demos.
if (import.meta.env?.DEV) (globalThis as { __torreDiscos?: () => { partida: Partida; estado: Estado } }).__torreDiscos = () => ({ partida, estado });

/** Para los tests. */
export function reiniciarJuego(): void {
  cancelAnimationFrame(cuadro);
  caja = null; api = null; estado = "inicio"; partida = nuevaPartida(); piezas = []; destellos = [];
  tabla = null; errorTabla = false; guardado = "nada"; record = false;
}

/** Lo de fuera del canvas. Se arma una vez; `actualizar()` cambia solo los textos. */
export function htmlJuego(): string {
  return `
    <div class="tarjeta jd">
      <div class="jd-marcador">
        <div><span>Puntos</span><b id="jd-puntos">0</b></div>
        <div><span>Tu récord</span><b id="jd-record">—</b></div>
        <div><span>Tu lugar</span><b id="jd-lugar">—</b></div>
      </div>
      <div class="jd-lienzo" id="jd-lienzo">
        <canvas id="jd-canvas" aria-label="Torre de discos"></canvas>
        <div class="jd-capa" id="jd-capa"></div>
      </div>
    </div>
    <div class="tarjeta jd-tabla">
      <p class="jd-tabla-titulo">Records</p>
      <ol class="jd-lista" id="jd-lista"></ol>
    </div>`;
}

/** La capa sobre el canvas: instrucciones, pausa o el resultado. */
export function htmlCapa(e: Estado, puntos: number, apilados: number, g: typeof guardado, nuevoRecord: boolean): string {
  if (e === "jugando") return "";
  if (e === "pausa") {
    return `<div class="jd-capa-caja"><p class="jd-capa-titulo">Pausa</p><button type="button" class="boton" data-jd="seguir">Seguir</button></div>`;
  }
  if (e === "inicio") {
    return `
      <div class="jd-capa-caja">
        <p class="jd-capa-titulo">Torre de discos</p>
        <p class="jd-capa-texto">Toca para soltar cada disco sobre la torre. Lo que sobresale se corta, así que apunta bien: si lo sueltas justo encima, es <b>perfecto</b> y vale doble.</p>
        <button type="button" class="boton" data-jd="jugar">Jugar</button>
      </div>`;
  }
  const etiqueta = nuevoRecord ? "¡Nuevo récord!" : "";
  const estadoGuardado = g === "guardando" ? `<p class="jd-capa-nota">Guardando tu puntuación…</p>`
    : g === "error" ? `<p class="jd-capa-nota error">No se pudo guardar tu puntuación. <button type="button" class="jd-enlace" data-jd="reintentar">Reintentar</button></p>`
    : "";
  return `
    <div class="jd-capa-caja">
      ${etiqueta ? `<p class="jd-capa-record">${etiqueta}</p>` : ""}
      <p class="jd-capa-puntos">${puntos}</p>
      <p class="jd-capa-texto">${puntos === 1 ? "punto" : "puntos"} · ${apilados} ${apilados === 1 ? "disco" : "discos"}</p>
      ${estadoGuardado}
      <button type="button" class="boton" data-jd="jugar">Jugar otra vez</button>
    </div>`;
}

export function htmlLista(t: TablaDiscos | null, error: boolean): string {
  if (error && !t) return `<li class="jd-vacio">No se pudo cargar la tabla.</li>`;
  if (!t) return `<li class="jd-vacio">Cargando…</li>`;
  if (t.filas.length === 0) return `<li class="jd-vacio">Todavía nadie ha jugado. ¡Pon el primer récord!</li>`;
  return t.filas.map((f) => `
    <li class="${f.esTuyo ? "tuyo" : ""}${f.puesto <= 3 ? ` podio p${f.puesto}` : ""}">
      <span class="jd-puesto">${f.puesto}</span><span class="jd-nombre">${escapar(f.nombre)}${f.esTuyo ? " (tú)" : ""}</span><b>${f.puntos}</b>
    </li>`).join("");
}

function actualizar(): void {
  if (!caja) return;
  const q = <T extends HTMLElement>(s: string) => caja!.querySelector<T>(s);
  const puntos = q("#jd-puntos"); if (puntos) puntos.textContent = String(partida.puntos);
  const rec = q("#jd-record"); if (rec) rec.textContent = tabla && tabla.tuMejor > 0 ? String(tabla.tuMejor) : "—";
  const lugar = q("#jd-lugar");
  const mio = tabla?.filas.find((f) => f.esTuyo);
  if (lugar) lugar.textContent = mio ? `#${mio.puesto}` : "—";
  const capa = q("#jd-capa");
  if (capa) {
    capa.innerHTML = htmlCapa(estado, partida.puntos, partida.apilados, guardado, record);
    capa.hidden = estado === "jugando";
  }
  const lista = q("#jd-lista"); if (lista) lista.innerHTML = htmlLista(tabla, errorTabla);
}

async function cargarTabla(): Promise<void> {
  if (!api) return;
  try { tabla = await api.tabla(); errorTabla = false; } catch { errorTabla = true; }
  actualizar();
}

async function guardarPartida(): Promise<void> {
  if (!api || partida.apilados === 0) { guardado = "nada"; actualizar(); return; }
  guardado = "guardando";
  actualizar();
  try {
    const r = await api.guardar({ puntos: partida.puntos, apilados: partida.apilados, duracionMs: Math.round(duracion) });
    record = r.record;
    tabla = r.tabla;
    guardado = "guardado";
  } catch {
    guardado = "error";
  }
  actualizar();
}

function jugar(): void {
  partida = nuevaPartida();
  piezas = []; destellos = []; brillo = 0; camara = 0;
  guardado = "nada"; record = false;
  estado = "jugando";
  inicio = performance.now();
  duracion = 0;
  actualizar();
  arrancarCiclo();
}

function tocar(): void {
  if (estado !== "jugando") return;
  const r = soltar(partida);
  const alto = partida.torre.length;
  if (r.tipo === "fallo") {
    piezas.push({ ...r.caido, y: alto * ALTO_DISCO, vy: 0, giro: 0, vg: (Math.random() - 0.5) * 3 });
    duracion = performance.now() - inicio;
    estado = "fin";
    navigator.vibrate?.(60);
    actualizar();
    void guardarPartida();
    return;
  }
  if (r.tipo === "corte") {
    piezas.push({ ...r.cortado, y: (alto - 1) * ALTO_DISCO, vy: 0, giro: 0, vg: (r.cortado.x < partida.torre[alto - 1]!.x ? -1 : 1) * 2.5 });
  } else {
    brillo = 1;
    destellos.push({ texto: r.crecio ? "¡Perfecto! +ancho" : "¡Perfecto!", y: alto * ALTO_DISCO, vida: 1 });
    navigator.vibrate?.(15);
  }
  actualizar();
}

function arrancarCiclo(): void {
  cancelAnimationFrame(cuadro);
  ultimo = performance.now();
  const paso = (ahora: number) => {
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    if (estado === "jugando") avanzar(partida, dt);
    for (const p of piezas) { p.vy -= 260 * dt; p.y += p.vy * dt; p.giro += p.vg * dt; }
    piezas = piezas.filter((p) => p.y > camara - 120);
    for (const d of destellos) { d.vida -= dt * 0.9; d.y += 12 * dt; }
    destellos = destellos.filter((d) => d.vida > 0);
    brillo = Math.max(0, brillo - dt * 2.5);
    dibujar(dt);
    // Sigue mientras haya algo que se mueva; en reposo no gasta batería.
    if (estado === "jugando" || piezas.length > 0 || destellos.length > 0 || brillo > 0) cuadro = requestAnimationFrame(paso);
  };
  cuadro = requestAnimationFrame(paso);
}

function redondeado(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

/** Un disco de lado: su color, un aro más oscuro al centro y un brillo arriba. */
function pintarDisco(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  redondeado(c, x, y, w, h, h * 0.35);
  c.fill();
  c.fillStyle = "rgba(0, 0, 0, 0.18)";
  c.fillRect(x + w * 0.06, y + h * 0.42, Math.max(0, w * 0.88), h * 0.16);
  c.fillStyle = "rgba(255, 255, 255, 0.22)";
  c.fillRect(x + h * 0.3, y + h * 0.12, Math.max(0, w - h * 0.6), h * 0.14);
}

function dibujar(dt = 0): void {
  const canvas = caja?.querySelector<HTMLCanvasElement>("#jd-canvas");
  if (!canvas) return;
  const anchoCss = canvas.clientWidth, altoCss = canvas.clientHeight;
  if (anchoCss === 0 || altoCss === 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(anchoCss * dpr) || canvas.height !== Math.round(altoCss * dpr)) {
    canvas.width = Math.round(anchoCss * dpr);
    canvas.height = Math.round(altoCss * dpr);
  }
  const c = canvas.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const e = anchoCss / VISTA_ANCHO; // px por unidad
  const altoUnidades = altoCss / e;
  // La cámara sube con la torre: el disco que se mueve queda a un 40 % del alto.
  const alto = partida.torre.length * ALTO_DISCO;
  const meta = Math.max(0, alto - altoUnidades * 0.6);
  camara += (meta - camara) * Math.min(1, dt * 4 || 1);
  const px = (x: number) => (x - VISTA_X0) * e;
  const py = (y: number) => altoCss - (y - camara) * e; // y en unidades, desde el piso

  const fondo = c.createLinearGradient(0, 0, 0, altoCss);
  fondo.addColorStop(0, "#14141c");
  fondo.addColorStop(1, "#0d0d10");
  c.fillStyle = fondo;
  c.fillRect(0, 0, anchoCss, altoCss);

  // Marcas de altura cada 10 discos.
  c.font = `700 ${Math.max(10, e * 3)}px system-ui, sans-serif`;
  c.textAlign = "left";
  for (let n = 10; n * ALTO_DISCO < camara + altoUnidades; n += 10) {
    const y = py((n + 1) * ALTO_DISCO);
    if (y < -20 || y > altoCss) continue;
    c.strokeStyle = "rgba(255, 255, 255, 0.06)";
    c.setLineDash([4, 6]);
    c.beginPath(); c.moveTo(0, y); c.lineTo(anchoCss, y); c.stroke();
    c.setLineDash([]);
    c.fillStyle = "rgba(255, 255, 255, 0.25)";
    c.fillText(String(n), 6, y - 4);
  }

  const h = ALTO_DISCO * e * 0.92;
  partida.torre.forEach((d, i) => {
    const y = py((i + 1) * ALTO_DISCO);
    if (y > altoCss + h || y < -h) return;
    pintarDisco(c, px(d.x), y, d.ancho * e, h, i === 0 ? BASE : COLORES_DISCO[(d.color - 1) % COLORES_DISCO.length]!);
  });
  if (brillo > 0 && partida.torre.length > 1) {
    const d = partida.torre[partida.torre.length - 1]!;
    c.strokeStyle = `rgba(255, 255, 255, ${brillo})`;
    c.lineWidth = 3;
    redondeado(c, px(d.x) - 3, py(partida.torre.length * ALTO_DISCO) - 3, d.ancho * e + 6, h + 6, h * 0.4);
    c.stroke();
  }
  if (estado === "jugando" || estado === "pausa" || estado === "inicio") {
    const m = partida.movil;
    pintarDisco(c, px(m.x), py((partida.torre.length + 1) * ALTO_DISCO), m.ancho * e, h, COLORES_DISCO[(m.color - 1) % COLORES_DISCO.length]!);
  }
  for (const p of piezas) {
    const w = p.ancho * e;
    c.save();
    c.translate(px(p.x) + w / 2, py(p.y + ALTO_DISCO) + h / 2);
    c.rotate(p.giro);
    pintarDisco(c, -w / 2, -h / 2, w, h, COLORES_DISCO[(p.color - 1) % COLORES_DISCO.length]!);
    c.restore();
  }
  c.textAlign = "center";
  c.font = `900 ${Math.max(14, e * 5)}px system-ui, sans-serif`;
  for (const d of destellos) {
    c.fillStyle = `rgba(255, 255, 255, ${Math.max(0, d.vida)})`;
    c.fillText(d.texto, anchoCss / 2, py(d.y + ALTO_DISCO * 2.2));
  }
}

/**
 * Muestra u oculta la ventana. La primera vez arma su DOM y sus toques; al salir a media
 * partida la pausa.
 */
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
  }
  actualizar();
  requestAnimationFrame(() => dibujar());
  void cargarTabla();
}

function conectar(c: HTMLElement): void {
  const lienzo = c.querySelector<HTMLElement>("#jd-lienzo");
  // pointerdown y no click: en el teléfono el click llega tarde y se siente pegajoso.
  lienzo?.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    tocar();
  });
  c.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-jd]");
    if (!b) return;
    if (b.dataset.jd === "jugar") jugar();
    if (b.dataset.jd === "seguir") { estado = "jugando"; inicio = performance.now() - duracion; actualizar(); arrancarCiclo(); }
    if (b.dataset.jd === "reintentar") void guardarPartida();
  });
  document.addEventListener("keydown", (e) => {
    if (c.hidden || estado !== "jugando" || (e.key !== " " && e.key !== "Enter")) return;
    e.preventDefault();
    tocar();
  });
  window.addEventListener("resize", () => { if (!c.hidden) dibujar(); });
}
