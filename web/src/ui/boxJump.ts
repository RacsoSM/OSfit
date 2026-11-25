import {
  ANCHO, ETAPAS, METROS_POR_PISO, RADIO, UNIDADES_POR_METRO, avanzar, metros, nuevoSalto, piso, type Cajon, type Salto,
} from "../boxJump";
import { conPartida, htmlLista, type ApiJuego, type EnvioPartida, type TablaDiscos } from "./juegoDiscos";
import { ruido } from "./gimnasioFondo";
import { escapar } from "./tarjetaDia";
import { ajustarMarcoJuego, pintarSeguro, prepararMarcoJuego, vigilarMarcoJuego } from "./marcoJuego";
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
      </div>
      <p class="jd-hud-nivel jd-nivel-abajo" id="bj-piso"></p>
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
        <p class="jd-capa-texto">Rebotas sola sobre las plataformas: arrastra el dedo hacia donde quieres ir y sube de la Tierra al cielo, al espacio, a la Luna, a Marte… Cada metro es un punto. Cuidado con las que se rompen; los resortes te dan un súper salto.</p>
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
  pisoVisto = 1;
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
      if (ev === "trampolin") {
        const resorte = salto.cajones.find((cj) => cj.trampolin && Math.abs(cj.h - salto.h) < 0.01);
        if (resorte) resortesUsados.set(resorte, reloj);
      }
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
      // Discreto, como en Kettlebell Bird: sin letrero en medio; brilla la línea del nivel abajo.
      actualizar();
      const pis = q("#bj-piso");
      if (pis) { pis.classList.remove("sube"); void pis.offsetWidth; pis.classList.add("sube"); }
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
  cuadro = requestAnimationFrame(ciclo);
  pintarSeguro(() => dibujar(dt));
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

/**
 * El viaje (entrenador, 2026-11-25): minimalista, colores planos. El cielo cambia poco a poco
 * con la altura: de la Tierra al cielo, la estratósfera, el espacio, la Luna, Marte, Júpiter y
 * la galaxia. Cada etapa tiene su color de arriba y de abajo; entre una y otra se mezclan.
 */
const CIELOS: readonly [string, string][] = [
  ["#3b2a6b", "#ff9e6b"], // Tierra: atardecer (entrenador, 2026-11-25)
  ["#24194f", "#c95f86"], // Cielo: anocheciendo
  ["#111439", "#55407f"], // Estratósfera
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

/** Las estrellas fugaces del fondo: cada pocos segundos cruza una, en diagonal, con su estela. */
const fugaces: { x: number; y: number; vx: number; vy: number; vida: number }[] = [];
let proximaFugaz = 1;
let relojFugaz = 0;

function pintarFugaces(c: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  const dt = Math.max(0, Math.min(0.05, t - relojFugaz));
  relojFugaz = t;
  proximaFugaz -= dt;
  if (proximaFugaz <= 0) {
    proximaFugaz = 1.4 + Math.random() * 2.6;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const v = (0.9 + Math.random() * 0.6) * W;
    fugaces.push({ x: W * (0.15 + Math.random() * 0.7), y: H * (0.05 + Math.random() * 0.4), vx: dir * v, vy: v * 0.45, vida: 0.7 });
  }
  for (let k = fugaces.length - 1; k >= 0; k--) {
    const f = fugaces[k]!;
    f.x += f.vx * dt; f.y += f.vy * dt; f.vida -= dt;
    if (f.vida <= 0) { fugaces.splice(k, 1); continue; }
    const a = Math.min(1, f.vida * 3);
    const cola = 0.13;
    const g = c.createLinearGradient(f.x, f.y, f.x - f.vx * cola, f.y - f.vy * cola);
    g.addColorStop(0, `rgba(255, 255, 255, ${0.95 * a})`); g.addColorStop(1, "rgba(255, 255, 255, 0)");
    c.strokeStyle = g; c.lineWidth = 2; c.lineCap = "round";
    c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x - f.vx * cola, f.y - f.vy * cola); c.stroke();
    c.lineCap = "butt";
    c.fillStyle = `rgba(255, 255, 255, ${a})`; c.beginPath(); c.arc(f.x, f.y, 1.6, 0, Math.PI * 2); c.fill();
  }
}

