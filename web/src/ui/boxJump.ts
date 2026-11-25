import {
  ANCHO, ETAPAS, METROS_POR_PISO, RADIO, UNIDADES_POR_METRO, avanzar, metros, nuevoSalto, piso, type Cajon, type Salto,
} from "../boxJump";
import { conPartida, htmlLista, type ApiJuego, type EnvioPartida, type TablaDiscos } from "./juegoDiscos";
import { ruido } from "./gimnasioFondo";
import { escapar } from "./tarjetaDia";
import { marcasDe, pintarEtiqueta, pintarLinea } from "./marcasRecords";

/**
 * La pantalla de Box Jump (lógica en `../boxJump.ts`), del Arcade. Como los otros juegos: toda la
 * pestaña es el juego, vive en su propio contenedor (`#boxjump`) fuera del repintado, el
 * resultado y el récord salen al instante, guardar va por detrás, y tiene sus Records
 * (`guardarPartidaBoxJump` y `tablaBoxJump` en functions).
 *
 * Se sube el edificio OSFIT: cada piso es una zona del gimnasio (las de Kettlebell Bird), con su
 * pared, sus ventanales (la ciudad se ve cada vez más abajo) y su decoración; una losa con su
 * nombre marca cada piso. La clienta es un círculo con su inicial que rebota sobre cajones.
 */

type Estado = "inicio" | "jugando" | "pausa" | "fin";
type Guardado = "nada" | "error";

interface Particula { x: number; h: number; vx: number; vh: number; vida: number; color: string; r: number }
interface Pedazo { cajon: Cajon; lado: -1 | 1; dx: number; dh: number; vh: number; giro: number }
interface Letrero { texto: string; x: number; h: number; vida: number }

let caja: HTMLElement | null = null;
let api: ApiJuego | null = null;
let estado: Estado = "inicio";
let salto: Salto = nuevoSalto(180);
let inicio = 0;
let duracion = 0;
let objetivo: number | null = null;
let teclas = 0;
let particulas: Particula[] = [];
let pedazos: Pedazo[] = [];
let letreros: Letrero[] = [];
/** Aplastado al rebotar (1 = redondo). */
let aplaste = 1;
let sacudida = 0;
let destello = 0;
let cuadro = 0;
let ultimo = 0;
let reloj = 0;
let pisoVisto = 1;
let anuncio: { piso: number; zona: string; vida: number } | null = null;
let tabla: TablaDiscos | null = null;
let errorTabla = false;
let guardado: Guardado = "nada";
let record = false;
let hoja = false;
let idPartida = 0;
let pendientes: { envio: EnvioPartida; id: number }[] = [];
let porConfirmar = 0;

// Solo en desarrollo (Vite lo quita del build): deja leer la partida para grabar demos.
if (import.meta.env?.DEV) (globalThis as { __boxJump?: () => { salto: Salto; estado: Estado; apuntar: (x: number | null) => void } }).__boxJump = () => ({ salto, estado, apuntar: (x) => { objetivo = x; } });

const LLAVE_TABLA = "osfit:boxjump-tabla";
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

export function htmlBoxJump(): string {
  return `
    <div class="jd-pantalla bj-pantalla" id="bj-pantalla">
      <canvas id="bj-canvas" aria-label="Box Jump"></canvas>
      <div class="jd-hud" aria-live="polite">
        <p class="jd-hud-puntos" id="bj-puntos">0 m</p>
        <p class="jd-hud-record">Récord <b id="bj-record">—</b></p>
        <p class="jd-hud-nivel" id="bj-piso"></p>
      </div>
      <div class="jd-capa" id="bj-capa"></div>
      <section class="jd-hoja" id="bj-hoja" hidden aria-label="Records">
        <div class="jd-hoja-cabeza">
          <p class="jd-hoja-titulo">Records</p>
          <button type="button" class="jd-cerrar" data-bj="cerrar-hoja" aria-label="Cerrar">✕</button>
        </div>
        <p class="jd-hoja-tuyo" id="bj-tuyo"></p>
        <ol class="jd-lista" id="bj-lista"></ol>
        <button type="button" class="jd-boton" data-bj="jugar">Jugar</button>
      </section>
    </div>`;
}

export function htmlCapaBoxJump(e: Estado, puntos: number, g: Guardado, nuevoRecord: boolean, pisoAlcanzado = 1): string {
  if (e === "jugando") return "";
  if (e === "pausa") {
    return `<div class="jd-capa-caja"><p class="jd-capa-titulo">Pausa</p>
      <button type="button" class="jd-boton" data-bj="seguir">Seguir</button></div>`;
  }
  if (e === "inicio") {
    return `
      <div class="jd-capa-caja">
        <p class="jd-capa-marca">OSFIT · Arcade</p>
        <p class="jd-capa-titulo">Box Jump</p>
        <p class="jd-capa-texto">Rebotas sola sobre las plataformas: arrastra el dedo hacia donde quieres ir y sube de la Tierra al cielo, al espacio, a la Luna, a Marte… Cada metro es un punto. Cuidado con las que se rompen; los trampolines te dan un súper salto.</p>
        <button type="button" class="jd-boton" data-bj="jugar">Jugar</button>
        <button type="button" class="jd-boton secundario" data-bj="marcador">Ver marcador</button>
      </div>`;
  }
  const nota = g === "error"
    ? `<p class="jd-capa-nota error">No se pudo guardar tu puntuación. <button type="button" class="jd-enlace" data-bj="reintentar-guardar">Intentar de nuevo</button></p>`
    : "";
  return `
    <div class="jd-capa-caja fin">
      ${nuevoRecord ? `<p class="jd-capa-record">¡Nuevo récord!</p>` : `<p class="jd-capa-marca">¡Te caíste!</p>`}
      <p class="jd-capa-puntos">${puntos} m</p>
      <p class="jd-capa-texto">${puntos === 1 ? "metro subido" : "metros subidos"} · Nivel ${pisoAlcanzado}, ${escapar(ETAPAS[pisoAlcanzado - 1] ?? "")}</p>
      ${nota}
      <button type="button" class="jd-boton" data-bj="jugar">Reintentar</button>
      <button type="button" class="jd-boton secundario" data-bj="marcador">Ver marcador</button>
    </div>`;
}

