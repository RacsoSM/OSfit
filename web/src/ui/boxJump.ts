import {
  ANCHO, ALTO_CAJON, METROS_POR_PISO, RADIO, UNIDADES_POR_METRO, avanzar, metros, nuevoSalto, piso, type Cajon, type Salto,
} from "../boxJump";
import { conPartida, htmlLista, type ApiJuego, type EnvioPartida, type TablaDiscos } from "./juegoDiscos";
import { ZONAS, decoracion, pintarPolvo, ruido, type Zona } from "./gimnasioFondo";
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
let zonaAnterior: number | null = null;
let mezcla = 1;
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
        <p class="jd-capa-texto">Rebotas sola sobre los cajones: arrastra el dedo hacia donde quieres ir para subir el edificio OSFIT. Cada metro es un punto. Cuidado con los cajones de espuma: se rompen. Los trampolines te dan un súper salto.</p>
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
      <p class="jd-capa-texto">${puntos === 1 ? "metro subido" : "metros subidos"} · Piso ${pisoAlcanzado}, ${escapar(ZONAS[pisoAlcanzado - 1]?.nombre ?? "")}</p>
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
  const pis = q("#bj-piso"); if (pis) pis.textContent = `Piso ${pisoVisto} · ${ZONAS[pisoVisto - 1]!.nombre}`;
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
  pisoVisto = 1; zonaAnterior = null; mezcla = 1; anuncio = null;
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
      zonaAnterior = pisoVisto - 1;
      pisoVisto = p;
      mezcla = 0;
      anuncio = { piso: p, zona: ZONAS[p - 1]!.nombre, vida: 2.2 };
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
  mezcla = Math.min(1, mezcla + dt / 1.2);
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

