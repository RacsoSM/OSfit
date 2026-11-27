import {
  ALTO_BARRA, LARGO, METROS_POR_NIVEL, PUNTOS_BATIDO, VISTA, ZONAS, accion, avanzar, metros, nivel, nuevaCarrera, puntos,
  type Accion, type Batido, type Carrera, type Obstaculo,
} from "../pesaRun";
import { conPartida, htmlLista, type ApiJuego, type EnvioPartida, type TablaDiscos } from "./juegoDiscos";
import { escapar } from "./tarjetaDia";
import { ajustarMarcoJuego, pintarSeguro, prepararMarcoJuego, vigilarMarcoJuego, densidadJuego } from "./marcoJuego";
import { marcasDe } from "./marcasRecords";

/**
 * La pantalla de Pesa Run (lógica en `../pesaRun.ts`), del Arcade. Como los otros juegos: toda la
 * pestaña es el juego, vive en su propio contenedor (`#pesarun`) fuera del repintado, el
 * resultado y el récord salen al instante, guardar va por detrás, y tiene sus Records
 * (`guardarPartidaPesaRun` y `tablaPesaRun` en functions).
 *
 * Se corre por el pasillo del gimnasio OSFIT visto desde atrás, en perspectiva: piso de hule con
 * sus tres carriles, paredes con espejos y carteles, lámparas en el techo. Cada nivel es una
 * zona del gimnasio con su color. La protagonista es una mancuerna con ojos y patitas.
 */

type Estado = "inicio" | "jugando" | "pausa" | "fin";
type Guardado = "nada" | "error";

interface Particula { x: number; y: number; z: number; vx: number; vy: number; vida: number; color: string }
interface Letrero { texto: string; vida: number }

let caja: HTMLElement | null = null;
let api: ApiJuego | null = null;
let estado: Estado = "inicio";
let carrera: Carrera = demo();
let inicio = 0;
let duracion = 0;
let particulas: Particula[] = [];
let letreros: Letrero[] = [];
let sacudida = 0;
let cuadro = 0;
let ultimo = 0;
let reloj = 0;
let nivelVisto = 1;
let tabla: TablaDiscos | null = null;
let errorTabla = false;
let guardado: Guardado = "nada";
let record = false;
let hoja = false;
let idPartida = 0;
let pendientes: { envio: EnvioPartida; id: number }[] = [];
let porConfirmar = 0;
/** Dónde empezó el deslizar del dedo (se reinicia tras cada movimiento, así se encadenan). */
let gesto: { x: number; y: number } | null = null;
const UMBRAL_GESTO = 22;

// Solo en desarrollo (Vite lo quita del build): deja leer la partida para grabar demos.
if (import.meta.env?.DEV) (globalThis as { __pesaRun?: () => { carrera: Carrera; estado: Estado } }).__pesaRun = () => ({ carrera, estado });

const LLAVE_TABLA = "osfit:pesarun-tabla";
function tablaGuardada(): TablaDiscos | null {
  try {
    const t = JSON.parse(globalThis.localStorage?.getItem(LLAVE_TABLA) ?? "null") as TablaDiscos | null;
    return t && Array.isArray(t.filas) && typeof t.tuMejor === "number" ? t : null;
  } catch { return null; }
}
function recordarTabla(t: TablaDiscos): void {
  try { globalThis.localStorage?.setItem(LLAVE_TABLA, JSON.stringify(t)); } catch { /* sin almacenamiento */ }
}

/** En la portada corre sola por un pasillo vacío. */
function demo(): Carrera {
  const c = nuevaCarrera();
  c.obstaculos = []; c.batidos = []; c.proximaFila = Number.POSITIVE_INFINITY;
  return c;
}

// ── HTML ─────────────────────────────────────────────────────────────────────

export function htmlPesaRun(): string {
  return `
    <div class="jd-pantalla pr-pantalla" id="pr-pantalla">
      <canvas id="pr-canvas" aria-label="Pesa Run"></canvas>
      <div class="jd-hud" aria-live="polite">
        <p class="jd-hud-puntos" id="pr-puntos">0</p>
        <p class="jd-hud-record">Récord <b id="pr-record">—</b></p>
      </div>
      <p class="jd-hud-nivel jd-nivel-abajo" id="pr-nivel"></p>
      <div class="jd-capa" id="pr-capa"></div>
      <section class="jd-hoja" id="pr-hoja" hidden aria-label="Records">
        <div class="jd-hoja-cabeza">
          <p class="jd-hoja-titulo">Records</p>
          <button type="button" class="jd-cerrar" data-pr="cerrar-hoja" aria-label="Cerrar">✕</button>
        </div>
        <p class="jd-hoja-tuyo" id="pr-tuyo"></p>
        <ol class="jd-lista" id="pr-lista"></ol>
        <button type="button" class="jd-boton" data-pr="jugar">Jugar</button>
      </section>
    </div>`;
}