function q<T extends HTMLElement>(s: string): T | null { return caja?.querySelector<T>(s) ?? null; }

function actualizar(): void {
  if (!caja) return;
  const m = metros(salto);
  const puntos = q("#bj-puntos");
  const texto = `${m} m`;
  if (puntos && puntos.textContent !== texto) {
    puntos.textContent = texto;
    if (m % 10 === 0 && m > 0) { puntos.classList.remove("pop"); void puntos.offsetWidth; puntos.classList.add("pop"); }
  }
  const rec = q("#bj-record"); if (rec) rec.textContent = tabla && tabla.tuMejor > 0 ? `${tabla.tuMejor} m` : "—";
  const pis = q("#bj-piso"); if (pis) pis.textContent = `Nivel ${pisoVisto} · ${ETAPAS[pisoVisto - 1]}`;
  q("#bj-pantalla")?.classList.toggle("en-juego", estado === "jugando");
  const capa = q("#bj-capa");
  if (capa) {
    const html = htmlCapaBoxJump(estado, m, guardado, record, piso(m));
    if (capa.dataset.html !== html) { capa.innerHTML = html; capa.dataset.html = html; }
    capa.hidden = estado === "jugando" || hoja;
  }
  const h = q("#bj-hoja"); if (h) h.hidden = !hoja;
  const lista = q("#bj-lista"); if (lista) lista.innerHTML = htmlLista(tabla, errorTabla);
  const tuyo = q("#bj-tuyo");
  if (tuyo) {
    const mio = tabla?.filas.find((f) => f.esTuyo);
    tuyo.textContent = mio ? `Vas en el lugar #${mio.puesto} con ${mio.puntos} m.` : tabla ? "Juega una partida para entrar al marcador." : "";
  }
}