function pintarViaje(c: CanvasRenderingContext2D, W: number, H: number, e: number, cam: number, t: number): void {
  const etapa = etapaDe(cam);
  const i = Math.floor(etapa), f = etapa - i;
  const j = Math.min(CIELOS.length - 1, i + 1);
  const arriba = mezclarColor(CIELOS[i]![0], CIELOS[j]![0], f);
  const abajo = mezclarColor(CIELOS[i]![1], CIELOS[j]![1], f);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, arriba); g.addColorStop(1, abajo);
  c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);

  // Estrellas: tenues desde el atardecer, cada vez más al subir.
  const brilloEstrellas = Math.min(1, 0.35 + Math.max(0, etapa - 1) * 0.4);
  if (brilloEstrellas > 0) {
    if (estrellas.length === 0) for (let k = 0; k < 90; k++) estrellas.push({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.4, fase: Math.random() * 6 });
    for (const s of estrellas) {
      const y = mod(s.y * H + cam * 0.06 * e, H);
      // En la Tierra solo en lo alto del cielo: abajo todavía hay luz del sol.
      const luz = etapa < 1.5 ? Math.max(0, 1 - (y / H) * 1.4) : 1;
      if (luz <= 0) continue;
      c.globalAlpha = luz;
      c.fillStyle = `rgba(255, 255, 255, ${brilloEstrellas * (0.45 + 0.4 * Math.sin(t * 2 + s.fase))})`;
      c.beginPath(); c.arc(s.x * W, y, s.r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }
  pintarFugaces(c, W, H, t);

  const porNivel = METROS_POR_PISO * UNIDADES_POR_METRO;
  // El sol del atardecer: grande, naranja y bajo; se va quedando abajo al subir.
  if (etapa < 2.2) {
    const sy = H * 0.86 + cam * 0.09 * e, sr = 16 * e;
    if (sy - sr * 3 < H) {
      const halo = c.createRadialGradient(W * 0.3, sy, sr * 0.6, W * 0.3, sy, sr * 3.2);
      halo.addColorStop(0, "rgba(255, 170, 90, 0.55)"); halo.addColorStop(1, "rgba(255, 120, 90, 0)");
      c.fillStyle = halo; c.fillRect(0, sy - sr * 3.2, W, sr * 6.4);
      const disco = c.createLinearGradient(0, sy - sr, 0, sy + sr);
      disco.addColorStop(0, "#ffe08a"); disco.addColorStop(1, "#ff7a45");
      c.fillStyle = disco; c.beginPath(); c.arc(W * 0.3, sy, sr, 0, Math.PI * 2); c.fill();
    }
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
      c.fillStyle = `rgba(255, 190, 196, ${0.4 * a})`;
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
    for (let k = 0; k < 9; k++) {
      const bw = W / 9, bh = (14 + ruido(k * 5) * 22) * e;
      c.fillStyle = "#3a2550"; c.fillRect(k * bw + 1, suelo - bh, bw - 2, bh);
      c.fillStyle = "rgba(255, 214, 120, 0.8)";
      for (let v = 0; v < 6; v++) if (ruido(k * 13 + v) > 0.55) c.fillRect(k * bw + 3 + (v % 2) * (bw / 2 - 2), suelo - bh + 3 * e + Math.floor(v / 2) * 4 * e, 1.6 * e, 1.6 * e);
    }
    // El pasto del suelo: degradado, manchas de otro tono y briznas a lo largo de la orilla.
    const prado = c.createLinearGradient(0, suelo, 0, suelo + 40 * e);
    prado.addColorStop(0, "#5cb84a"); prado.addColorStop(1, "#2f7d34");
    c.fillStyle = prado; c.fillRect(-10, suelo, W + 20, H);
    for (let k = 0; k < 40; k++) {
      c.fillStyle = k % 2 ? "rgba(140, 215, 100, 0.25)" : "rgba(20, 70, 25, 0.22)";
      c.beginPath(); c.ellipse(ruido(k * 4.7) * W, suelo + (3 + ruido(k * 2.3) * 30) * e, (2 + ruido(k) * 4) * e, (0.6 + ruido(k * 1.9)) * e, 0, 0, Math.PI * 2); c.fill();
    }
    const briznas = Math.round(W / (0.5 * e));
    for (let k = 0; k < briznas; k++) {
      const px = (k / briznas) * W + ruido(k * 0.9) * 0.5 * e;
      const largo = (1.2 + ruido(k * 1.7) * 2.2) * e, incl = (ruido(k * 2.6) - 0.5) * 1.2 * e;
      c.strokeStyle = ["#3f9e3c", "#5cbf4a", "#8ad866", "#2e7f33"][k % 4]!; c.lineWidth = Math.max(0.8, 0.3 * e);
      c.beginPath(); c.moveTo(px, suelo + 0.6 * e); c.quadraticCurveTo(px + incl * 0.3, suelo - largo * 0.5, px + incl, suelo - largo); c.stroke();
    }
  }
}

// ── Plataformas ──────────────────────────────────────────────────────────────

const GROSOR = 4.5;

/**
 * Cada plataforma se pinta según SU altura, no según dónde va la cámara (entrenador,
 * 2026-11-25: "que cuando subas ya se vean las plataformas del nivel que sigue"): las del nivel
 * de arriba ya traen su forma mientras todavía se va en el de abajo.
 */
function nivelDePlataforma(h: number): number {
  return Math.max(0, Math.floor(h / (METROS_POR_PISO * UNIDADES_POR_METRO)));
}

/**
 * Nivel 1 · Tierra: un cojín de pasto con la orilla en ondas, tréboles y una flor (propuesta E,
 * elegida por el entrenador el 2026-11-25). La que se rompe va más pálida y con una grieta.
 */
function plataformaPasto(c: CanvasRenderingContext2D, cj: Cajon, x: number, y: number, w: number, e: number): void {
  pastoTreboles(c, cj, x, y, w, e);
  if (cj.tipo === "espuma") {
    c.strokeStyle = "rgba(30, 50, 20, 0.7)"; c.lineWidth = Math.max(1, 0.35 * e);
    c.beginPath(); c.moveTo(x + w * 0.5, y - 0.2 * e); c.lineTo(x + w * 0.45, y + GROSOR * e * 0.5); c.lineTo(x + w * 0.53, y + GROSOR * e * 0.9); c.stroke();
  }
}

function verdeCojin(c: CanvasRenderingContext2D, cj: Cajon, y: number, alto: number, claro: string, oscuro: string): CanvasGradient {
  const g = c.createLinearGradient(0, y, 0, y + alto);
  g.addColorStop(0, cj.tipo === "espuma" ? "#c4e6a3" : claro); g.addColorStop(1, cj.tipo === "espuma" ? "#93b877" : oscuro);
  return g;
}

function flor(c: CanvasRenderingContext2D, px: number, py: number, e: number, petalo: string, centro = "#ffcf3f", t = 1): void {
  c.fillStyle = petalo;
  for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; c.beginPath(); c.arc(px + Math.cos(a) * 0.45 * e * t, py + Math.sin(a) * 0.45 * e * t, 0.35 * e * t, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = centro; c.beginPath(); c.arc(px, py, 0.3 * e * t, 0, Math.PI * 2); c.fill();
}

/** El cojín con orilla de pasto: la pastilla con el borde de arriba en ondas, tréboles y una flor. */
function pastoTreboles(c: CanvasRenderingContext2D, cj: Cajon, x: number, y: number, w: number, e: number): void {
  const semilla = Math.round(cj.h * 7.3), alto = GROSOR * e;
  c.fillStyle = verdeCojin(c, cj, y, alto, "#4fb85a", "#25764a"); redondeado(c, x, y, w, alto, alto * 0.5); c.fill();
  // La orilla en ondas, un verde más claro que cuelga sobre el cojín.
  c.fillStyle = cj.tipo === "espuma" ? "#d6f0b8" : "#8ee06a";
  c.beginPath(); c.moveTo(x + alto * 0.3, y + 0.4 * e);
  const n = Math.max(4, Math.round(w / (1.8 * e)));
  for (let k = 0; k <= n; k++) {
    const px = x + alto * 0.3 + ((w - alto * 0.6) * k) / n;
    c.quadraticCurveTo(px - (w / n) * 0.5, y + 2.2 * e, px, y + 1.2 * e);
  }
  c.lineTo(x + w - alto * 0.3, y + 0.4 * e);
  c.closePath(); c.fill();
  redondeado(c, x + 0.2 * e, y - 0.3 * e, w - 0.4 * e, 1.6 * e, 0.8 * e); c.fill();
  // Tréboles.
  c.fillStyle = "#2f9c4a";
  for (let k = 0; k < Math.max(2, Math.round(w / (5 * e))); k++) {
    const px = x + w * (0.12 + ruido(semilla + k * 1.9) * 0.76), py = y - 0.2 * e;
    for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) { c.beginPath(); c.arc(px + Math.cos(a) * 0.38 * e, py + Math.sin(a) * 0.38 * e, 0.36 * e, 0, Math.PI * 2); c.fill(); }
  }
  flor(c, x + w * (0.2 + ruido(semilla) * 0.6), y - 0.5 * e, e, "#ffffff");
}

/** Niveles 2 y 3 · Cielo y estratósfera: una nube esponjada (la que se rompe, medio transparente). */
function plataformaNube(c: CanvasRenderingContext2D, cj: Cajon, x: number, y: number, w: number, e: number, nivel: number): void {
  const alto = GROSOR * e;
  c.fillStyle = cj.tipo === "espuma" ? "rgba(255, 255, 255, 0.5)" : nivel === 1 ? "#ffe9ee" : "#ece6ff";
  redondeado(c, x, y, w, alto, alto * 0.5); c.fill();
  c.beginPath(); c.arc(x + w * 0.35, y, alto * 0.7, 0, Math.PI * 2); c.arc(x + w * 0.62, y + 0.3 * e, alto * 0.55, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(120, 150, 200, 0.25)"; redondeado(c, x + w * 0.08, y + alto * 0.6, w * 0.84, alto * 0.4, alto * 0.2); c.fill();
}

/** Del espacio en adelante: una roca, del color de cada lugar (Luna gris, Marte roja, Júpiter ocre, galaxia violeta). */
const ROCAS: Record<number, [string, string]> = {
  3: ["#6c6a78", "#9a9aa8"], 4: ["#9a9ba6", "#c4c5ce"], 5: ["#b44a2e", "#e08a6a"], 6: ["#b5835a", "#ddb68e"], 7: ["#6b3fa0", "#b48ae0"],
};

function plataformaRoca(c: CanvasRenderingContext2D, cj: Cajon, x: number, y: number, w: number, e: number, nivel: number): void {
  const [firme, espuma] = ROCAS[Math.min(7, nivel)]!;
  c.fillStyle = cj.tipo === "espuma" ? espuma : firme;
  c.beginPath();
  c.moveTo(x, y + GROSOR * e * 0.4); c.lineTo(x + w * 0.15, y); c.lineTo(x + w * 0.85, y); c.lineTo(x + w, y + GROSOR * e * 0.5);
  c.lineTo(x + w * 0.8, y + GROSOR * e * 1.2); c.lineTo(x + w * 0.2, y + GROSOR * e * 1.1); c.closePath(); c.fill();
  c.fillStyle = "rgba(255, 255, 255, 0.18)"; c.fillRect(x + w * 0.15, y, w * 0.7, 0.6 * e);
  c.fillStyle = "rgba(0, 0, 0, 0.25)";
  c.beginPath(); c.arc(x + w * 0.35, y + GROSOR * e * 0.5, 1.2 * e, 0, Math.PI * 2); c.arc(x + w * 0.65, y + GROSOR * e * 0.7, 0.8 * e, 0, Math.PI * 2); c.fill();
  if (nivel >= 7) { c.shadowColor = "#ff4fd8"; c.shadowBlur = 8; c.strokeStyle = "rgba(255, 140, 240, 0.6)"; c.lineWidth = 1; c.stroke(); c.shadowBlur = 0; }
}

function pintarPlataforma(c: CanvasRenderingContext2D, cj: Cajon, x: number, y: number, w: number, e: number): void {
  const nivel = nivelDePlataforma(cj.h);
  if (nivel === 0) plataformaPasto(c, cj, x, y, w, e);
  else if (nivel <= 2) plataformaNube(c, cj, x, y, w, e, nivel);
  else plataformaRoca(c, cj, x, y, w, e, nivel);
  if (cj.tipo === "movil") { c.fillStyle = "rgba(126, 243, 255, 0.9)"; c.fillRect(x + w * 0.2, y + GROSOR * e + 1, w * 0.6, 1.2); }
  if (cj.trampolin) pintarResorte(c, cj, x + w / 2, y, e);
}

/** Cuándo se usó cada resorte, para que se estire y rebote al pisarlo. */
const resortesUsados = new WeakMap<Cajon, number>();

/**
 * El súper salto es un resorte (entrenador, 2026-11-25): una espiral de acero con su tapa roja.
 * Al pisarlo se estira de golpe y vibra un momento antes de volver a su lugar.
 */
function pintarResorte(c: CanvasRenderingContext2D, cj: Cajon, cx: number, y: number, e: number): void {
  const usado = resortesUsados.get(cj);
  const t = usado === undefined ? 99 : reloj - usado;
  const estirado = t < 1.2 ? 1 + 0.9 * Math.exp(-t * 4) * Math.cos(t * 22) : 1;
  const ancho = 3.6 * e, alto = 4.2 * e * Math.max(0.4, estirado), vueltas = 4;
  const base = y, tope = y - alto;
  // La base atornillada a la plataforma.
  c.fillStyle = "#3a3d44"; redondeado(c, cx - ancho * 0.7, base - 0.7 * e, ancho * 1.4, 0.9 * e, 0.3 * e); c.fill();
  // La espiral: cada vuelta es media elipse atrás (oscura) y media adelante (brillante).
  const paso = (alto - 1.1 * e) / vueltas, ry = 0.75 * e;
  c.lineCap = "round";
  for (let k = 0; k < vueltas; k++) {
    const cy = base - 0.7 * e - paso * (k + 0.5);
    c.strokeStyle = "#5b616b"; c.lineWidth = Math.max(1.4, 0.55 * e);
    c.beginPath(); c.ellipse(cx, cy, ancho * 0.5, ry, -0.12, Math.PI, Math.PI * 2); c.stroke();
    c.strokeStyle = "#eef1f5"; c.lineWidth = Math.max(1.6, 0.65 * e);
    c.beginPath(); c.ellipse(cx, cy, ancho * 0.5, ry, -0.12, 0, Math.PI); c.stroke();
    c.strokeStyle = "rgba(0, 0, 0, 0.25)"; c.lineWidth = Math.max(0.6, 0.2 * e);
    c.beginPath(); c.ellipse(cx, cy + 0.25 * e, ancho * 0.5, ry, -0.12, 0.3, Math.PI - 0.3); c.stroke();
  }
  c.lineCap = "butt";
  // La tapa roja donde se pisa.
  const tapa = c.createLinearGradient(0, tope - 1.2 * e, 0, tope);
  tapa.addColorStop(0, "#ff6b5c"); tapa.addColorStop(1, "#b8261a");
  c.fillStyle = tapa; redondeado(c, cx - ancho * 0.75, tope - 1.1 * e, ancho * 1.5, 1.3 * e, 0.5 * e); c.fill();
  c.fillStyle = "rgba(255, 255, 255, 0.45)"; c.fillRect(cx - ancho * 0.55, tope - 0.95 * e, ancho * 1.1, 0.3 * e);
}

// ── Avatar ───────────────────────────────────────────────────────────────────

/** La kettlebell del Arcade, con piernitas y tenis (entrenador, 2026-11-25: "que el avatar sea una kettlebell"). */
function pintarAvatar(c: CanvasRenderingContext2D, x: number, y: number, r: number, subiendo: boolean): void {
  c.save();
  c.translate(x, y);
  c.scale(1 / Math.sqrt(aplaste), aplaste);
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

  // Marcas de metros, discretas.
  for (let m = Math.ceil(cam / UNIDADES_POR_METRO / 10) * 10; m * UNIDADES_POR_METRO < cam + H / e + 20; m += 10) {
    if (m <= 0) continue;
    const y = sy(m * UNIDADES_POR_METRO);
    c.fillStyle = "rgba(255, 255, 255, 0.4)";
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
    pintarPlataforma(c, cj, cj.x * e, y, cj.ancho * e, e);
  }
  for (const pz of pedazos) {
    const w = (pz.cajon.ancho / 2) * e;
    const x = (pz.cajon.x + (pz.lado > 0 ? pz.cajon.ancho / 2 : 0) + pz.dx) * e;
    const y = sy(pz.cajon.h + pz.dh);
    c.save(); c.translate(x + w / 2, y); c.rotate(pz.giro); c.globalAlpha = 0.85;
    pintarPlataforma(c, { ...pz.cajon, ancho: pz.cajon.ancho / 2, trampolin: false }, -w / 2, 0, w, e);
    c.restore();
  }
  for (const pt of particulas) {
    c.fillStyle = pt.color; c.globalAlpha = Math.max(0, Math.min(1, pt.vida * 2));
    c.beginPath(); c.arc(pt.x * e, sy(pt.h), pt.r * e * 0.5, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // La clienta (y su copia del otro lado cuando cruza la orilla).
  const r = RADIO * e;
  const y = sy(salto.h) - r * 0.9;
  for (const dx of [0, -ANCHO, ANCHO]) {
    const x = (salto.x + dx) * e;
    if (x < -r * 2 || x > W + r * 2) continue;
    pintarAvatar(c, x, y, r, salto.vh > 0);
  }
  c.textAlign = "center";
  for (const l of letreros) {
    c.save(); c.font = `900 ${Math.round(5 * e)}px system-ui, sans-serif`; c.fillStyle = `rgba(255, 212, 92, ${Math.max(0, l.vida)})`;
    c.shadowColor = "#ff3bd4"; c.shadowBlur = 10; c.fillText(l.texto, Math.min(W - 60, Math.max(60, l.x * e)), sy(l.h)); c.restore();
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (destello > 0) { c.fillStyle = `rgba(255, 255, 255, ${destello * 0.5})`; c.fillRect(0, 0, W, H); }
}

// ── Montaje ──────────────────────────────────────────────────────────────────

function ajustarMarco(): void {
  ajustarMarcoJuego(q("#bj-pantalla"));
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
  prepararMarcoJuego(ajustarMarco);
  requestAnimationFrame(() => {
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
  vigilarMarcoJuego(() => { if (!c.hidden) ajustarMarco(); });
}
