/**
 * Jalar desde la orilla derecha hacia la izquierda abre el menú lateral, que sale por ese
 * mismo lado, en las tres pestañas de la barra (Inicio, Músculos y Registro). Pedido del
 * entrenador, 2026-10-13: primero era deslizar hacia la derecha, y lo cambió a jalar el menú
 * desde su orilla.
 *
 * Se escucha en todo el documento con `touchstart`/`touchend` pasivos: no se bloquea nunca el
 * scroll, solo se mira hacia dónde se movió el dedo al soltar. Pointer events no sirven aquí:
 * el navegador los cancela (`pointercancel`) en cuanto decide que el gesto es scroll.
 */

/**
 * Qué tan cerca de la orilla derecha tiene que empezar el dedo (px). Generoso a propósito: en
 * Android con navegación por gestos, los primeros píxeles de la orilla son del sistema ("atrás").
 */
export const ORILLA = 48;
/** Distancia que basta por sí sola. */
const DISTANCIA = 80;
/** Más corto que eso, cuenta si fue rápido (px/ms): un "flick". */
const DISTANCIA_MINIMA = 40;
const VELOCIDAD = 0.5;

/**
 * Si el gesto abre el menú: tiene que empezar en la orilla derecha (`x0` contra `ancho`, el de
 * la ventana) y moverse hacia la izquierda (`dx` negativo), lo bastante o lo bastante rápido.
 * Tiene que ser claramente horizontal, para no confundirse con bajar la página.
 */
export function abreMenu(x0: number, ancho: number, dx: number, dy: number, ms: number): boolean {
  if (x0 < ancho - ORILLA) return false;
  const largo = -dx;
  if (largo <= 0) return false;
  if (largo < 1.5 * Math.abs(dy)) return false;
  const rapido = largo >= DISTANCIA_MINIMA && largo / Math.max(ms, 1) >= VELOCIDAD;
  return largo >= DISTANCIA || rapido;
}

/**
 * Lo que tiene su propio gesto de lado, o donde deslizar es escribir o mover algo: ahí el
 * gesto no es del menú. La tarjeta del ejercicio en Registro cambia de ejercicio deslizando.
 */
const PROPIOS = "input, textarea, select, [contenteditable], .registro-ejercicio.activo, [data-sin-deslizar-menu]";

function esPropio(el: EventTarget | null): boolean {
  return el instanceof Element && el.closest(PROPIOS) !== null;
}

/** Un diálogo abierto (peso, explicación de rangos, ruleta) se queda con todos los gestos. */
function hayDialogo(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

/**
 * Cuelga el gesto una sola vez, sobre el documento. `puede` dice si la ventana actual lo
 * acepta (una de la barra, con el menú cerrado); `abrir` es el mismo `abrirMenu` del ☰.
 */
export function conectarDeslizarMenu(puede: () => boolean, abrir: () => void): void {
  let inicio: { x: number; y: number; t: number } | null = null;

  document.addEventListener("touchstart", (ev) => {
    inicio = null;
    if (ev.touches.length !== 1 || esPropio(ev.target) || hayDialogo() || !puede()) return;
    const t = ev.touches[0];
    inicio = { x: t.clientX, y: t.clientY, t: performance.now() };
  }, { passive: true });

  document.addEventListener("touchend", (ev) => {
    const desde = inicio;
    inicio = null;
    const t = ev.changedTouches[0];
    if (!desde || !t || !puede()) return;
    const dx = t.clientX - desde.x;
    if (abreMenu(desde.x, window.innerWidth, dx, t.clientY - desde.y, performance.now() - desde.t)) abrir();
  }, { passive: true });

  document.addEventListener("touchcancel", () => { inicio = null; }, { passive: true });
}