// ── Marcador (igual que los otros juegos: al instante, guardar por detrás) ────

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
  const m = metros(salto);
  if (m === 0 || !api) return;
  const envio: EnvioPartida = { puntos: m, apilados: m, duracionMs: Math.round(duracion) };
  porConfirmar = Math.max(porConfirmar, m);
  if (tabla) {
    const local = conPartida(tabla, m, api.nombre);
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

function vistaAlto(): number {
  const c = q<HTMLCanvasElement>("#bj-canvas");
  return c && c.clientWidth > 0 ? (c.clientHeight / c.clientWidth) * ANCHO : 180;
}

function jugar(): void {
  salto = nuevoSalto(vistaAlto());
  particulas = []; pedazos = []; letreros = []; sacudida = 0; destello = 0; aplaste = 1;
  pisoVisto = 1; anuncio = null;
  objetivo = null;
  guardado = "nada"; record = false; hoja = false;
  estado = "jugando";
  inicio = performance.now();
  duracion = 0;
  actualizar();
}

function polvo(x: number, h: number, color: string, n: number, fuerza: number): void {
  for (let k = 0; k < n; k++) {
    const a = Math.PI * (0.1 + Math.random() * 0.8);
    particulas.push({ x, h, vx: Math.cos(a) * fuerza * (Math.random() < 0.5 ? -1 : 1), vh: Math.sin(a) * fuerza * 0.6, vida: 0.5 + Math.random() * 0.3, color, r: 0.8 + Math.random() * 1.2 });
  }
}

function ciclo(ahora: number): void {
  const dt = Math.min(0.04, (ahora - ultimo) / 1000);
  ultimo = ahora;
  reloj += dt;
  if (estado === "jugando") {
    const apunta = teclas !== 0 ? salto.x + teclas * 30 : objetivo;
    const ev = avanzar(salto, dt, apunta);
    if (ev === "rebote" || ev === "trampolin" || ev === "espuma") {
      aplaste = ev === "trampolin" ? 0.55 : 0.72;
      polvo(salto.x, salto.h, "rgba(230, 220, 200, 0.7)", ev === "trampolin" ? 14 : 6, ev === "trampolin" ? 40 : 22);
      if (ev === "trampolin") { letreros.push({ texto: "¡SÚPER SALTO!", x: salto.x, h: salto.h + 8, vida: 1 }); navigator.vibrate?.(20); }
      if (ev === "espuma") {
        const c = salto.cajones.find((x) => x.roto && Math.abs(x.h - salto.h) < 1);
        if (c) { pedazos.push({ cajon: { ...c }, lado: -1, dx: 0, dh: 0, vh: 10, giro: 0 }, { cajon: { ...c }, lado: 1, dx: 0, dh: 0, vh: 10, giro: 0 }); c.ancho = 0; }
        polvo(salto.x, salto.h, "rgba(255, 120, 140, 0.8)", 10, 30);
      }
    }
    const p = piso(metros(salto));
    if (p > pisoVisto) {
      pisoVisto = p;
      anuncio = { piso: p, zona: ETAPAS[p - 1]!, vida: 2.2 };
      destello = 0.4;
      navigator.vibrate?.(25);
    }
    if (ev === "fin") {
      duracion = performance.now() - inicio;
      estado = "fin";
      sacudida = 0.8;
      navigator.vibrate?.([40, 30, 60]);
      actualizar();
      terminarPartida();
    } else actualizar();
  } else if (estado === "inicio") {
    // En la portada rebota sola sobre su primer cajón.
    avanzar(salto, dt, ANCHO / 2);
    salto.camara = -20;
  }
  aplaste += (1 - aplaste) * Math.min(1, dt * 9);
  for (const pt of particulas) { pt.vida -= dt; pt.x += pt.vx * dt; pt.h += pt.vh * dt; pt.vh -= 80 * dt; }
  particulas = particulas.filter((pt) => pt.vida > 0);
  for (const pz of pedazos) { pz.dx += pz.lado * 16 * dt; pz.vh -= 160 * dt; pz.dh += pz.vh * dt; pz.giro += pz.lado * 2.5 * dt; }
  pedazos = pedazos.filter((pz) => pz.cajon.h + pz.dh > salto.camara - 30);
  for (const l of letreros) { l.vida -= dt * 0.9; l.h += 10 * dt; }
  letreros = letreros.filter((l) => l.vida > 0);
  sacudida = Math.max(0, sacudida - dt * 2.5);
  destello = Math.max(0, destello - dt * 4);
  if (anuncio) anuncio.vida -= dt;
  dibujar(dt);
  cuadro = requestAnimationFrame(ciclo);
}

function arrancar(): void {
  cancelAnimationFrame(cuadro);
  ultimo = performance.now();
  cuadro = requestAnimationFrame(ciclo);
}

// ── Dibujo ───────────────────────────────────────────────────────────────────

const mod = (a: number, b: number) => ((a % b) + b) % b;

function redondeado(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
}

// TEMPORAL: selectores para comparar las propuestas de plataforma y de avatar.
function opcion(llave: string): "a" | "b" | "c" {
  try { const v = globalThis.localStorage?.getItem(llave); return v === "b" || v === "c" ? v : "a"; } catch { return "a"; }
}

/**
 * El viaje (entrenador, 2026-11-25): minimalista, colores planos. El cielo cambia poco a poco
 * con la altura: de la Tierra al cielo, la estratósfera, el espacio, la Luna, Marte, Júpiter y
 * la galaxia. Cada etapa tiene su color de arriba y de abajo; entre una y otra se mezclan.
 */
const CIELOS: readonly [string, string][] = [
  ["#7cc7f7", "#d8f1ff"], // Tierra
  ["#4fa6ee", "#b5dfff"], // Cielo
  ["#1f4fa3", "#5d97dc"], // Estratósfera
  ["#070b26", "#152056"], // Espacio
  ["#05061a", "#10132f"], // Luna
  ["#140812", "#341319"], // Marte
  ["#0c0915", "#2a1d14"], // Júpiter
  ["#08041a", "#2a0b3c"], // Galaxia
];

function mezclarColor(a: string, b: string, f: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const m = (s: number) => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f);
  return `rgb(${m(16)}, ${m(8)}, ${m(0)})`;
}

/** En qué etapa va la cámara (0…7, con fracción): cambia en los últimos metros de cada nivel. */
function etapaDe(cam: number): number {
  const porNivel = METROS_POR_PISO * UNIDADES_POR_METRO;
  const n = Math.max(0, cam + 60) / porNivel;
  const i = Math.floor(n), f = n - i;
  // El cambio de color ocurre en el último 35 % de cada nivel.
  return Math.min(CIELOS.length - 1, i + Math.max(0, (f - 0.65) / 0.35));
}

const estrellas: { x: number; y: number; r: number; fase: number }[] = [];

