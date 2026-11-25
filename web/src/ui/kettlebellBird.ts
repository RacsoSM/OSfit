import {
  ALTO, ANCHO_DISCO, ANCHO_TUBO, PISO, RADIO, aletear, avanzar, nivel, nuevoVuelo, type Vuelo,
} from "../kettlebellBird";
import { conPartida, htmlLista, type ApiJuego, type EnvioPartida, type TablaDiscos } from "./juegoDiscos";
import { ZONAS, pintarPolvo, pintarZona } from "./gimnasioFondo";
import { escapar } from "./tarjetaDia";
import { marcasDe, pintarEtiqueta } from "./marcasRecords";
import { ajustarMarcoJuego, pintarSeguro, prepararMarcoJuego, vigilarMarcoJuego } from "./marcoJuego";

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
/** El nivel en pantalla (su zona del gimnasio), la zona de la que viene y cuánto lleva la transición. */
let nivelVisto = 1;
let zonaAnterior: number | null = null;
let mezcla = 1;
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
      <p class="jd-hud-nivel jd-nivel-abajo" id="kb-nivel"></p>
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

export function htmlCapaKettlebell(e: Estado, puntos: number, g: Guardado, nuevoRecord: boolean, nivelAlcanzado = 1): string {
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
        <p class="jd-capa-texto">Toca para que la kettlebell aletee y suba. Pasa por el hueco entre las barras sin tocarlas ni caer al piso. Cada barra es un punto, y cada 8 subes de nivel: otra zona del gimnasio, más rápido y con las barras más juntas.</p>
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
      <p class="jd-capa-texto">${puntos === 1 ? "barra pasada" : "barras pasadas"} · Nivel ${nivelAlcanzado}, ${escapar(ZONAS[nivelAlcanzado - 1]?.nombre ?? "")}</p>
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
  const niv = q("#kb-nivel"); if (niv) niv.textContent = `Nivel ${nivelVisto} · ${ZONAS[nivelVisto - 1]!.nombre}`;
  q("#kb-pantalla")?.classList.toggle("en-juego", estado === "jugando");
  const capa = q("#kb-capa");
  if (capa) {
    const html = htmlCapaKettlebell(estado, vuelo.puntos, guardado, record, nivel(vuelo.puntos));
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
  nivelVisto = 1; zonaAnterior = null; mezcla = 1;
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
    if (ev === "punto" && nivel(vuelo.puntos) > nivelVisto) {
      zonaAnterior = nivelVisto - 1;
      nivelVisto = nivel(vuelo.puntos);
      mezcla = 0;
      // El cambio de nivel, discreto (entrenador, 2026-11-25: "que no estorbe tanto en la
      // pantalla"): sin letrero en medio; solo brilla un momento la línea del nivel en el marcador.
      const niv = q("#kb-nivel");
      if (niv) { niv.classList.remove("sube"); void niv.offsetWidth; niv.classList.add("sube"); }
      navigator.vibrate?.(25);
    }
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
  mezcla = Math.min(1, mezcla + dt / 1.2);
  destello = Math.max(0, destello - dt * 4);
  cuadro = requestAnimationFrame(ciclo);
  pintarSeguro(dibujar);
}

function arrancar(): void {
  cancelAnimationFrame(cuadro);
  ultimo = performance.now();
  cuadro = requestAnimationFrame(ciclo);
}

// ── Dibujo ───────────────────────────────────────────────────────────────────

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

  // El gimnasio de la zona del nivel; al subir de nivel, la zona nueva aparece sobre la anterior.
  const zona = ZONAS[nivelVisto - 1]!;
  if (zonaAnterior !== null && mezcla < 1) {
    pintarZona(c, ZONAS[zonaAnterior]!, W, H, e, piso, r, reloj);
    c.globalAlpha = mezcla;
    pintarZona(c, zona, W, H, e, piso, r, reloj);
    c.globalAlpha = 1;
  } else {
    pintarZona(c, zona, W, H, e, piso, r, reloj);
  }

  // Las barras: una barra de acero con sus discos en la punta, colgando del techo y parada en el piso.
  for (const b of vuelo.barras) {
    const x = b.x * e, w = ANCHO_DISCO * e;
    const arriba = (b.centro - b.hueco / 2) * e, abajo = (b.centro + b.hueco / 2) * e;
    pintarBarraConDisco(c, x, w, -10, arriba, true, e);
    pintarBarraConDisco(c, x, w, abajo, piso, false, e);
  }

  // Dónde quedaron los records: una meta cuadriculada en el hueco de esa barra, con su nombre.
  const marcas = marcasDe(tabla);
  for (const b of vuelo.barras) {
    const m = marcas.find((x) => x.puntos === b.n);
    if (!m) continue;
    const cx = (b.x + ANCHO_DISCO / 2) * e;
    const arriba = (b.centro - b.hueco / 2) * e, abajo = (b.centro + b.hueco / 2) * e;
    const superada = vuelo.puntos > m.puntos;
    const cuadro = Math.max(3, e * 0.9);
    c.save();
    c.globalAlpha = superada ? 0.35 : 0.85;
    for (let y = arriba + 3 * e, k = 0; y < abajo - 3 * e; y += cuadro, k++) {
      c.fillStyle = k % 2 ? (m.tuya ? "#ffd45c" : "#ff4fd8") : "#ffffff";
      c.fillRect(cx - cuadro, y, cuadro, cuadro);
      c.fillStyle = k % 2 ? "#ffffff" : (m.tuya ? "#ffd45c" : "#ff4fd8");
      c.fillRect(cx, y, cuadro, cuadro);
    }
    c.restore();
    pintarEtiqueta(c, m, "", cx, arriba + 3 * e + 10, "centro", superada);
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
  pintarPolvo(c, zona, W, H, 1 / 60, reloj);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (destello > 0) { c.fillStyle = `rgba(255, 255, 255, ${destello * 0.5})`; c.fillRect(0, 0, W, H); }
  const vin = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8);
  vin.addColorStop(0, "rgba(0, 0, 0, 0)"); vin.addColorStop(1, "rgba(0, 0, 0, 0.45)");
  c.fillStyle = vin; c.fillRect(0, 0, W, H);
}

