import {
  PUNTOS_BATIDO, ZONAS, accion, avanzar, choca, enAire, largoDe, metros, nivel, nuevaCarrera, puntos,
  type Accion, type Carrera,
} from "../pesaRun";
import { conPartida, htmlLista, type ApiJuego, type EnvioPartida, type TablaDiscos } from "./juegoDiscos";
import { escapar } from "./tarjetaDia";
import { ajustarMarcoJuego, pintarSeguro, prepararMarcoJuego, vigilarMarcoJuego, densidadJuego } from "./marcoJuego";
import { marcasDe } from "./marcasRecords";
import { CAM_ALTO, CAM_ATRAS, CARRIL, ORILLA, crearVista, niebla, proyectar } from "./pesaRun3d";
import { cosasDeEscena, lineasVelocidad, pintarBanca, pintarBarra, pintarBatido, pintarColchonetas, pintarPasillo, pintarRack, type Cosa } from "./pesaRunEscena";
import { pintarMancuerna, type AnimMancuerna, type Gesto } from "./pesaRunMancuerna";

/**
 * La pantalla de Correle pa (lógica en `../pesaRun.ts`), del Arcade. Como los otros juegos: toda la
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

/** `sigue`: va con la mancuerna (los destellos del batido); si no, se queda en su lugar del piso (el polvo). */
interface Particula { x: number; y: number; z: number; vx: number; vy: number; vida: number; color: string; sigue: boolean; r: number }
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
let aterrizaje = 0;
let feliz = 0;
/** La cámara sube y baja suave con lo que pisa la mancuerna (al subirse a las colchonetas). */
let camSuelo = 0;
/**
 * Hasta dónde se ve hacia adelante (entrenador, 2026-11-27: "que no se vea tan al fondo los
 * siguientes obstáculos"). Más allá los obstáculos ya existen, pero no se pintan.
 */
const VISTA_DIBUJO = 58;
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
/** Dónde empezó el deslizar del dedo; tras el primer movimiento queda en null hasta soltar. */
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
      <canvas id="pr-canvas" aria-label="Correle pa"></canvas>
      <div class="jd-vineta" aria-hidden="true"></div>
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
        <p class="jd-capa-titulo">Correle pa</p>
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
  particulas = []; letreros = []; sacudida = 0; aterrizaje = 0; feliz = 0; camSuelo = 0;
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

/** El gesto de la mancuerna: feliz un rato tras un batido, asustada si viene algo encima. */
function gestoActual(): Gesto {
  const c = carrera;
  if (c.terminada) return "mareo";
  if (feliz > 0) return "feliz";
  if (estado === "jugando") {
    const barriendo = c.barrida > 0;
    const peligro = c.obstaculos.some((o) => !(o.tipo === "colchoneta" && o.rampa) && o.z > c.z && o.z - c.z < c.vel * 0.42 && choca(o, c.carril, c.y, barriendo) && choca(o, c.x, c.y, barriendo));
    if (peligro) return "susto";
  }
  if (c.barrida > 0) return "barre";
  if (enAire(c)) return "salta";
  return "corre";
}

function polvo(x: number, z: number, n: number, fuerza: number, color = "rgba(220, 210, 230, 0.55)"): void {
  const y = carrera.suelo + 0.05;
  for (let k = 0; k < n; k++) {
    particulas.push({ x: x + (Math.random() - 0.5) * 0.4, y, z: z + Math.random() * 0.3, vx: (Math.random() - 0.5) * fuerza, vy: Math.random() * fuerza * 0.6, vida: 0.35 + Math.random() * 0.25, color, sigue: false, r: 0.05 + Math.random() * 0.05 });
  }
}