function pintarViaje(c: CanvasRenderingContext2D, W: number, H: number, e: number, cam: number, t: number): void {
  const etapa = etapaDe(cam);
  const i = Math.floor(etapa), f = etapa - i;
  const j = Math.min(CIELOS.length - 1, i + 1);
  const arriba = mezclarColor(CIELOS[i]![0], CIELOS[j]![0], f);
  const abajo = mezclarColor(CIELOS[i]![1], CIELOS[j]![1], f);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, arriba); g.addColorStop(1, abajo);
  c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);

  // Estrellas: aparecen desde la estratósfera.
  const brilloEstrellas = Math.max(0, Math.min(1, etapa - 2.2));
  if (brilloEstrellas > 0) {
    if (estrellas.length === 0) for (let k = 0; k < 90; k++) estrellas.push({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.4, fase: Math.random() * 6 });
    for (const s of estrellas) {
      const y = mod(s.y * H + cam * 0.06 * e, H);
      c.fillStyle = `rgba(255, 255, 255, ${brilloEstrellas * (0.45 + 0.4 * Math.sin(t * 2 + s.fase))})`;
      c.beginPath(); c.arc(s.x * W, y, s.r, 0, Math.PI * 2); c.fill();
    }
  }

  const porNivel = METROS_POR_PISO * UNIDADES_POR_METRO;
  // El sol en el cielo, y la curva azul de la Tierra en la estratósfera.
  if (etapa < 2.6) {
    const a = Math.max(0, 1 - Math.max(0, etapa - 1.6));
    c.fillStyle = `rgba(255, 236, 170, ${0.9 * a})`;
    c.beginPath(); c.arc(W * 0.78, H * 0.18 + cam * 0.05 * e, 9 * e, 0, Math.PI * 2); c.fill();
    c.fillStyle = `rgba(255, 236, 170, ${0.18 * a})`;
    c.beginPath(); c.arc(W * 0.78, H * 0.18 + cam * 0.05 * e, 15 * e, 0, Math.PI * 2); c.fill();
  }
  if (etapa > 1.6 && etapa < 4.2) {
    const a = Math.min(1, etapa - 1.6) * Math.max(0, Math.min(1, 4.2 - etapa));
    const cy = H + W * 1.2 - (etapa - 1.6) * 40 * e * 0.2;
    c.fillStyle = `rgba(90, 170, 255, ${0.35 * a})`;
    c.beginPath(); c.arc(W / 2, cy + H * 0.2, W * 1.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = `rgba(30, 90, 170, ${0.8 * a})`;
    c.beginPath(); c.arc(W / 2, cy + H * 0.23, W * 1.4, 0, Math.PI * 2); c.fill();
  }

  // Nubes planas: en la Tierra y el cielo; se quedan abajo al llegar al espacio.
  if (etapa < 3.2) {
    const a = Math.max(0, Math.min(1, 3.2 - etapa));
    const paso = 70 * e;
    for (let k = Math.floor((-cam * 0.5 * e) / paso) - 2; ; k++) {
      const y = H - (k * paso + cam * 0.5 * e) - 30 * e;
      if (y < -paso) break;
      if (y > H + paso || k < 0) continue;
      const x = ruido(k * 3.1) * W, w = (18 + ruido(k) * 20) * e;
      c.fillStyle = `rgba(255, 255, 255, ${0.75 * a})`;
      redondeado(c, x - w / 2, y, w, 6 * e, 3 * e); c.fill();
      redondeado(c, x - w / 4, y - 3.5 * e, w / 2, 6 * e, 3 * e); c.fill();
    }
  }

  // Los astros de cada etapa: pasan despacio mientras se sube.
  const astro = (nivel: number, dibujar: (x: number, y: number, r: number) => void, lado: number, radio: number) => {
    const centro = (nivel - 1 + 0.55) * porNivel;
    const y = H * 0.4 + (cam - centro) * e * 0.45;
    if (y < -radio * 2 || y > H + radio * 2) return;
    dibujar(W * lado, y, radio);
  };
  astro(5, (x, y, r) => {
    c.fillStyle = "#e6e8ef"; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(160, 165, 180, 0.6)";
    for (const [dx, dy, rr] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.24], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.1], [-0.45, 0.25, 0.09]] as const) { c.beginPath(); c.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = "rgba(5, 6, 26, 0.35)"; c.beginPath(); c.arc(x + r * 0.35, y - r * 0.1, r, 0, Math.PI * 2); c.fill();
  }, 0.72, 34 * e);
  astro(6, (x, y, r) => {
    const gm = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gm.addColorStop(0, "#ff9a63"); gm.addColorStop(0.7, "#c8452b"); gm.addColorStop(1, "#7a2316");
    c.fillStyle = gm; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(120, 30, 20, 0.45)";
    for (const [dx, dy, rr] of [[-0.2, 0.1, 0.2], [0.3, -0.3, 0.12], [0.1, 0.45, 0.14]] as const) { c.beginPath(); c.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = "rgba(255, 245, 240, 0.7)"; c.beginPath(); c.ellipse(x, y - r * 0.88, r * 0.32, r * 0.1, 0, 0, Math.PI * 2); c.fill();
  }, 0.28, 26 * e);
  astro(7, (x, y, r) => {
    c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    const franjas = ["#d9b38c", "#b8875c", "#e8cfae", "#a5704a", "#d9b38c", "#c98f62", "#ecd8bb"];
    franjas.forEach((col, k) => { c.fillStyle = col; c.fillRect(x - r, y - r + (k * 2 * r) / franjas.length, r * 2, (2 * r) / franjas.length + 1); });
    c.fillStyle = "#b5523a"; c.beginPath(); c.ellipse(x + r * 0.3, y + r * 0.25, r * 0.2, r * 0.11, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(0, 0, 0, 0.3)"; c.beginPath(); c.arc(x + r * 0.45, y, r, 0, Math.PI * 2); c.fill();
    c.restore();
  }, 0.7, 40 * e);
  astro(8, (x, y, r) => {
    for (const [dx, dy, rr, col] of [[0, 0, 1, "rgba(160, 60, 220, 0.28)"], [0.3, -0.2, 0.7, "rgba(255, 79, 216, 0.22)"], [-0.35, 0.25, 0.6, "rgba(126, 243, 255, 0.18)"]] as const) {
      const gn = c.createRadialGradient(x + dx * r, y + dy * r, 0, x + dx * r, y + dy * r, rr * r);
      gn.addColorStop(0, col); gn.addColorStop(1, "rgba(0, 0, 0, 0)");
      c.fillStyle = gn; c.beginPath(); c.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); c.fill();
    }
  }, 0.5, 60 * e);

  // La Tierra: pasto y la ciudad en silueta, abajo del todo al empezar.
  const suelo = H - (0 - cam) * e;
  if (suelo < H + 60 * e) {
    c.fillStyle = "#9bb9d6";
    for (let k = 0; k < 9; k++) {
      const bw = W / 9, bh = (14 + ruido(k * 5) * 22) * e;
      c.fillRect(k * bw + 1, suelo - bh, bw - 2, bh);
    }
    c.fillStyle = "#5fbf6a"; c.fillRect(-10, suelo, W + 20, H);
    c.fillStyle = "#4aa457"; c.fillRect(-10, suelo, W + 20, 2.5 * e);
  }
}