/** Una textura de grano (caucho o hierro martelinado), hecha una vez y repetida. */
const texturas = new Map<string, CanvasPattern | null>();
function textura(c: CanvasRenderingContext2D, tipo: "caucho" | "hierro"): CanvasPattern | null {
  if (texturas.has(tipo)) return texturas.get(tipo)!;
  const t = document.createElement("canvas");
  t.width = 96; t.height = 96;
  const x = t.getContext("2d")!;
  const img = x.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random();
    // El hierro martelinado tiene manchas más grandes y contrastadas que el grano del caucho.
    const v = tipo === "hierro" ? (n > 0.55 ? 255 : 0) : (n > 0.5 ? 255 : 0);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = tipo === "hierro" ? Math.round(n * 34) : Math.round(n * 22);
  }
  x.putImageData(img, 0, 0);
  if (tipo === "hierro") { x.filter = "blur(0.8px)"; x.drawImage(t, 0, 0); }
  const patron = c.createPattern(t, "repeat");
  texturas.set(tipo, patron);
  return patron;
}

/** El brillo de un cilindro de metal visto de lado: oscuro en las orillas, una raya de luz. */
function gradCilindro(c: CanvasRenderingContext2D, x0: number, x1: number, base: [string, string, string, string]): CanvasGradient {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, base[0]); g.addColorStop(0.22, base[1]); g.addColorStop(0.32, base[2]);
  g.addColorStop(0.62, base[1]); g.addColorStop(1, base[3]);
  return g;
}

const CROMO: [string, string, string, string] = ["#3e4248", "#c3c8ce", "#ffffff", "#2c2f34"];
const INCL = 0.27;


/** Un cilindro vertical de `ya` a `yb` con su tapa visible arriba (`tapaArriba`) o abajo. */
function cilindro(c: CanvasRenderingContext2D, cx: number, r: number, ya: number, yb: number, tapaArriba: boolean,
  lado: CanvasGradient | string, tapa: (cy: number) => void): void {
  const ry = r * INCL;
  c.fillStyle = lado;
  c.beginPath();
  if (tapaArriba) {
    c.moveTo(cx - r, ya); c.lineTo(cx - r, yb); c.ellipse(cx, yb, r, ry, 0, Math.PI, 0, true); c.lineTo(cx + r, ya); c.closePath();
  } else {
    c.moveTo(cx - r, yb); c.lineTo(cx - r, ya); c.ellipse(cx, ya, r, ry, 0, Math.PI, 0, false); c.lineTo(cx + r, yb); c.closePath();
  }
  c.fill();
  tapa(tapaArriba ? ya : yb);
}