/** El edificio OSFIT en la zona `z`: pared, ventanales, decoración y las losas de cada piso. */
function pintarEdificio(c: CanvasRenderingContext2D, z: Zona, W: number, H: number, e: number, cam: number, t: number): void {
  const pared = c.createLinearGradient(0, 0, 0, H);
  pared.addColorStop(0, z.pared[0]); pared.addColorStop(1, z.pared[1]);
  c.fillStyle = pared; c.fillRect(-20, -20, W + 40, H + 40);
  // Ventanales (0.3): dos columnas; la ciudad se ve más abajo conforme se sube.
  const lejos = cam * 0.3 * e, paso = 74 * e;
  const altura = Math.min(1, Math.max(0, cam / (METROS_POR_PISO * UNIDADES_POR_METRO * 6)));
  for (let i = Math.floor(-lejos / paso) - 2; ; i++) {
    const y = H - (i * paso + lejos) - 40 * e;
    if (y < -paso) break;
    if (y > H + paso) continue;
    for (const [col, vx] of [[0, 6], [1, 58]] as const) {
      if (ruido(i * 7 + col) < 0.25) continue;
      const x = vx * e, w = 36 * e, h = 42 * e;
      const cielo = c.createLinearGradient(0, y, 0, y + h);
      cielo.addColorStop(0, z.cielo[0]); cielo.addColorStop(1, z.cielo[1]);
      c.fillStyle = cielo; c.fillRect(x, y, w, h);
      c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
      const noche = z.astro === "luna" || z.astro === "ninguno";
      if (noche) for (let k = 0; k < 7; k++) { c.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(t + k + i))})`; c.fillRect(x + ruido(i * 13 + k + col) * w, y + ruido(i * 17 + k) * h * 0.5, 1.5, 1.5); }
      // La ciudad: entre más alto, más abajo y más chica.
      for (let k = 0; k < 6; k++) {
        const bh = (6 + ruido(i * 7 + k + col * 3) * 16) * e * (1 - altura * 0.7);
        const bx = x + (k * w) / 6;
        c.fillStyle = noche ? "#0d1130" : "rgba(60, 70, 100, 0.75)";
        c.fillRect(bx, y + h - bh, w / 6 - 1.5, bh);
        if (noche) { c.fillStyle = "rgba(255, 214, 120, 0.7)"; for (let v = 0; v < 4; v++) if (ruido(i * 31 + k * 5 + v + col) > 0.5) c.fillRect(bx + 2, y + h - bh + 3 + v * 5, 2, 2); }
      }
      c.restore();
      c.strokeStyle = "#3b2d4d"; c.lineWidth = Math.max(2, e * 0.8);
      c.strokeRect(x, y, w, h);
      c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.stroke();
    }
  }
  // Decoración de la pared (0.6): la misma de cada zona en Kettlebell Bird, en huecos alternados.
  const medio = cam * 0.6 * e, paso2 = 96 * e;
  for (let i = Math.floor(-medio / paso2) - 2; ; i++) {
    const y = H - (i * paso2 + medio) - 60 * e;
    if (y < -paso2) break;
    if (y > H + paso2) continue;
    c.save();
    c.translate(i % 2 ? 44 * e : -2 * e, y - 10 * e);
    c.globalAlpha *= 0.9;
    decoracion(c, z, i, 0, e, t);
    c.restore();
  }
  // Marcas de metros en la pared y la losa de cada piso.
  const sy = (h: number) => H - (h - cam) * e;
  for (let m = Math.ceil(cam / UNIDADES_POR_METRO / 10) * 10; m * UNIDADES_POR_METRO < cam + H / e + 20; m += 10) {
    const y = sy(m * UNIDADES_POR_METRO);
    if (m % METROS_POR_PISO === 0) continue;
    c.strokeStyle = "rgba(255, 255, 255, 0.07)"; c.setLineDash([4, 7]);
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); c.setLineDash([]);
    c.fillStyle = "rgba(255, 255, 255, 0.35)"; c.font = "700 11px system-ui, sans-serif"; c.textAlign = "left";
    c.fillText(`${m} m`, 6, y - 4);
  }
}

/** La losa de concreto de cada piso, con su número y su zona. */
function pintarLosas(c: CanvasRenderingContext2D, W: number, H: number, e: number, cam: number): void {
  const sy = (h: number) => H - (h - cam) * e;
  const porPiso = METROS_POR_PISO * UNIDADES_POR_METRO;
  for (let k = Math.max(1, Math.floor(cam / porPiso)); k * porPiso < cam + H / e + 20; k++) {
    const y = sy(k * porPiso);
    const g = c.createLinearGradient(0, y - 3 * e, 0, y + 3 * e);
    g.addColorStop(0, "#5a5560"); g.addColorStop(0.4, "#8c8790"); g.addColorStop(1, "#3a3640");
    c.fillStyle = g; c.fillRect(0, y - 3 * e, W, 6 * e);
    c.fillStyle = "rgba(0, 0, 0, 0.3)"; for (let x = mod(k * 17, 30) * e; x < W; x += 30 * e) c.fillRect(x, y - 3 * e, 1, 6 * e);
    const n = Math.min(ZONAS.length, k + 1);
    c.save();
    c.font = `900 ${Math.round(3.4 * e)}px ui-monospace, "SF Mono", Menlo, monospace`;
    c.textAlign = "right"; c.textBaseline = "middle"; c.fillStyle = "#ffd45c";
    c.fillText(`PISO ${n} · ${ZONAS[n - 1]!.nombre.toUpperCase()}`, W - 6, y);
    c.restore();
  }
}

/** Un cajón de salto en 3/4: tapa y frente, según su tipo. */
function pintarCajon(c: CanvasRenderingContext2D, cj: Cajon, x: number, y: number, w: number, e: number, t: number): void {
  const alto = ALTO_CAJON * e, prof = 2.4 * e;
  const tipo = cj.tipo;
  const [frente1, frente2, tapa, linea] = tipo === "espuma"
    ? ["#e2475c", "#b32c41", "#f26b7d", "rgba(255,255,255,0.35)"]
    : tipo === "movil" ? ["#3a6fd8", "#244a99", "#5b8ef0", "rgba(255,255,255,0.25)"]
    : ["#b07a45", "#7a5230", "#d6a46a", "rgba(70, 40, 15, 0.45)"];
  // Sombra de contacto debajo.
  c.fillStyle = "rgba(0, 0, 0, 0.28)";
  redondeado(c, x + 2, y + alto - 1, w, 3, 2); c.fill();
  // Tapa (un poco en perspectiva).
  c.fillStyle = tapa;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w - prof * 0.6, y - prof); c.lineTo(x + prof * 0.6, y - prof); c.closePath(); c.fill();
  // Frente.
  const g = c.createLinearGradient(0, y, 0, y + alto);
  g.addColorStop(0, frente1); g.addColorStop(1, frente2);
  c.fillStyle = g;
  if (tipo === "espuma") { redondeado(c, x, y, w, alto, alto * 0.25); c.fill(); }
  else c.fillRect(x, y, w, alto);
  c.save(); c.beginPath(); c.rect(x, y, w, alto); c.clip();
  if (tipo === "firme") {
    // Vetas de madera y el estarcido.
    c.strokeStyle = linea; c.lineWidth = 1;
    for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x, y + (alto * k) / 4 + Math.sin(k + x) * 1.5); c.bezierCurveTo(x + w * 0.3, y + (alto * k) / 4 - 2, x + w * 0.7, y + (alto * k) / 4 + 2, x + w, y + (alto * k) / 4); c.stroke(); }
    if (w > 40) { c.fillStyle = "rgba(30, 18, 8, 0.55)"; c.font = `900 ${Math.round(alto * 0.42)}px ui-monospace, monospace`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("OSFIT", x + w / 2, y + alto * 0.55); }
  } else if (tipo === "movil") {
    // Franjas de peligro y flechas.
    for (let k = -2; k < w / (alto * 0.5) + 2; k++) {
      c.fillStyle = k % 2 ? "#ffd400" : "#1a1a1a";
      c.beginPath(); const sx = x + k * alto * 0.5; c.moveTo(sx, y + alto * 0.7); c.lineTo(sx + alto * 0.5, y + alto * 0.7); c.lineTo(sx + alto * 0.8, y + alto); c.lineTo(sx + alto * 0.3, y + alto); c.fill();
    }
    c.fillStyle = "rgba(255,255,255,0.85)"; c.font = `900 ${Math.round(alto * 0.4)}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(cj.vx < 0 ? "◀  ◀" : "▶  ▶", x + w / 2, y + alto * 0.35);
  } else {
    // Costura de la espuma.
    c.strokeStyle = linea; c.setLineDash([3, 3]); c.lineWidth = 1;
    redondeado(c, x + 3, y + 3, w - 6, alto - 6, alto * 0.2); c.stroke(); c.setLineDash([]);
  }
  c.restore();
  // Brillo de arriba.
  c.fillStyle = "rgba(255, 255, 255, 0.18)"; c.fillRect(x + 1, y, w - 2, 1.2);
  if (cj.trampolin) pintarTrampolin(c, x + w / 2, y - prof * 0.5, Math.min(w * 0.42, 9 * e), e, t);
}