// ── Plataformas ──────────────────────────────────────────────────────────────

const GROSOR = 4.5;

/** A · Una barra olímpica acostada: la barra cromada y un disco en cada punta. */
function plataformaBarra(c: CanvasRenderingContext2D, cj: Cajon, x: number, y: number, w: number, e: number): void {
  const color = cj.tipo === "movil" ? "#2a6fd6" : cj.tipo === "espuma" ? "#ff7ab6" : "#d6372c";
  const bar = c.createLinearGradient(0, y, 0, y + 1.6 * e);
  bar.addColorStop(0, "#f4f6f8"); bar.addColorStop(0.5, "#9aa0a8"); bar.addColorStop(1, "#5d626a");
  c.fillStyle = bar; c.fillRect(x, y, w, 1.6 * e);
  for (const px of [x - 1.2 * e, x + w - 1.8 * e]) {
    c.fillStyle = color; redondeado(c, px, y - 3.2 * e, 3 * e, 8 * e, 1.2 * e); c.fill();
    c.fillStyle = "rgba(255, 255, 255, 0.25)"; c.fillRect(px + 0.5 * e, y - 3 * e, 0.6 * e, 7.6 * e);
  }
  if (cj.tipo === "espuma") { c.fillStyle = "rgba(255, 255, 255, 0.7)"; c.fillRect(x + w * 0.45, y - 0.2 * e, 1, 2 * e); }
}

/** B · Un step aeróbico: plano, con su borde de color y sus patitas de goma. */
function plataformaStep(c: CanvasRenderingContext2D, cj: Cajon, x: number, y: number, w: number, e: number): void {
  const borde = cj.tipo === "movil" ? "#ffb703" : cj.tipo === "espuma" ? "#ff7ab6" : "#3b8fff";
  c.fillStyle = "#1a1a1f";
  c.fillRect(x + w * 0.1, y + GROSOR * e - 0.5, w * 0.12, 1.6 * e); c.fillRect(x + w * 0.78, y + GROSOR * e - 0.5, w * 0.12, 1.6 * e);
  c.fillStyle = borde; redondeado(c, x, y + 1, w, GROSOR * e - 1, 1.8 * e); c.fill();
  c.fillStyle = "#f4f4f7"; redondeado(c, x, y, w, 2 * e, 1 * e); c.fill();
  c.strokeStyle = "rgba(0, 0, 0, 0.08)"; c.lineWidth = 1;
  for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(x + (w * k) / 6, y + 0.4 * e); c.lineTo(x + (w * k) / 6, y + 1.6 * e); c.stroke(); }
  if (cj.tipo === "espuma") { c.strokeStyle = "rgba(120, 20, 60, 0.6)"; c.beginPath(); c.moveTo(x + w * 0.5, y); c.lineTo(x + w * 0.46, y + GROSOR * e * 0.5); c.lineTo(x + w * 0.53, y + GROSOR * e); c.stroke(); }
}

/** C · Temática según la altura: tablón en la Tierra, nube en el cielo, asteroide en el espacio. */
function plataformaTematica(c: CanvasRenderingContext2D, cj: Cajon, x: number, y: number, w: number, e: number, etapa: number): void {
  if (etapa < 1.5) {
    c.fillStyle = cj.tipo === "espuma" ? "#c9a06a" : "#8a5a32"; redondeado(c, x, y, w, GROSOR * e, 1 * e); c.fill();
    c.fillStyle = "#5fbf6a"; redondeado(c, x - 0.5 * e, y - 0.6 * e, w + 1 * e, 2 * e, 1 * e); c.fill();
  } else if (etapa < 3.5) {
    c.fillStyle = cj.tipo === "espuma" ? "rgba(255, 255, 255, 0.55)" : "#ffffff";
    redondeado(c, x, y, w, GROSOR * e, GROSOR * e * 0.5); c.fill();
    c.beginPath(); c.arc(x + w * 0.35, y, GROSOR * e * 0.7, 0, Math.PI * 2); c.arc(x + w * 0.62, y + 0.3 * e, GROSOR * e * 0.55, 0, Math.PI * 2); c.fill();
  } else {
    const roja = etapa >= 5 && etapa < 6;
    c.fillStyle = cj.tipo === "espuma" ? (roja ? "#e08a6a" : "#9a9aa8") : roja ? "#b44a2e" : "#6c6a78";
    c.beginPath();
    c.moveTo(x, y + GROSOR * e * 0.4); c.lineTo(x + w * 0.15, y); c.lineTo(x + w * 0.85, y); c.lineTo(x + w, y + GROSOR * e * 0.5);
    c.lineTo(x + w * 0.8, y + GROSOR * e * 1.2); c.lineTo(x + w * 0.2, y + GROSOR * e * 1.1); c.closePath(); c.fill();
    c.fillStyle = "rgba(0, 0, 0, 0.25)";
    c.beginPath(); c.arc(x + w * 0.35, y + GROSOR * e * 0.5, 1.2 * e, 0, Math.PI * 2); c.arc(x + w * 0.65, y + GROSOR * e * 0.7, 0.8 * e, 0, Math.PI * 2); c.fill();
  }
  if (cj.tipo === "movil") { c.fillStyle = "rgba(126, 243, 255, 0.9)"; c.fillRect(x + w * 0.2, y + GROSOR * e + 1, w * 0.6, 1.2); }
}