/** Una sombra suave en el piso, con forma de elipse. */
function pintarSombra(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, alfa: number): void {
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(0, 0, 0, ${alfa})`); g.addColorStop(1, "rgba(0, 0, 0, 0)");
  c.save(); c.translate(cx, cy); c.scale(1, ry / rx); c.translate(-cx, -cy);
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rx, 0, Math.PI * 2); c.fill();
  c.restore();
}

/** El texto alrededor de la cara de un disco, en su plano (moldeado en el caucho o en el hierro). */
function textoCircular(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, incl: number, texto: string, tam: number, color: string, desde: number): void {
  c.save();
  c.translate(cx, cy);
  c.scale(1, incl);
  c.fillStyle = color;
  c.font = `900 ${Math.round(tam)}px system-ui, sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  const paso = (tam * 0.78) / r;
  let ang = desde - (paso * (texto.length - 1)) / 2;
  for (const letra of texto) {
    c.save();
    c.rotate(ang);
    c.translate(0, r);
    c.rotate(Math.PI);
    c.fillText(letra, 0, 0);
    c.restore();
    ang += paso;
  }
  c.restore();
}

interface Disco3D {
  r: number;          // radio en px
  incl: number;       // alto de la elipse ÷ ancho
  grueso: number;     // px
  material: "bumper" | "hierro";
  color: string;
  kg: string;
  luz: "estudio" | "calida" | "contraluz";
  agarraderas?: boolean;
  textoCanto?: boolean;
}

/**
 * Un disco 3D con su cara del lado de la cámara (`caraArriba`): el canto con su luz, la cara con
 * su grano, el borde levantado, el texto moldeado alrededor, el inserto de acero con tornillos
 * (bumper) o las tres agarraderas (hierro), y el hoyo.
 */