function ciclo(ahora: number): void {
  const dt = Math.min(0.04, (ahora - ultimo) / 1000);
  ultimo = ahora;
  reloj += dt;
  const aireAntes = enAire(carrera);
  const pasoAntes = Math.floor((carrera.z * 2.2) / Math.PI);
  if (estado === "jugando") {
    const antes = puntos(carrera);
    const ev = avanzar(carrera, dt);
    if (ev === "batido") {
      feliz = 0.6;
      letreros.push({ texto: `+${PUNTOS_BATIDO}`, vida: 1 });
      for (let k = 0; k < 10; k++) {
        const ang = Math.random() * Math.PI * 2;
        particulas.push({ x: carrera.x * CARRIL, y: 0.9 + carrera.y, z: carrera.z + 0.4, vx: Math.cos(ang) * 2.2, vy: 1 + Math.random() * 2.5, vida: 0.55, color: k % 2 ? "#ff6fd8" : "#fff6c9", sigue: true, r: 0.05 });
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
      polvo(carrera.x * CARRIL, carrera.z + 0.3, 14, 3);
      navigator.vibrate?.([40, 30, 60]);
      actualizar();
      terminarPartida();
    } else actualizar();
  } else if (estado === "inicio") {
    avanzar(carrera, dt);
    // La portada no acelera: corre siempre a la velocidad de salida.
    if (carrera.z > 200) carrera.z -= 200;
  }
  // Al caer de un salto se aplasta y levanta polvo; al correr, un poquito a cada paso.
  if (aireAntes && !enAire(carrera) && !carrera.terminada) { aterrizaje = 1; polvo(carrera.x * CARRIL, carrera.z, 8, 2.2); }
  const pasoAhora = Math.floor((carrera.z * 2.2) / Math.PI);
  if (pasoAhora !== pasoAntes && !enAire(carrera) && !carrera.terminada) polvo(carrera.x * CARRIL, carrera.z, carrera.barrida > 0 ? 3 : 1, 1.2);
  aterrizaje = Math.max(0, aterrizaje - dt * 5);
  camSuelo += (carrera.suelo - camSuelo) * Math.min(1, dt * 5);
  feliz = Math.max(0, feliz - dt);
  for (const p of particulas) {
    p.vida -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 9 * dt;
    if (p.sigue && estado === "jugando") p.z += carrera.vel * dt * 0.9;
  }
  particulas = particulas.filter((p) => p.vida > 0);
  if (particulas.length > 80) particulas = particulas.slice(-80);
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

// ── Dibujo (el escenario en `pesaRunEscena.ts`, la mancuerna en `pesaRunMancuerna.ts`) ──

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
  const camZ = carrera.z - CAM_ATRAS;
  const v = crearVista(W, H, carrera.x * CARRIL * 0.55, CAM_ALTO + camSuelo, camZ, camZ + VISTA_DIBUJO);
  pintarPasillo(c, v, carrera.z, reloj);

  // Dónde quedan los records: una línea en el piso con su nombre. Los puntos no son solo metros
  // (los batidos suman), así que la línea va donde se rebasaría ese récord sin tomar más batidos.
  const falta = carrera.z - puntos(carrera);
  if (estado !== "inicio") for (const m of marcasDe(tabla)) {
    const zr = m.puntos + falta;
    if (zr < v.camZ + 1 || zr > v.lejos) continue;
    const a = proyectar(v, -ORILLA, 0, zr), b = proyectar(v, ORILLA, 0, zr);
    c.globalAlpha = niebla(v, zr);
    c.strokeStyle = m.tuya ? "#ffd45c" : "#ff4fd8"; c.lineWidth = Math.max(1, a.s * 0.05);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    if (a.s > 12) {
      c.font = `800 ${Math.round(Math.min(14, a.s * 0.18))}px system-ui, sans-serif`; c.textAlign = "left"; c.fillStyle = c.strokeStyle;
      c.fillText(`${m.campeon ? "👑 " : ""}${m.texto} · ${m.puntos}`, Math.max(4, a.x + 4), a.y - 4);
    }
    c.globalAlpha = 1;
  }

  // De lo lejano a lo cercano: utilería, arcos, obstáculos, batidos y la mancuerna en su lugar.
  const cosas: Cosa[] = cosasDeEscena(c, v, reloj);
  for (const o of carrera.obstaculos) {
    if (o.z > v.lejos || o.z + largoDe(o) < v.camZ + 0.5) continue;
    // Las colchonetas se ordenan por su orilla del fondo: lo que va encima o a su lado (la
    // mancuerna, los batidos) se pinta después, por encima.
    const orden = o.tipo === "colchoneta" ? o.z + largoDe(o) : o.z;
    cosas.push({ z: orden, pintar: () => {
      c.globalAlpha = niebla(v, o.z);
      if (o.tipo === "colchoneta") pintarColchonetas(c, v, o);
      else if (o.tipo === "banca") pintarBanca(c, v, o);
      else if (o.tipo === "barra") pintarBarra(c, v, o);
      else pintarRack(c, v, o);
      c.globalAlpha = 1;
    } });
  }
  for (const b of carrera.batidos) {
    if (b.tomado || b.z > v.lejos || b.z < v.camZ + 0.8) continue;
    cosas.push({ z: b.z, pintar: () => { c.globalAlpha = niebla(v, b.z); pintarBatido(c, v, b, reloj); c.globalAlpha = 1; } });
  }
  const anim: AnimMancuerna = { reloj, gesto: gestoActual(), aterrizaje, suda: nivel(metros(carrera)) >= 3 };
  cosas.push({ z: carrera.z + 0.01, pintar: () => pintarMancuerna(c, v, carrera, anim) });
  cosas.sort((a, b) => b.z - a.z);
  for (const cosa of cosas) cosa.pintar();

  for (const p of particulas) {
    // El polvo que ya quedó atrás, junto a la cámara, se vería enorme.
    if (p.z < v.camZ + 3.4) continue;
    const pp = proyectar(v, p.x, p.y, p.z);
    c.globalAlpha = Math.max(0, Math.min(1, p.vida * 2));
    c.fillStyle = p.color; c.beginPath(); c.arc(pp.x, pp.y, Math.max(1, pp.s * p.r), 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  if (estado === "jugando") lineasVelocidad(c, v, carrera.vel);
  const yo = proyectar(v, carrera.x * CARRIL, carrera.y + 1.4, carrera.z);
  for (const l of letreros) {
    c.save(); c.font = `900 ${Math.round(yo.s * 0.3)}px system-ui, sans-serif`; c.textAlign = "center"; c.lineJoin = "round";
    const y = yo.y - (1 - l.vida) * yo.s * 0.6;
    c.globalAlpha = Math.max(0, l.vida);
    c.strokeStyle = "#7a1a5c"; c.lineWidth = Math.max(2, yo.s * 0.05); c.strokeText(l.texto, yo.x, y);
    c.fillStyle = "#ffd45c"; c.fillText(l.texto, yo.x, y); c.restore();
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
    // Un solo movimiento por toque (entrenador, 2026-11-27: con un deslizar largo se cambiaba
    // de dos carriles): para otro, hay que levantar el dedo y volver a deslizar.
    gesto = null;
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