function pintarPlataforma(c: CanvasRenderingContext2D, cj: Cajon, x: number, y: number, w: number, e: number, t: number, etapa: number): void {
  const v = opcion("osfit:bj-plataforma");
  if (v === "b") plataformaStep(c, cj, x, y, w, e);
  else if (v === "c") plataformaTematica(c, cj, x, y, w, e, etapa);
  else plataformaBarra(c, cj, x, y, w, e);
  if (cj.trampolin) pintarTrampolin(c, x + w / 2, y, Math.min(w * 0.38, 8 * e), e, t);
}

function pintarTrampolin(c: CanvasRenderingContext2D, cx: number, y: number, r: number, e: number, t: number): void {
  const ry = r * 0.28, alto = 2.6 * e;
  c.strokeStyle = "#9aa0a8"; c.lineWidth = Math.max(1.5, e * 0.4);
  for (const dx of [-0.8, 0.8]) { c.beginPath(); c.moveTo(cx + dx * r, y - alto); c.lineTo(cx + dx * r * 1.05, y); c.stroke(); }
  c.fillStyle = "#14151a"; c.beginPath(); c.ellipse(cx, y - alto, r * 0.86, ry * 0.86 * (1 + Math.sin(t * 8) * 0.04), 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#ffb703"; c.lineWidth = Math.max(2, e * 0.6); c.beginPath(); c.ellipse(cx, y - alto, r, ry, 0, 0, Math.PI * 2); c.stroke();
}

// ── Avatares ─────────────────────────────────────────────────────────────────

/** A · Astronauta OSFIT: traje blanco, casco con visor que refleja y su inicial en el pecho. */
function avatarAstronauta(c: CanvasRenderingContext2D, r: number, inicial: string, subiendo: boolean): void {
  const pies = subiendo ? r * 0.1 : r * 0.3;
  c.fillStyle = "#d9dde3";
  for (const lado of [-1, 1]) { redondeado(c, lado * r * 0.42 - r * 0.22, r * 0.75 + pies, r * 0.44, r * 0.34, r * 0.12); c.fill(); }
  c.fillStyle = "#c4cad2"; redondeado(c, -r * 0.95, -r * 0.2, r * 0.4, r * 0.8, r * 0.15); c.fill(); // mochila
  const traje = c.createRadialGradient(-r * 0.3, -r * 0.2, r * 0.1, 0, r * 0.2, r * 1.1);
  traje.addColorStop(0, "#ffffff"); traje.addColorStop(1, "#c9ced6");
  c.fillStyle = traje; redondeado(c, -r * 0.75, -r * 0.05, r * 1.5, r * 1.0, r * 0.4); c.fill();
  c.fillStyle = "#ff3bd4"; c.beginPath(); c.arc(0, r * 0.45, r * 0.24, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#fff"; c.font = `900 ${Math.round(r * 0.34)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(inicial, 0, r * 0.47);
  // Casco y visor.
  c.fillStyle = "#f4f6f9"; c.beginPath(); c.arc(0, -r * 0.35, r * 0.72, 0, Math.PI * 2); c.fill();
  const visor = c.createLinearGradient(-r * 0.5, -r * 0.7, r * 0.5, 0);
  visor.addColorStop(0, "#1b2a55"); visor.addColorStop(0.6, "#3b6fd6"); visor.addColorStop(1, "#ffb703");
  c.fillStyle = visor; redondeado(c, -r * 0.5, -r * 0.7, r * 1.0, r * 0.62, r * 0.28); c.fill();
  c.fillStyle = "rgba(255, 255, 255, 0.55)"; c.beginPath(); c.ellipse(-r * 0.22, -r * 0.55, r * 0.14, r * 0.07, -0.5, 0, Math.PI * 2); c.fill();
}

/** B · La kettlebell del Arcade, ahora con piernitas y tenis. */
function avatarKettlebell(c: CanvasRenderingContext2D, r: number, _inicial: string, subiendo: boolean): void {
  const pies = subiendo ? r * 0.05 : r * 0.35;
  c.strokeStyle = "#2a2c31"; c.lineWidth = r * 0.14;
  for (const lado of [-1, 1]) { c.beginPath(); c.moveTo(lado * r * 0.35, r * 0.7); c.lineTo(lado * r * 0.4, r * 0.95 + pies); c.stroke(); }
  for (const lado of [-1, 1]) { c.fillStyle = "#f2f2f2"; redondeado(c, lado * r * 0.4 - r * 0.2 + lado * r * 0.08, r * 0.92 + pies, r * 0.44, r * 0.24, r * 0.1); c.fill(); }
  c.strokeStyle = "#2a2c31"; c.lineWidth = r * 0.28;
  c.beginPath(); c.arc(0, -r * 0.7, r * 0.55, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  const g = c.createRadialGradient(-r * 0.35, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, "#6b6f78"); g.addColorStop(0.55, "#2a2c31"); g.addColorStop(1, "#0f1013");
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 0.85, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#fff"; for (const lado of [-1, 1]) { c.beginPath(); c.arc(lado * r * 0.25, -r * 0.1, r * 0.14, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = "#111"; for (const lado of [-1, 1]) { c.beginPath(); c.arc(lado * r * 0.25 + r * 0.03, -r * 0.07, r * 0.07, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = "#ffd45c"; c.font = `900 ${Math.round(r * 0.42)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("16", 0, r * 0.4);
}

/** C · Un balón medicinal con sus costuras, su banda y la inicial. */
function avatarBalon(c: CanvasRenderingContext2D, r: number, inicial: string, subiendo: boolean): void {
  const pies = subiendo ? r * 0.1 : r * 0.3;
  for (const lado of [-1, 1]) { c.fillStyle = "#f2f2f2"; redondeado(c, lado * r * 0.45 - r * 0.25, r * 0.85 + pies, r * 0.5, r * 0.26, r * 0.12); c.fill(); }
  const g = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#5a5f6b"); g.addColorStop(0.6, "#25272e"); g.addColorStop(1, "#111216");
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "rgba(255, 255, 255, 0.25)"; c.lineWidth = Math.max(1, r * 0.05);
  c.beginPath(); c.ellipse(0, 0, r * 0.45, r, 0, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke();
  c.fillStyle = "#3b8fff"; c.fillRect(-r * 0.95, -r * 0.5, r * 1.9, r * 0.22);
  c.fillStyle = "#fff"; c.font = `900 ${Math.round(r * 0.8)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(inicial, 0, r * 0.22);
}

function pintarAvatar(c: CanvasRenderingContext2D, x: number, y: number, r: number, inicial: string, subiendo: boolean): void {
  c.save();
  c.translate(x, y);
  c.scale(1 / Math.sqrt(aplaste), aplaste);
  const v = opcion("osfit:bj-avatar");
  if (v === "b") avatarKettlebell(c, r, inicial, subiendo);
  else if (v === "c") avatarBalon(c, r, inicial, subiendo);
  else avatarAstronauta(c, r, inicial, subiendo);
  c.restore();
}

function dibujar(_dt: number): void {
  const canvas = q<HTMLCanvasElement>("#bj-canvas");
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
  const e = W / ANCHO;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (sacudida > 0) c.translate((Math.random() - 0.5) * 10 * sacudida, (Math.random() - 0.5) * 8 * sacudida);
  const cam = salto.camara;
  const sy = (h: number) => H - (h - cam) * e;
  pintarViaje(c, W, H, e, cam, reloj);
  const etapa = etapaDe(cam);
  const oscuro = etapa > 2.6;

  // Marcas de metros, discretas.
  for (let m = Math.ceil(cam / UNIDADES_POR_METRO / 10) * 10; m * UNIDADES_POR_METRO < cam + H / e + 20; m += 10) {
    if (m <= 0) continue;
    const y = sy(m * UNIDADES_POR_METRO);
    c.fillStyle = oscuro ? "rgba(255, 255, 255, 0.35)" : "rgba(20, 40, 80, 0.35)";
    c.font = "700 11px system-ui, sans-serif"; c.textAlign = "left";
    c.fillText(`${m} m`, 6, y - 4);
    c.fillRect(0, y, 10, 1);
  }
  // Dónde quedaron los records: una línea a esa altura, con su banderita y su nombre.
  for (const m of marcasDe(tabla)) {
    const y = sy(m.puntos * UNIDADES_POR_METRO);
    if (y < -20 || y > H + 20) continue;
    const superada = metros(salto) > m.puntos;
    pintarLinea(c, m, 0, W, y, superada);
    c.strokeStyle = "#c9cdd3"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(W - 10, y); c.lineTo(W - 10, y - 26); c.stroke();
    c.fillStyle = m.tuya ? "#ffd45c" : "#ff4fd8";
    c.beginPath(); c.moveTo(W - 10, y - 26); c.lineTo(W - 24, y - 21); c.lineTo(W - 10, y - 16); c.fill();
    pintarEtiqueta(c, m, " m", W - 28, y - 12, "der", superada);
  }

  for (const cj of salto.cajones) {
    if (cj.ancho <= 0) continue;
    const y = sy(cj.h);
    if (y < -40 || y > H + 40) continue;
    pintarPlataforma(c, cj, cj.x * e, y, cj.ancho * e, e, reloj, etapa);
  }
  for (const pz of pedazos) {
    const w = (pz.cajon.ancho / 2) * e;
    const x = (pz.cajon.x + (pz.lado > 0 ? pz.cajon.ancho / 2 : 0) + pz.dx) * e;
    const y = sy(pz.cajon.h + pz.dh);
    c.save(); c.translate(x + w / 2, y); c.rotate(pz.giro); c.globalAlpha = 0.85;
    pintarPlataforma(c, { ...pz.cajon, ancho: pz.cajon.ancho / 2, trampolin: false }, -w / 2, 0, w, e, reloj, etapa);
    c.restore();
  }
  for (const pt of particulas) {
    c.fillStyle = pt.color; c.globalAlpha = Math.max(0, Math.min(1, pt.vida * 2));
    c.beginPath(); c.arc(pt.x * e, sy(pt.h), pt.r * e * 0.5, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // La clienta (y su copia del otro lado cuando cruza la orilla).
  const inicial = (api?.nombre.trim().charAt(0) || "O").toUpperCase();
  const r = RADIO * e;
  const y = sy(salto.h) - r * 0.9;
  for (const dx of [0, -ANCHO, ANCHO]) {
    const x = (salto.x + dx) * e;
    if (x < -r * 2 || x > W + r * 2) continue;
    pintarAvatar(c, x, y, r, inicial, salto.vh > 0);
  }
  c.textAlign = "center";
  for (const l of letreros) {
    c.save(); c.font = `900 ${Math.round(5 * e)}px system-ui, sans-serif`; c.fillStyle = `rgba(255, 212, 92, ${Math.max(0, l.vida)})`;
    c.shadowColor = "#ff3bd4"; c.shadowBlur = 10; c.fillText(l.texto, Math.min(W - 60, Math.max(60, l.x * e)), sy(l.h)); c.restore();
  }
  if (anuncio && anuncio.vida > 0) {
    const a = Math.min(1, anuncio.vida * 1.5), s2 = 1 + Math.max(0, anuncio.vida - 1.6) * 1.2;
    c.save(); c.translate(W / 2, H * 0.34); c.scale(s2, s2);
    c.textAlign = "center"; c.textBaseline = "middle";
    c.shadowColor = "#ff3bd4"; c.shadowBlur = 18; c.fillStyle = `rgba(255, 255, 255, ${a})`;
    c.font = `900 ${Math.round(11 * e)}px system-ui, sans-serif`; c.fillText(`NIVEL ${anuncio.piso}`, 0, 0);
    c.shadowColor = "#7ef3ff"; c.shadowBlur = 10; c.fillStyle = `rgba(126, 243, 255, ${a})`;
    c.font = `800 ${Math.round(4.4 * e)}px ui-monospace, "SF Mono", Menlo, monospace`; c.fillText(anuncio.zona.toUpperCase(), 0, 9 * e);
    c.restore();
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (destello > 0) { c.fillStyle = `rgba(255, 255, 255, ${destello * 0.5})`; c.fillRect(0, 0, W, H); }
}

// ── Montaje ──────────────────────────────────────────────────────────────────

function ajustarMarco(): void {
  const pantalla = q("#bj-pantalla");
  if (!pantalla) return;
  const cab = document.querySelector<HTMLElement>(".cabecera");
  const barra = [...document.querySelectorAll<HTMLElement>("#barra, #barra > *")].find((b) => b.offsetHeight > 0) ?? null;
  pantalla.style.top = `${cab ? Math.max(0, cab.getBoundingClientRect().bottom + 6) : 0}px`;
  pantalla.style.bottom = `${barra ? Math.max(0, window.innerHeight - barra.getBoundingClientRect().top) : 0}px`;
}

/** Muestra u oculta el juego. La primera vez arma su DOM; al salir a media partida la pausa. */
export function mostrarBoxJump(contenedor: HTMLElement, visible: boolean, conexion: ApiJuego): void {
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
    contenedor.innerHTML = htmlBoxJump();
    conectar(contenedor);
    tabla = tabla ?? tablaGuardada();
  }
  window.scrollTo(0, 0);
  ajustarMarco();
  requestAnimationFrame(() => {
    ajustarMarco();
    if (estado === "inicio") salto = nuevoSalto(vistaAlto());
  });
  actualizar();
  arrancar();
  void cargarTabla();
}

function conectar(c: HTMLElement): void {
  const pantalla = c.querySelector<HTMLElement>("#bj-pantalla");
  const aX = (ev: PointerEvent) => {
    const rect = pantalla!.getBoundingClientRect();
    return ((ev.clientX - rect.left) / rect.width) * ANCHO;
  };
  pantalla?.addEventListener("pointerdown", (ev) => {
    if ((ev.target as HTMLElement).closest("button, .jd-hoja")) return;
    if (estado !== "jugando") return;
    ev.preventDefault();
    try { pantalla.setPointerCapture(ev.pointerId); } catch { /* sin captura también sirve */ }
    objetivo = aX(ev);
  });
  pantalla?.addEventListener("pointermove", (ev) => { if (objetivo !== null && estado === "jugando") objetivo = aX(ev); });
  const soltar = () => { objetivo = null; };
  pantalla?.addEventListener("pointerup", soltar);
  pantalla?.addEventListener("pointercancel", soltar);
  c.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-bj]");
    if (!b) return;
    const que = b.dataset.bj;
    if (que === "jugar") jugar();
    if (que === "seguir") { estado = "jugando"; inicio = performance.now() - duracion; actualizar(); }
    if (que === "reintentar-guardar") reenviarPendientes();
    if (que === "marcador") { hoja = true; actualizar(); void cargarTabla(); }
    if (que === "cerrar-hoja") { hoja = false; actualizar(); }
  });
  document.addEventListener("keydown", (ev) => {
    if (c.hidden || estado !== "jugando") return;
    if (ev.key === "ArrowLeft") { teclas = -1; ev.preventDefault(); }
    if (ev.key === "ArrowRight") { teclas = 1; ev.preventDefault(); }
  });
  document.addEventListener("keyup", (ev) => { if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") teclas = 0; });
  window.addEventListener("resize", () => { if (!c.hidden) ajustarMarco(); });
}