export function htmlCapaPesaRun(e: Estado, total: number, m: number, batidos: number, g: Guardado, nuevoRecord: boolean, nivelAlcanzado = 1): string {
  if (e === "jugando") return "";
  if (e === "pausa") {
    return `<div class="jd-capa-caja"><p class="jd-capa-titulo">Pausa</p>
      <button type="button" class="jd-boton" data-pr="seguir">Seguir</button></div>`;
  }
  if (e === "inicio") {
    return `
      <div class="jd-capa-caja">
        <p class="jd-capa-marca">OSFIT · Arcade</p>
        <p class="jd-capa-titulo">Pesa Run</p>
        <p class="jd-capa-texto">La mancuerna corre sola por el gimnasio. Desliza el dedo a los lados para cambiar de carril, hacia arriba para saltar las bancas y hacia abajo para barrerte bajo las barras. Los racks solo se esquivan. Cada metro es un punto y cada batido vale ${PUNTOS_BATIDO}.</p>
        <button type="button" class="jd-boton" data-pr="jugar">Jugar</button>
        <button type="button" class="jd-boton secundario" data-pr="marcador">Ver marcador</button>
      </div>`;
  }
  const nota = g === "error"
    ? `<p class="jd-capa-nota error">No se pudo guardar tu puntuación. <button type="button" class="jd-enlace" data-pr="reintentar-guardar">Intentar de nuevo</button></p>`
    : "";
  return `
    <div class="jd-capa-caja fin">
      ${nuevoRecord ? `<p class="jd-capa-record">¡Nuevo récord!</p>` : `<p class="jd-capa-marca">¡Auch!</p>`}
      <p class="jd-capa-puntos">${total}</p>
      <p class="jd-capa-texto">${m} m · ${batidos} ${batidos === 1 ? "batido" : "batidos"} · Nivel ${nivelAlcanzado}, ${escapar(ZONAS[nivelAlcanzado - 1] ?? "")}</p>
      ${nota}
      <button type="button" class="jd-boton" data-pr="jugar">Reintentar</button>
      <button type="button" class="jd-boton secundario" data-pr="marcador">Ver marcador</button>
    </div>`;
}

function q<T extends HTMLElement>(s: string): T | null { return caja?.querySelector<T>(s) ?? null; }

function actualizar(): void {
  if (!caja) return;
  const total = estado === "inicio" ? 0 : puntos(carrera);
  const el = q("#pr-puntos");
  const texto = String(total);
  if (el && el.textContent !== texto) el.textContent = texto;
  const rec = q("#pr-record"); if (rec) rec.textContent = tabla && tabla.tuMejor > 0 ? String(tabla.tuMejor) : "—";
  const niv = q("#pr-nivel"); if (niv) niv.textContent = `Nivel ${nivelVisto} · ${ZONAS[nivelVisto - 1]}`;
  q("#pr-pantalla")?.classList.toggle("en-juego", estado === "jugando");
  const capa = q("#pr-capa");
  if (capa) {
    const html = htmlCapaPesaRun(estado, total, metros(carrera), carrera.batidosTomados, guardado, record, nivel(metros(carrera)));
    if (capa.dataset.html !== html) { capa.innerHTML = html; capa.dataset.html = html; }
    capa.hidden = estado === "jugando" || hoja;
  }
  const h = q("#pr-hoja"); if (h) h.hidden = !hoja;
  const lista = q("#pr-lista"); if (lista) lista.innerHTML = htmlLista(tabla, errorTabla);
  const tuyo = q("#pr-tuyo");
  if (tuyo) {
    const mio = tabla?.filas.find((f) => f.esTuyo);
    tuyo.textContent = mio ? `Vas en el lugar #${mio.puesto} con ${mio.puntos} puntos.` : tabla ? "Juega una partida para entrar al marcador." : "";
  }
}