function pintarTrampolin(c: CanvasRenderingContext2D, cx: number, y: number, r: number, e: number, t: number): void {
  const ry = r * 0.28, alto = 3 * e;
  // Patas.
  c.strokeStyle = "#9aa0a8"; c.lineWidth = Math.max(1.5, e * 0.4);
  for (const dx of [-0.8, 0.8]) { c.beginPath(); c.moveTo(cx + dx * r, y - alto); c.lineTo(cx + dx * r * 1.05, y); c.stroke(); }
  // Aro y lona.
  const pulso = 1 + Math.sin(t * 8) * 0.04;
  c.fillStyle = "#14151a"; c.beginPath(); c.ellipse(cx, y - alto, r * 0.86, ry * 0.86 * pulso, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#2a6fd6"; c.lineWidth = Math.max(2, e * 0.6); c.beginPath(); c.ellipse(cx, y - alto, r, ry, 0, 0, Math.PI * 2); c.stroke();
  // Resortes.
  c.strokeStyle = "#c9cdd3"; c.lineWidth = 1;
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * r * 0.86, y - alto + Math.sin(a) * ry * 0.86); c.lineTo(cx + Math.cos(a) * r, y - alto + Math.sin(a) * ry); c.stroke(); }
  c.fillStyle = "rgba(126, 243, 255, 0.85)"; c.font = `900 ${Math.round(e * 2.2)}px system-ui, sans-serif`; c.textAlign = "center";
  c.fillText("▲", cx, y - alto - ry - 2 * e + Math.sin(t * 5) * e * 0.6);
}