function pintarDisco3D(c: CanvasRenderingContext2D, cx: number, cy: number, d: Disco3D, caraArriba: boolean): void {
  const { r, incl, grueso } = d;
  const ry = r * incl;
  const hierro = d.material === "hierro";
  const ya = caraArriba ? cy : cy - grueso, yb = caraArriba ? cy + grueso : cy;
  // Canto.
  const canto = c.createLinearGradient(cx - r, 0, cx + r, 0);
  const luzCanto = d.luz === "contraluz" ? 0.55 : d.luz === "calida" ? 1.05 : 1;
  canto.addColorStop(0, shade(d.color, 0.3 * luzCanto));
  canto.addColorStop(0.3, shade(d.color, (hierro ? 1.5 : 1.08) * luzCanto));
  canto.addColorStop(0.4, shade(d.color, (hierro ? 1.75 : 1.22) * luzCanto));
  canto.addColorStop(0.7, shade(d.color, 0.75 * luzCanto));
  canto.addColorStop(1, shade(d.color, 0.28 * luzCanto));
  c.fillStyle = canto;
  c.beginPath();
  if (caraArriba) { c.moveTo(cx - r, ya); c.lineTo(cx - r, yb); c.ellipse(cx, yb, r, ry, 0, Math.PI, 0, true); c.lineTo(cx + r, ya); }
  else { c.moveTo(cx - r, yb); c.lineTo(cx - r, ya); c.ellipse(cx, ya, r, ry, 0, Math.PI, 0, false); c.lineTo(cx + r, yb); }
  c.closePath();
  c.fill();
  c.save(); c.clip();
  const tex = textura(c, hierro ? "hierro" : "caucho");
  if (tex) { c.fillStyle = tex; c.fillRect(cx - r, ya - ry, r * 2, grueso + ry * 2); }
  // Dos estrías del molde a lo largo del canto.
  c.strokeStyle = "rgba(0, 0, 0, 0.28)"; c.lineWidth = 1;
  for (const f of [0.33, 0.66]) { const yy = ya + (yb - ya) * f; c.beginPath(); c.ellipse(cx, yy, r, ry, 0, 0, Math.PI); c.stroke(); }
  if (d.textoCanto) {
    c.fillStyle = "rgba(255, 255, 255, 0.85)";
    c.font = `900 ${Math.round(grueso * 0.42)}px system-ui, sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(`OSFIT · ${d.kg} KG`, cx, (ya + yb) / 2 + ry * 0.6);
  }
  c.restore();
  if (d.luz === "contraluz") {
    // El neón detrás: un filo de luz en las dos orillas del canto.
    const lw = Math.max(2, r * 0.05);
    c.fillStyle = "rgba(255, 79, 216, 0.75)"; c.fillRect(cx - r, ya, lw, yb - ya);
    c.fillStyle = "rgba(126, 243, 255, 0.75)"; c.fillRect(cx + r - lw, ya, lw, yb - ya);
  }
  // Cara.
  const fy = caraArriba ? ya : yb;
  const brillo = d.luz === "contraluz" ? 0.85 : d.luz === "calida" ? 1.35 : 1.25;
  const cara = c.createRadialGradient(cx - r * 0.35, fy - ry * 0.6, r * 0.05, cx, fy, r * 1.1);
  cara.addColorStop(0, shade(d.color, hierro ? brillo * 1.5 : brillo));
  cara.addColorStop(0.55, shade(d.color, d.luz === "contraluz" ? 0.75 : 1));
  cara.addColorStop(1, shade(d.color, 0.62));
  c.fillStyle = cara;
  c.beginPath(); c.ellipse(cx, fy, r, ry, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.clip();
  if (tex) { c.fillStyle = tex; c.fillRect(cx - r, fy - ry, r * 2, ry * 2); }
  if (d.luz === "calida") {
    const calida = c.createRadialGradient(cx - r * 0.2, fy - ry, 0, cx - r * 0.2, fy - ry, r * 1.2);
    calida.addColorStop(0, "rgba(255, 210, 140, 0.28)"); calida.addColorStop(1, "rgba(255, 210, 140, 0)");
    c.fillStyle = calida; c.fillRect(cx - r, fy - ry, r * 2, ry * 2);
  }
  c.restore();
  // Borde levantado (labio) con su brillo.
  c.lineWidth = Math.max(1.5, r * 0.07);
  c.strokeStyle = shade(d.color, hierro ? 1.9 : 0.62);
  c.beginPath(); c.ellipse(cx, fy, r * 0.93, ry * 0.93, 0, 0, Math.PI * 2); c.stroke();
  c.lineWidth = Math.max(1, r * 0.025);
  c.strokeStyle = d.luz === "contraluz" ? "rgba(126, 243, 255, 0.8)" : "rgba(255, 255, 255, 0.45)";
  c.beginPath(); c.ellipse(cx, fy, r * 0.97, ry * 0.97, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  if (d.agarraderas) {
    // Las tres agarraderas del disco de hierro: huecos con su canto.
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + k * (Math.PI * 2) / 3 + 0.3;
      const hx = cx + Math.cos(a) * r * 0.66, hy = fy + Math.sin(a) * ry * 0.66;
      c.save(); c.translate(hx, hy); c.scale(1, incl); c.rotate(a + Math.PI / 2);
      c.fillStyle = "#050506";
      caja2(c, -r * 0.2, -r * 0.08, r * 0.4, r * 0.16, r * 0.08); c.fill();
      c.strokeStyle = "rgba(255, 255, 255, 0.25)"; c.lineWidth = 1.2; c.stroke();
      c.restore();
    }
  } else {
    textoCircular(c, cx, fy, r * 0.78, incl, "OSFIT", r * 0.15, "rgba(255, 255, 255, 0.85)", Math.PI);
    textoCircular(c, cx, fy, r * 0.78, incl, `${d.kg} KG`, r * 0.15, "rgba(255, 255, 255, 0.85)", 0);
  }
  if (hierro) textoCircular(c, cx, fy, r * 0.8, incl, `${d.kg} KG`, r * 0.13, "rgba(225, 225, 225, 0.75)", Math.PI);
  // Inserto de acero con seis tornillos (bumper) o el cubo fundido (hierro), y el hoyo.
  const ri = r * (hierro ? 0.3 : 0.34);
  c.fillStyle = gradCilindro(c, cx - ri, cx + ri, hierro ? ["#1c1d20", "#5a5d63", "#8a8e95", "#151619"] : CROMO);
  c.beginPath(); c.ellipse(cx, fy, ri, ri * incl, 0, 0, Math.PI * 2); c.fill();
  if (!hierro) {
    c.fillStyle = "#6b7078";
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      c.beginPath(); c.ellipse(cx + Math.cos(a) * ri * 0.75, fy + Math.sin(a) * ri * 0.75 * incl, ri * 0.09, ri * 0.09 * incl + 0.5, 0, 0, Math.PI * 2); c.fill();
    }
  }
  c.fillStyle = "#0b0c0e";
  c.beginPath(); c.ellipse(cx, fy, ri * 0.48, ri * 0.48 * incl, 0, 0, Math.PI * 2); c.fill();
}

/**
 * El obstáculo (entrenador, 2026-11-24, discos "P2"): la barra olímpica moleteada y, en la punta
 * del lado del hueco, un disco de hierro fundido con sus tres agarraderas, visto un poco desde
 * arriba (el de abajo) o desde abajo (el que cuelga), con luz cálida de lámpara. Las medidas son
 * las de la lógica (`ANCHO_DISCO`, `ANCHO_TUBO`, `DISCO_HASTA`): se ve lo que se choca.
 */
function pintarBarraConDisco(c: CanvasRenderingContext2D, x: number, w: number, y0: number, y1: number, cuelga: boolean, e: number): void {
  const cx = x + w / 2;
  const disco: Disco3D = { r: w / 2, incl: 0.3, grueso: 1.9 * e, material: "hierro", color: "#3b3d42", kg: "20", luz: "calida", agarraderas: true };
  // Desde la orilla del hueco: tapa de la manga, seguro, disco, manga, hombro; luego la barra.
  const dir = cuelga ? -1 : 1;
  let p = cuelga ? y1 : y0;
  const tramo = (h: number) => { const a = cuelga ? p - h : p; const b = cuelga ? p : p + h; p += dir * h; return [a, b] as const; };
  const [tA, tB] = tramo(0.7 * e);
  const [sA, sB] = tramo(1.3 * e);
  const [dA, dB] = tramo(disco.grueso);
  const [mA, mB] = tramo(2.2 * e);
  const [hA, hB] = tramo(0.9 * e);
  const barraA = cuelga ? y0 : p, barraB = cuelga ? p : y1;

  // La barra moleteada.
  const bw = ANCHO_TUBO * e * 0.64;
  c.fillStyle = gradCilindro(c, cx - bw / 2, cx + bw / 2, ["#4a4e55", "#b4b9c0", "#eef0f3", "#33363b"]);
  c.fillRect(cx - bw / 2, barraA, bw, barraB - barraA);
  c.save();
  c.beginPath(); c.rect(cx - bw / 2, barraA, bw, barraB - barraA); c.clip();
  c.strokeStyle = "rgba(25, 28, 33, 0.4)"; c.lineWidth = 0.8;
  for (let yy = barraA - bw; yy < barraB + bw; yy += 2.6) {
    c.beginPath(); c.moveTo(cx - bw / 2, yy); c.lineTo(cx + bw / 2, yy + bw * 0.55); c.stroke();
    c.beginPath(); c.moveTo(cx + bw / 2, yy); c.lineTo(cx - bw / 2, yy + bw * 0.55); c.stroke();
  }
  c.restore();
  if (!cuelga) pintarSombra(c, cx, y1, w * 0.3, w * 0.06, 0.6);

  // Del fondo a la cámara: hombro, manga, disco, seguro, tapa.
  const caraArriba = !cuelga;
  const u = ANCHO_TUBO * e;
  const cil = (r: number, a: number, b: number, grad: [string, string, string, string]) =>
    cilindro(c, cx, r, a, b, caraArriba, gradCilindro(c, cx - r, cx + r, grad), (cy) => {
      c.fillStyle = "#e3e6ea"; c.beginPath(); c.ellipse(cx, cy, r, r * INCL, 0, 0, Math.PI * 2); c.fill();
    });
  cil(u * 0.45, hA, hB, CROMO);
  cil(u * 0.21, mA, mB, CROMO);
  pintarSombra(c, cx, caraArriba ? dB : dA, disco.r * 1.02, disco.r * disco.incl * 1.1, 0.45);
  pintarDisco3D(c, cx, caraArriba ? dA : dB, disco, caraArriba);
  cil(u * 0.32, sA, sB, ["#0d0e10", "#3a3d44", "#5a5e66", "#08090a"]);
  c.fillStyle = "#c9302a"; caja2(c, cx + u * 0.26, sA + (sB - sA) * 0.25, u * 0.5, (sB - sA) * 0.42, 2); c.fill();
  cil(u * 0.21, tA, tB, CROMO);
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
  c.restore();
}

// ── Montaje ──────────────────────────────────────────────────────────────────

function ajustarMarco(): void {
  ajustarMarcoJuego(q("#kb-pantalla"));
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
  prepararMarcoJuego(ajustarMarco);
  requestAnimationFrame(() => {
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
  vigilarMarcoJuego(() => { if (!c.hidden) ajustarMarco(); });
}