function pop(): void {
  const el = q("#pr-puntos");
  if (el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
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
  const total = puntos(carrera);
  if (total === 0 || !api) return;
  const envio: EnvioPartida = { puntos: total, apilados: total, duracionMs: Math.round(duracion) };
  porConfirmar = Math.max(porConfirmar, total);
  if (tabla) {
    const local = conPartida(tabla, total, api.nombre);
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

function jugar(): void {
  carrera = nuevaCarrera();
  particulas = []; letreros = []; sacudida = 0;
  nivelVisto = 1;
  gesto = null;
  guardado = "nada"; record = false; hoja = false;
  estado = "jugando";
  inicio = performance.now();
  duracion = 0;
  actualizar();
}

function mover(a: Accion): void {
  if (estado !== "jugando") return;
  if (accion(carrera, a) && a !== "izquierda" && a !== "derecha") navigator.vibrate?.(8);
}

function ciclo(ahora: number): void {
  const dt = Math.min(0.04, (ahora - ultimo) / 1000);
  ultimo = ahora;
  reloj += dt;
  if (estado === "jugando") {
    const antes = puntos(carrera);
    const ev = avanzar(carrera, dt);
    if (ev === "batido") {
      letreros.push({ texto: `+${PUNTOS_BATIDO}`, vida: 1 });
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2;
        particulas.push({ x: carrera.x * CARRIL, y: 0.9 + carrera.y, z: carrera.z + 0.6, vx: Math.cos(a) * 2, vy: 1 + Math.random() * 2.5, vida: 0.5, color: k % 2 ? "#ff6fd8" : "#7ef3ff" });
      }
    }
    if (Math.floor(puntos(carrera) / 100) > Math.floor(antes / 100)) pop();
    const n = nivel(metros(carrera));
    if (n > nivelVisto) {
      nivelVisto = n;
      actualizar();
      const niv = q("#pr-nivel");
      if (niv) { niv.classList.remove("sube"); void niv.offsetWidth; niv.classList.add("sube"); }
      navigator.vibrate?.(25);
    }
    if (ev === "choque") {
      duracion = performance.now() - inicio;
      estado = "fin";
      sacudida = 0.9;
      navigator.vibrate?.([40, 30, 60]);
      actualizar();
      terminarPartida();
    } else actualizar();
  } else if (estado === "inicio") {
    avanzar(carrera, dt);
    // La portada no acelera: corre siempre a la velocidad de salida.
    if (carrera.z > 200) carrera.z -= 200;
  }
  for (const p of particulas) { p.vida -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 9 * dt; p.z += carrera.vel * dt * (estado === "jugando" ? 0.9 : 0); }
  particulas = particulas.filter((p) => p.vida > 0);
  for (const l of letreros) l.vida -= dt * 1.4;
  letreros = letreros.filter((l) => l.vida > 0);
  sacudida = Math.max(0, sacudida - dt * 2.5);
  cuadro = requestAnimationFrame(ciclo);
  pintarSeguro(dibujar);
}

function arrancar(): void {
  cancelAnimationFrame(cuadro);
  ultimo = performance.now();
  cuadro = requestAnimationFrame(ciclo);
}

// ── Dibujo ───────────────────────────────────────────────────────────────────

/** Metros de ancho de cada carril; las paredes, el techo y la cámara, en metros. */
const CARRIL = 1.5;
const PARED = 2.9;
const TECHO = 3.4;
const CAM_ALTO = 2.3;
const CAM_ATRAS = 4.6;

/** Cada zona (nivel) del gimnasio: pared, pared alterna, piso, neón. */
const COLORES: readonly { pared: string; pared2: string; piso: string; piso2: string; neon: string }[] = [
  { pared: "#2b2140", pared2: "#33284d", piso: "#1d1a24", piso2: "#24202d", neon: "#7ef3ff" }, // Recepción
  { pared: "#1f2d3f", pared2: "#26374c", piso: "#171c24", piso2: "#1d232d", neon: "#9dff5c" }, // Cardio
  { pared: "#3a2130", pared2: "#45283a", piso: "#1f1719", piso2: "#271c20", neon: "#ff6fd8" }, // Pesas libres
  { pared: "#22313a", pared2: "#2a3b45", piso: "#161d21", piso2: "#1c2429", neon: "#ffd45c" }, // Máquinas
  { pared: "#3a2a1c", pared2: "#463322", piso: "#1d1813", piso2: "#251f18", neon: "#ff8a3d" }, // Crossfit
  { pared: "#2e1d1d", pared2: "#3a2424", piso: "#1a1212", piso2: "#221717", neon: "#ff4d5e" }, // Powerlifting
  { pared: "#1d2230", pared2: "#252b3c", piso: "#13161f", piso2: "#191d28", neon: "#b48aff" }, // Box
  { pared: "#2a1f0c", pared2: "#362810", piso: "#17130a", piso2: "#1f1a0e", neon: "#ffe08a" }, // Olimpo
];

const CARTELES = ["NO PAIN NO GAIN", "LEG DAY", "OSFIT", "1 REP MÁS", "HIDRÁTATE", "TÚ PUEDES"];

interface Vista { W: number; H: number; F: number; hz: number; camX: number; camZ: number }

function proyectar(v: Vista, x: number, y: number, z: number): { x: number; y: number; s: number } {
  const dz = Math.max(0.25, z - v.camZ);
  const s = v.F / dz;
  return { x: v.W / 2 + (x - v.camX) * s, y: v.hz + (CAM_ALTO - y) * s, s };
}

function poligono(c: CanvasRenderingContext2D, pts: readonly { x: number; y: number }[], color: string | CanvasGradient): void {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(pts[0]!.x, pts[0]!.y);
  for (let k = 1; k < pts.length; k++) c.lineTo(pts[k]!.x, pts[k]!.y);
  c.closePath();
  c.fill();
}

function mezclar(a: string, b: string, f: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const m = (s: number) => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f);
  return `rgb(${m(16)}, ${m(8)}, ${m(0)})`;
}

/** Los colores de la zona según dónde va (de una a la otra en los últimos 30 m). */
function coloresEn(z: number) {
  const n = Math.max(0, z) / METROS_POR_NIVEL;
  const i = Math.min(COLORES.length - 1, Math.floor(n));
  const j = Math.min(COLORES.length - 1, i + 1);
  const f = i === j ? 0 : Math.max(0, (n - i - 0.88) / 0.12);
  const a = COLORES[i]!, b = COLORES[j]!;
  return {
    pared: mezclar(a.pared, b.pared, f), pared2: mezclar(a.pared2, b.pared2, f),
    piso: mezclar(a.piso, b.piso, f), piso2: mezclar(a.piso2, b.piso2, f), neon: f < 0.5 ? a.neon : b.neon,
  };
}

/** Una caja en el mundo: pinta sus caras visibles (lado, tapa, frente). */
function caja3d(c: CanvasRenderingContext2D, v: Vista, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, frente: string, tapa: string, lado: string): void {
  z0 = Math.max(z0, v.camZ + 0.4);
  if (z1 <= z0) return;
  const P = (x: number, y: number, z: number) => proyectar(v, x, y, z);
  if (x0 > v.camX) poligono(c, [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], lado);
  if (x1 < v.camX) poligono(c, [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], lado);
  if (y1 < CAM_ALTO) poligono(c, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], tapa);
  else poligono(c, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], tapa);
  poligono(c, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], frente);
}

