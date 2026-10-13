/**
 * Deslizar el dedo hacia la derecha, hacia el lado del ☰, abre el menú lateral en las tres
 * pestañas de la barra (Inicio, Músculos y Registro). Pedido del entrenador, 2026-10-13.
 *
 * Se escucha en todo el documento con `touchstart`/`touchend` pasivos: no se bloquea nunca el
 * scroll, solo se mira hacia dónde se movió el dedo al soltar. Pointer events no sirven aquí:
 * el navegador los cancela (`pointercancel`) en cuanto decide que el gesto es scroll.
 */

/** Distancia que basta por sí sola. */
const DISTANCIA = 80;
/** Más corto que eso, cuenta si fue rápido (px/ms): un "flick". */
const DISTANCIA_MINIMA = 40;
const VELOCIDAD = 0.5;

/**
 * Si el gesto abre el menú, según cuánto se movió el dedo (`dx` positivo = a la derecha) y en
 * cuánto tiempo. Tiene que ser claramente horizontal, para no confundirse con bajar la página.
 */
export function abreMenu(dx: number, dy: number, ms: number): boolean {
  if (dx <= 0) return false;
  if (dx < 1.5 * Math.abs(dy)) return false;
  const rapido = dx >= DISTANCIA_MINIMA && dx / Math.max(ms, 1) >= VELOCIDAD;
  return dx >= DISTANCIA || rapido;
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
    if (abreMenu(t.clientX - desde.x, t.clientY - desde.y, performance.now() - desde.t)) abrir();
  }, { passive: true });

  document.addEventListener("touchcancel", () => { inicio = null; }, { passive: true });
}