/** La clienta: su inicial en un círculo con aro de neón, sus tenis y el aplaste del rebote. */
function pintarAvatar(c: CanvasRenderingContext2D, x: number, y: number, r: number, inicial: string, subiendo: boolean): void {
  c.save();
  c.translate(x, y);
  c.scale(1 / Math.sqrt(aplaste), aplaste);
  // Tenis.
  const pies = subiendo ? r * 0.15 : r * 0.35;
  for (const lado of [-1, 1]) {
    c.fillStyle = "#f2f2f2";
    redondeado(c, lado * r * 0.45 - r * 0.28, r * 0.78 + pies, r * 0.56, r * 0.3, r * 0.14); c.fill();
    c.fillStyle = "#ff3bd4"; c.fillRect(lado * r * 0.45 - r * 0.28, r * 0.78 + pies + r * 0.2, r * 0.56, r * 0.08);
  }
  // Aro de neón y cuerpo.
  c.shadowColor = "#7ef3ff"; c.shadowBlur = r * 0.6;
  c.fillStyle = "#7ef3ff"; c.beginPath(); c.arc(0, 0, r * 1.08, 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0;
  const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#ff7ae0"); g.addColorStop(0.6, "#b23ad8"); g.addColorStop(1, "#5a1f9e");
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  // Banda en la frente, como de gym.
  c.fillStyle = "#ffd45c"; c.fillRect(-r * 0.92, -r * 0.62, r * 1.84, r * 0.2);
  c.fillStyle = "#fff"; c.font = `900 ${Math.round(r * 1.05)}px system-ui, -apple-system, sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(inicial, 0, r * 0.14);
  c.fillStyle = "rgba(255, 255, 255, 0.25)"; c.beginPath(); c.ellipse(-r * 0.35, -r * 0.2, r * 0.25, r * 0.4, -0.5, 0, Math.PI * 2); c.fill();
  c.restore();
}

function dibujar(dt: number): void {
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
  const zona = ZONAS[pisoVisto - 1]!;
  if (zonaAnterior !== null && mezcla < 1) {
    pintarEdificio(c, ZONAS[zonaAnterior]!, W, H, e, cam, reloj);
    c.globalAlpha = mezcla;
    pintarEdificio(c, zona, W, H, e, cam, reloj);
    c.globalAlpha = 1;
  } else pintarEdificio(c, zona, W, H, e, cam, reloj);
  pintarLosas(c, W, H, e, cam);
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
    pintarCajon(c, cj, cj.x * e, y, cj.ancho * e, e, reloj);
  }
  // La espuma rota: dos mitades que caen girando.
  for (const pz of pedazos) {
    const w = (pz.cajon.ancho / 2) * e;
    const x = (pz.cajon.x + (pz.lado > 0 ? pz.cajon.ancho / 2 : 0) + pz.dx) * e;
    const y = sy(pz.cajon.h + pz.dh);
    c.save(); c.translate(x + w / 2, y); c.rotate(pz.giro); c.globalAlpha = 0.85;
    pintarCajon(c, { ...pz.cajon, ancho: pz.cajon.ancho / 2, trampolin: false }, -w / 2, 0, w, e, reloj);
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
  pintarPolvo(c, zona, W, H, dt, reloj);
  if (anuncio && anuncio.vida > 0) {
    const a = Math.min(1, anuncio.vida * 1.5), s2 = 1 + Math.max(0, anuncio.vida - 1.6) * 1.2;
    c.save(); c.translate(W / 2, H * 0.34); c.scale(s2, s2);
    c.textAlign = "center"; c.textBaseline = "middle";
    c.shadowColor = "#ff3bd4"; c.shadowBlur = 18; c.fillStyle = `rgba(255, 255, 255, ${a})`;
    c.font = `900 ${Math.round(11 * e)}px system-ui, sans-serif`; c.fillText(`PISO ${anuncio.piso}`, 0, 0);
    c.shadowColor = "#7ef3ff"; c.shadowBlur = 10; c.fillStyle = `rgba(126, 243, 255, ${a})`;
    c.font = `800 ${Math.round(4.4 * e)}px ui-monospace, "SF Mono", Menlo, monospace`; c.fillText(anuncio.zona.toUpperCase(), 0, 9 * e);
    c.restore();
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (destello > 0) { c.fillStyle = `rgba(255, 255, 255, ${destello * 0.5})`; c.fillRect(0, 0, W, H); }
  const vin = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8);
  vin.addColorStop(0, "rgba(0, 0, 0, 0)"); vin.addColorStop(1, "rgba(0, 0, 0, 0.4)");
  c.fillStyle = vin; c.fillRect(0, 0, W, H);
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