function pintarPasillo(c: CanvasRenderingContext2D, v: Vista): void {
  const { W, H } = v;
  const lejos = v.camZ + VISTA + 10;
  const col = coloresEn(carrera.z);
  c.fillStyle = "#0d0a14"; c.fillRect(-20, -20, W + 40, H + 40);
  const P = (x: number, y: number, z: number) => proyectar(v, x, y, z);
  const cerca = v.camZ + 0.3;

  // La pared del fondo, con el letrero de neón.
  const fa = P(-PARED, TECHO, lejos), fb = P(PARED, 0, lejos);
  c.fillStyle = col.pared; c.fillRect(fa.x, fa.y, fb.x - fa.x, fb.y - fa.y);
  c.save();
  c.font = `900 ${Math.max(6, fa.s * 0.9)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
  c.shadowColor = col.neon; c.shadowBlur = 8; c.fillStyle = col.neon;
  c.fillText("OSFIT", (fa.x + fb.x) / 2, fa.y + (fb.y - fa.y) * 0.4);
  c.restore();

  // Piso, techo y paredes.
  poligono(c, [P(-PARED, 0, cerca), P(PARED, 0, cerca), P(PARED, 0, lejos), P(-PARED, 0, lejos)], col.piso);
  poligono(c, [P(-PARED, TECHO, cerca), P(PARED, TECHO, cerca), P(PARED, TECHO, lejos), P(-PARED, TECHO, lejos)], "#120f19");
  poligono(c, [P(-PARED, 0, cerca), P(-PARED, 0, lejos), P(-PARED, TECHO, lejos), P(-PARED, TECHO, cerca)], col.pared);
  poligono(c, [P(PARED, 0, cerca), P(PARED, 0, lejos), P(PARED, TECHO, lejos), P(PARED, TECHO, cerca)], col.pared);

  // Las franjas del piso de hule (dan la sensación de velocidad) y los tramos de pared.
  const TRAMO = 6;
  const k0 = Math.floor(cerca / TRAMO), k1 = Math.ceil(lejos / TRAMO);
  for (let k = k1; k >= k0; k--) {
    const z0 = Math.max(cerca, k * TRAMO), z1 = Math.min(lejos, k * TRAMO + TRAMO / 2);
    if (z1 > z0) poligono(c, [P(-PARED, 0, z0), P(PARED, 0, z0), P(PARED, 0, z1), P(-PARED, 0, z1)], col.piso2);
    const w0 = Math.max(cerca, k * TRAMO), w1 = Math.min(lejos, k * TRAMO + TRAMO);
    if (w1 <= w0) continue;
    const semilla = ((k % 97) + 97) % 97;
    for (const lado of [-1, 1]) {
      const x = lado * PARED;
      if (k % 2 === 0) poligono(c, [P(x, 0, w0), P(x, 0, w1), P(x, TECHO, w1), P(x, TECHO, w0)], col.pared2);
      // Espejo o cartel, según el tramo.
      const a0 = k * TRAMO + 0.8, a1 = k * TRAMO + TRAMO - 0.8;
      if (a0 < cerca || a1 > lejos) continue;
      const tipo = (semilla + (lado > 0 ? 1 : 0)) % 3;
      if (tipo === 0) {
        const g = c.createLinearGradient(P(x, 2.6, a0).x, P(x, 2.6, a0).y, P(x, 0.4, a1).x, P(x, 0.4, a1).y);
        g.addColorStop(0, "rgba(190, 220, 255, 0.35)"); g.addColorStop(0.5, "rgba(120, 150, 200, 0.12)"); g.addColorStop(1, "rgba(190, 220, 255, 0.28)");
        poligono(c, [P(x, 0.4, a0), P(x, 0.4, a1), P(x, 2.6, a1), P(x, 2.6, a0)], g);
      } else if (tipo === 1) {
        poligono(c, [P(x, 1.2, a0 + 1), P(x, 1.2, a1 - 1), P(x, 2.5, a1 - 1), P(x, 2.5, a0 + 1)], col.neon);
        poligono(c, [P(x, 1.3, a0 + 1.15), P(x, 1.3, a1 - 1.15), P(x, 2.4, a1 - 1.15), P(x, 2.4, a0 + 1.15)], "#15111d");
        const m = P(x, 1.85, (a0 + a1) / 2);
        if (m.s > 8) {
          c.save();
          c.font = `900 ${Math.round(m.s * 0.28)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
          c.fillStyle = col.neon; c.translate(m.x, m.y); c.transform(1, lado * 0.35, 0, 1, 0, 0);
          c.fillText(CARTELES[(semilla + (lado > 0 ? 3 : 0)) % CARTELES.length]!, 0, 0, m.s * 2.2);
          c.restore();
        }
      } else {
        // Un rack de mancuernas pegado a la pared.
        const xr = x - lado * 0.35;
        caja3d(c, v, Math.min(x, xr), Math.max(x, xr), 0.55, 0.62, a0, a1, "#3b3f48", "#4b505b", "#2b2e35");
        for (let d = 0; d < 6; d++) {
          const zd = a0 + 0.3 + d * ((a1 - a0 - 0.6) / 5);
          const p = P(x - lado * 0.18, 0.72, zd);
          c.fillStyle = "#16181c"; c.beginPath(); c.arc(p.x, p.y, Math.max(1, p.s * 0.1), 0, Math.PI * 2); c.fill();
        }
      }
    }
    // Las lámparas del techo.
    const zl = k * TRAMO + 1.5;
    if (zl > v.camZ + 3 && zl + 1 < lejos) poligono(c, [P(-0.9, TECHO, zl), P(0.9, TECHO, zl), P(0.9, TECHO, zl + 1), P(-0.9, TECHO, zl + 1)], "rgba(255, 250, 230, 0.75)");
  }

  // Las líneas de los carriles y el neón de las orillas.
  c.lineCap = "round";
  for (const lx of [-CARRIL / 2, CARRIL / 2]) {
    const a = P(lx, 0, cerca), b = P(lx, 0, lejos);
    c.strokeStyle = "rgba(255, 255, 255, 0.18)"; c.lineWidth = Math.max(1, v.F / (cerca - v.camZ + 4) * 0.06);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
  for (const lx of [-PARED, PARED]) {
    for (const y of [0.05, TECHO - 0.05]) {
      const a = P(lx, y, cerca), b = P(lx, y, lejos);
      c.save(); c.strokeStyle = col.neon; c.shadowColor = col.neon; c.shadowBlur = 10; c.lineWidth = 2;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore();
    }
  }
  c.lineCap = "butt";

  // Neblina al fondo: tapa lo que va apareciendo.
  const nb = P(0, 0, v.camZ + VISTA * 0.55), nt = P(0, TECHO, v.camZ + VISTA * 0.55);
  const niebla = c.createLinearGradient(0, nt.y, 0, nb.y);
  niebla.addColorStop(0, "rgba(13, 10, 20, 0)"); niebla.addColorStop(0.5, "rgba(13, 10, 20, 0.45)"); niebla.addColorStop(1, "rgba(13, 10, 20, 0)");
  c.fillStyle = niebla; c.fillRect(0, nt.y, W, nb.y - nt.y);
}

/** Qué tan visible es algo a esa distancia: aparece suave al fondo. */
function niebla(v: Vista, z: number): number {
  return Math.max(0, Math.min(1, (v.camZ + VISTA - z) / 25));
}

function pintarBanca(c: CanvasRenderingContext2D, v: Vista, o: Obstaculo): void {
  const x = o.carril * CARRIL, z0 = o.z, z1 = o.z + LARGO.banca;
  for (const zp of [z0 + 0.1, z1 - 0.25]) caja3d(c, v, x - 0.35, x + 0.35, 0, 0.36, zp, zp + 0.15, "#3d424c", "#555b67", "#2c3038");
  caja3d(c, v, x - 0.45, x + 0.45, 0.36, 0.55, z0, z1, "#c62a3d", "#e04459", "#8f1d2c");
  const p = proyectar(v, x, 0.46, z0);
  c.fillStyle = "rgba(255, 255, 255, 0.2)"; c.fillRect(p.x - p.s * 0.4, p.y - p.s * 0.08, p.s * 0.8, Math.max(1, p.s * 0.03));
}

/** Discos vistos de canto: rectángulos altos. */
function discos(c: CanvasRenderingContext2D, v: Vista, x: number, y: number, z: number, lado: number, colores: readonly string[]): void {
  colores.forEach((col, k) => {
    const r = 0.26 - k * 0.04;
    const xc = x + lado * k * 0.07;
    caja3d(c, v, xc - 0.03, xc + 0.03, y - r, y + r, z - 0.03, z + 0.03, col, col, col);
  });
}

function pintarBarra(c: CanvasRenderingContext2D, v: Vista, o: Obstaculo): void {
  const x = o.carril * CARRIL, z = o.z;
  for (const lado of [-1, 1]) {
    caja3d(c, v, x + lado * 0.66 - 0.05, x + lado * 0.66 + 0.05, 0, ALTO_BARRA + 0.35, z + 0.1, z + 0.2, "#262931", "#3a3e48", "#1b1d22");
    caja3d(c, v, x + lado * 0.66 - 0.15, x + lado * 0.66 + 0.15, 0, 0.05, z, z + 0.3, "#262931", "#3a3e48", "#1b1d22");
  }
  // La barra, con franjas de cuidado amarillas y negras.
  const y = ALTO_BARRA + 0.06;
  caja3d(c, v, x - 0.78, x + 0.78, y - 0.035, y + 0.035, z + 0.12, z + 0.18, "#c7cbd3", "#e8ebf0", "#9aa0aa");
  const a = proyectar(v, x - 0.6, y, z + 0.12), b = proyectar(v, x + 0.6, y, z + 0.12);
  const grosor = Math.max(2, a.s * 0.09);
  for (let k = 0; k < 8; k++) {
    if (k % 2) continue;
    c.fillStyle = "#ffd23f";
    c.fillRect(a.x + ((b.x - a.x) * k) / 8, a.y - grosor / 2, (b.x - a.x) / 8, grosor);
  }
  discos(c, v, x - 0.82, y, z + 0.15, -1, ["#1e6fd9", "#e8c547"]);
  discos(c, v, x + 0.82, y, z + 0.15, 1, ["#1e6fd9", "#e8c547"]);
}

function pintarRack(c: CanvasRenderingContext2D, v: Vista, o: Obstaculo): void {
  const x = o.carril * CARRIL, z0 = o.z, z1 = o.z + LARGO.rack, alto = 2.3;
  const poste = (px: number, pz: number) => caja3d(c, v, px - 0.06, px + 0.06, 0, alto, pz, pz + 0.12, "#2f333b", "#454a55", "#20232a");
  // Los de atrás primero.
  poste(x - 0.62, z1 - 0.12); poste(x + 0.62, z1 - 0.12);
  caja3d(c, v, x - 0.62, x + 0.62, alto - 0.1, alto, z1 - 0.12, z1, "#2f333b", "#454a55", "#20232a");
  // Las barras de seguridad, a los lados.
  for (const lado of [-1, 1]) caja3d(c, v, x + lado * 0.62 - 0.04, x + lado * 0.62 + 0.04, 0.7, 0.78, z0, z1, "#8a8f99", "#a8adb6", "#6b707a");
  // La barra cargada adentro.
  const y = 1.45, zb = (z0 + z1) / 2;
  caja3d(c, v, x - 0.85, x + 0.85, y - 0.035, y + 0.035, zb - 0.03, zb + 0.03, "#c7cbd3", "#e8ebf0", "#9aa0aa");
  discos(c, v, x - 0.72, y, zb, -1, ["#d83a3a", "#d83a3a", "#2a7d3a"]);
  discos(c, v, x + 0.72, y, zb, 1, ["#d83a3a", "#d83a3a", "#2a7d3a"]);
  poste(x - 0.62, z0); poste(x + 0.62, z0);
  caja3d(c, v, x - 0.62, x + 0.62, alto - 0.1, alto, z0, z0 + 0.12, "#2f333b", "#454a55", "#20232a");
  // El letrero de arriba: no se pasa.
  const p = proyectar(v, x, alto - 0.3, z0);
  if (p.s > 10) {
    c.save();
    c.fillStyle = "#ff4d5e"; c.shadowColor = "#ff4d5e"; c.shadowBlur = 6;
    const w = p.s * 0.75, h = p.s * 0.22;
    c.fillRect(p.x - w / 2, p.y - h / 2, w, h);
    c.shadowBlur = 0; c.fillStyle = "#fff"; c.font = `900 ${Math.round(h * 0.7)}px system-ui, sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("RACK", p.x, p.y + h * 0.04);
    c.restore();
  }
}

/** Un batido de proteína: el shaker con su tapa, que gira y brilla. */
function pintarBatido(c: CanvasRenderingContext2D, v: Vista, b: Batido): void {
  const flota = Math.sin(reloj * 4 + b.z) * 0.06;
  const p = proyectar(v, b.carril * CARRIL, b.alto + flota, b.z);
  const giro = Math.abs(Math.cos(reloj * 3 + b.z * 0.7));
  const w = p.s * 0.28 * (0.45 + 0.55 * giro), h = p.s * 0.45;
  c.save();
  c.shadowColor = "#ff6fd8"; c.shadowBlur = 12;
  c.fillStyle = "#ff6fd8";
  c.beginPath(); c.roundRect(p.x - w / 2, p.y - h / 2, w, h, w * 0.3); c.fill();
  c.shadowBlur = 0;
  c.fillStyle = "#fff4fb"; c.fillRect(p.x - w / 2, p.y - h * 0.08, w, h * 0.16);
  c.fillStyle = "#2a2c31";
  c.beginPath(); c.roundRect(p.x - w * 0.55, p.y - h * 0.62, w * 1.1, h * 0.2, w * 0.1); c.fill();
  c.fillRect(p.x - w * 0.12, p.y - h * 0.74, w * 0.24, h * 0.14);
  c.fillStyle = "rgba(255, 255, 255, 0.5)"; c.fillRect(p.x - w * 0.3, p.y - h * 0.38, Math.max(1, w * 0.12), h * 0.6);
  c.restore();
}

/**
 * La protagonista: una mancuerna hexagonal acostada, con dos ojos sobre el mango y dos patitas
 * con tenis. Corre moviendo las patas, se encoge al barrerse, recoge las patas al saltar y se
 * inclina al cambiarse de carril. Al chocar, ojos de tache.
 */
function pintarMancuerna(c: CanvasRenderingContext2D, v: Vista): void {
  const car = carrera;
  const x = car.x * CARRIL;
  const piso = proyectar(v, x, 0, car.z);
  /** Un poco más grande que su tamaño real, para que se vea bien en el teléfono. */
  const TAM = 1.3;
  const s = piso.s * TAM;
  const barriendo = car.barrida > 0;
  const enAire = car.y > 0.01;
  const centroY = (barriendo ? 0.24 : 0.62) * TAM;
  const cuerpo = proyectar(v, x, car.y + centroY, car.z);

  // Sombra en el piso.
  const sombra = Math.max(0.35, 1 - car.y * 0.35);
  c.fillStyle = "rgba(0, 0, 0, 0.4)";
  c.beginPath(); c.ellipse(piso.x, piso.y, s * 0.55 * sombra, s * 0.12 * sombra, 0, 0, Math.PI * 2); c.fill();

  c.save();
  c.translate(cuerpo.x, cuerpo.y);
  c.rotate((car.carril - car.x) * 0.28);
  if (barriendo) c.scale(1.1, 0.8);

  // Las patitas: alternan al correr; en el aire se recogen; barriéndose van estiradas al frente.
  const fase = car.z * 2.4;
  c.lineCap = "round";
  for (const lado of [-1, 1]) {
    const hx = lado * 0.12 * s, hy = 0.06 * s;
    let px: number, py: number;
    if (car.terminada) { px = lado * 0.3 * s; py = 0.42 * s; }
    else if (barriendo) { px = lado * 0.28 * s; py = 0.18 * s; }
    else if (enAire) { px = lado * 0.2 * s; py = 0.3 * s; }
    else {
      const paso = Math.sin(fase + (lado > 0 ? Math.PI : 0));
      px = hx + lado * 0.04 * s; py = (0.56 - Math.max(0, paso) * 0.16) * s;
    }
    c.strokeStyle = "#2a2c31"; c.lineWidth = s * 0.07;
    c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx + lado * 0.05 * s, (hy + py) / 2, px, py); c.stroke();
    // El tenis.
    c.fillStyle = "#f4f4f4";
    c.beginPath(); c.ellipse(px + lado * 0.03 * s, py + 0.025 * s, s * 0.09, s * 0.05, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ff4fd8"; c.fillRect(px + lado * 0.03 * s - s * 0.08, py + 0.045 * s, s * 0.16, s * 0.02);
  }

  // El mango, cromado, con su moleteado.
  const gm = c.createLinearGradient(0, -0.08 * s, 0, 0.08 * s);
  gm.addColorStop(0, "#f2f4f7"); gm.addColorStop(0.5, "#9aa0aa"); gm.addColorStop(1, "#5d636d");
  c.fillStyle = gm;
  c.beginPath(); c.roundRect(-0.3 * s, -0.075 * s, 0.6 * s, 0.15 * s, 0.05 * s); c.fill();
  c.strokeStyle = "rgba(0, 0, 0, 0.18)"; c.lineWidth = Math.max(1, s * 0.01);
  for (let k = -5; k <= 5; k++) { c.beginPath(); c.moveTo(k * 0.04 * s, -0.07 * s); c.lineTo(k * 0.04 * s + 0.02 * s, 0.07 * s); c.stroke(); }

  // Las dos cabezas hexagonales.
  for (const lado of [-1, 1]) {
    const cx = lado * 0.42 * s, r = 0.27 * s;
    const gh = c.createLinearGradient(cx - r, -r, cx + r, r);
    gh.addColorStop(0, "#4a4f59"); gh.addColorStop(0.5, "#24272d"); gh.addColorStop(1, "#111316");
    c.fillStyle = gh;
    c.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; c.lineTo(cx + Math.cos(a) * r * 0.78, Math.sin(a) * r); }
    c.closePath(); c.fill();
    c.fillStyle = "#c7cbd3";
    c.beginPath(); c.arc(cx, 0, r * 0.22, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(255, 255, 255, 0.12)";
    c.beginPath(); c.moveTo(cx - r * 0.6, -r * 0.55); c.lineTo(cx + r * 0.1, -r * 0.95); c.lineTo(cx + r * 0.2, -r * 0.75); c.lineTo(cx - r * 0.45, -r * 0.35); c.fill();
  }

  // Los ojos, grandes, asomados sobre el mango.
  const parpadeo = !car.terminada && reloj % 3.2 < 0.12 ? 0.15 : 1;
  for (const lado of [-1, 1]) {
    const ex = lado * 0.1 * s, ey = -0.12 * s, r = 0.1 * s;
    c.fillStyle = "#fff";
    c.beginPath(); c.ellipse(ex, ey, r, r * 1.15 * parpadeo, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#1a1b1f"; c.lineWidth = Math.max(1, s * 0.015); c.stroke();
    if (car.terminada) {
      c.strokeStyle = "#1a1b1f"; c.lineWidth = Math.max(1.5, s * 0.025);
      c.beginPath(); c.moveTo(ex - r * 0.5, ey - r * 0.5); c.lineTo(ex + r * 0.5, ey + r * 0.5); c.moveTo(ex + r * 0.5, ey - r * 0.5); c.lineTo(ex - r * 0.5, ey + r * 0.5); c.stroke();
    } else if (parpadeo === 1) {
      const mira = (car.carril - car.x) * 0.3;
      c.fillStyle = "#16171b";
      c.beginPath(); c.arc(ex + r * (0.15 + mira), ey + r * 0.05, r * 0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fff";
      c.beginPath(); c.arc(ex + r * (0.3 + mira), ey - r * 0.15, r * 0.16, 0, Math.PI * 2); c.fill();
    }
  }
  // Cejas decididas.
  if (!car.terminada) {
    c.strokeStyle = "#1a1b1f"; c.lineWidth = Math.max(1.5, s * 0.025);
    for (const lado of [-1, 1]) { c.beginPath(); c.moveTo(lado * 0.17 * s, -0.27 * s); c.lineTo(lado * 0.04 * s, -0.23 * s); c.stroke(); }
  }
  c.lineCap = "butt";
  c.restore();

  if (car.terminada) {
    c.save(); c.font = `${Math.round(s * 0.25)}px system-ui`; c.textAlign = "center";
    for (let k = 0; k < 3; k++) {
      const a = reloj * 3 + (k * Math.PI * 2) / 3;
      c.fillText("⭐", cuerpo.x + Math.cos(a) * s * 0.4, cuerpo.y - s * 0.45 + Math.sin(a) * s * 0.1);
    }
    c.restore();
  }
}

function dibujar(): void {
  const canvas = q<HTMLCanvasElement>("#pr-canvas");
  if (!canvas) return;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (W === 0 || H === 0) return;
  const dpr = densidadJuego();
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const c = canvas.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (sacudida > 0) c.translate((Math.random() - 0.5) * 12 * sacudida, (Math.random() - 0.5) * 8 * sacudida);
  // Que los tres carriles quepan a lo ancho, también en pantallas angostas.
  const F = Math.min(W * 0.85, H * 0.62);
  const v: Vista = { W, H, F, hz: H * 0.36, camX: carrera.x * CARRIL * 0.55, camZ: carrera.z - CAM_ATRAS };
  pintarPasillo(c, v);

  // Dónde quedan los records: una línea en el piso con su nombre. Los puntos no son solo metros
  // (los batidos suman), así que la línea va donde se rebasaría ese récord sin tomar más batidos.
  const falta = carrera.z - puntos(carrera);
  for (const m of marcasDe(tabla)) {
    const zr = m.puntos + falta;
    if (zr < v.camZ + 1 || zr > v.camZ + VISTA) continue;
    if (estado === "inicio") continue;
    const a = proyectar(v, -PARED, 0, zr), b = proyectar(v, PARED, 0, zr);
    c.globalAlpha = niebla(v, zr);
    c.strokeStyle = m.tuya ? "#ffd45c" : "#ff4fd8"; c.lineWidth = Math.max(1, a.s * 0.04);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    if (a.s > 12) {
      c.font = `800 ${Math.round(Math.min(14, a.s * 0.18))}px system-ui, sans-serif`; c.textAlign = "left"; c.fillStyle = c.strokeStyle;
      c.fillText(`${m.campeon ? "👑 " : ""}${m.texto} · ${m.puntos}`, Math.max(4, a.x + 4), a.y - 4);
    }
    c.globalAlpha = 1;
  }

  // De lo lejano a lo cercano, con la mancuerna en su lugar.
  type Cosa = { z: number; pintar: () => void };
  const cosas: Cosa[] = [];
  for (const o of carrera.obstaculos) {
    if (o.z > v.camZ + VISTA || o.z + LARGO[o.tipo] < v.camZ + 0.5) continue;
    cosas.push({ z: o.z, pintar: () => {
      c.globalAlpha = niebla(v, o.z);
      if (o.tipo === "banca") pintarBanca(c, v, o);
      else if (o.tipo === "barra") pintarBarra(c, v, o);
      else pintarRack(c, v, o);
      c.globalAlpha = 1;
    } });
  }
  for (const b of carrera.batidos) {
    if (b.tomado || b.z > v.camZ + VISTA || b.z < v.camZ + 0.8) continue;
    cosas.push({ z: b.z, pintar: () => { c.globalAlpha = niebla(v, b.z); pintarBatido(c, v, b); c.globalAlpha = 1; } });
  }
  // Lo que ya pasó a su lado se pinta antes que ella (va detrás de su cuerpo en pantalla).
  cosas.push({ z: carrera.z + 0.01, pintar: () => pintarMancuerna(c, v) });
  cosas.sort((a, b) => b.z - a.z);
  for (const cosa of cosas) cosa.pintar();

  for (const p of particulas) {
    const pp = proyectar(v, p.x, p.y, p.z);
    c.globalAlpha = Math.max(0, p.vida * 2);
    c.fillStyle = p.color; c.beginPath(); c.arc(pp.x, pp.y, Math.max(1, pp.s * 0.04), 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  const yo = proyectar(v, carrera.x * CARRIL, carrera.y + 1.3, carrera.z);
  for (const l of letreros) {
    c.save(); c.font = `900 ${Math.round(yo.s * 0.3)}px system-ui, sans-serif`; c.textAlign = "center";
    c.fillStyle = `rgba(255, 212, 92, ${Math.max(0, l.vida)})`; c.shadowColor = "#ff3bd4"; c.shadowBlur = 10;
    c.fillText(l.texto, yo.x, yo.y - (1 - l.vida) * yo.s * 0.6); c.restore();
  }
}

// ── Montaje ──────────────────────────────────────────────────────────────────

function ajustarMarco(): void {
  ajustarMarcoJuego(q("#pr-pantalla"));
}

/** Muestra u oculta el juego. La primera vez arma su DOM; al salir a media partida la pausa. */
export function mostrarPesaRun(contenedor: HTMLElement, visible: boolean, conexion: ApiJuego): void {
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
    contenedor.innerHTML = htmlPesaRun();
    conectar(contenedor);
    tabla = tabla ?? tablaGuardada();
  }
  prepararMarcoJuego(ajustarMarco);
  actualizar();
  arrancar();
  void cargarTabla();
}

function conectar(cont: HTMLElement): void {
  const pantalla = cont.querySelector<HTMLElement>("#pr-pantalla");
  pantalla?.addEventListener("pointerdown", (ev) => {
    if ((ev.target as HTMLElement).closest("button, .jd-hoja")) return;
    if (estado !== "jugando") return;
    ev.preventDefault();
    try { pantalla.setPointerCapture(ev.pointerId); } catch { /* sin captura también sirve */ }
    gesto = { x: ev.clientX, y: ev.clientY };
  });
  pantalla?.addEventListener("pointermove", (ev) => {
    if (!gesto || estado !== "jugando") return;
    const dx = ev.clientX - gesto.x, dy = ev.clientY - gesto.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < UMBRAL_GESTO) return;
    if (Math.abs(dx) > Math.abs(dy)) mover(dx < 0 ? "izquierda" : "derecha");
    else mover(dy < 0 ? "saltar" : "barrer");
    gesto = { x: ev.clientX, y: ev.clientY };
  });
  const soltar = () => { gesto = null; };
  pantalla?.addEventListener("pointerup", soltar);
  pantalla?.addEventListener("pointercancel", soltar);
  cont.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-pr]");
    if (!b) return;
    const que = b.dataset.pr;
    if (que === "jugar") jugar();
    if (que === "seguir") { estado = "jugando"; inicio = performance.now() - duracion; actualizar(); }
    if (que === "reintentar-guardar") reenviarPendientes();
    if (que === "marcador") { hoja = true; actualizar(); void cargarTabla(); }
    if (que === "cerrar-hoja") { hoja = false; actualizar(); }
  });
  const TECLAS: Readonly<Record<string, Accion>> = {
    ArrowLeft: "izquierda", a: "izquierda", ArrowRight: "derecha", d: "derecha",
    ArrowUp: "saltar", w: "saltar", " ": "saltar", ArrowDown: "barrer", s: "barrer",
  };
  document.addEventListener("keydown", (ev) => {
    if (cont.hidden || estado !== "jugando" || ev.repeat) return;
    const a = TECLAS[ev.key];
    if (a) { ev.preventDefault(); mover(a); }
  });
  vigilarMarcoJuego(() => { if (!cont.hidden) ajustarMarco(); });
}
