/**
 * Deslizar de lado la tarjeta del ejercicio activo para cambiar de ejercicio en el
 * entrenamiento en curso: a la izquierda el siguiente, a la derecha el anterior.
 *
 * De lado y no de arriba abajo, a propósito: arriba y abajo es recorrer la página, y la clienta
 * baja todo el tiempo para ver sus series. Con `touch-action: pan-y` en la tarjeta, el
 * navegador se queda con el desplazamiento vertical y nos entrega solo el horizontal.
 *
 * El cambio en sí no vive aquí: lo hace `ir` (de `ui/registro.ts`), el mismo camino que
 * Anterior/Siguiente, con su vuelo del GIF. Aquí solo se decide si el gesto cuenta.
 */

/** Distancia que basta por sí sola. */
const DISTANCIA = 70;
/** Más corto que eso, cuenta si fue rápido (px/ms): un "flick". */
const DISTANCIA_MINIMA = 30;
const VELOCIDAD = 0.45;

/**
 * Qué hacer al soltar, según cuánto se movió el dedo (`dx` negativo = a la izquierda) y en
 * cuánto tiempo. Null: no fue un cambio (corto y lento, o más vertical que horizontal).
 */
export function decidirDeslizamiento(dx: number, dy: number, ms: number): "siguiente" | "anterior" | null {
  const largo = Math.abs(dx);
  if (largo < 1.2 * Math.abs(dy)) return null;
  const rapido = largo >= DISTANCIA_MINIMA && largo / Math.max(ms, 1) >= VELOCIDAD;
  if (largo < DISTANCIA && !rapido) return null;
  return dx < 0 ? "siguiente" : "anterior";
}

function sinMovimiento(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Lo que empieza sobre un campo o un botón no es un deslizamiento: es escribir o tocar. */
function esInteractivo(el: EventTarget | null): boolean {
  return el instanceof Element && el.closest("input, button, label") !== null;
}

/**
 * Cuelga el gesto de la tarjeta activa recién pintada. `ir` cambia de ejercicio; si no hay
 * otro por ese lado, la tarjeta regresa a su lugar.
 */
export function conectarDeslizar(
  tarjeta: HTMLElement | null,
  ir: (hacia: "siguiente" | "anterior") => void
): void {
  if (!tarjeta) return;
  const anterior = tarjeta.querySelector<HTMLButtonElement>('.registro-nav-boton:first-child');
  const siguiente = tarjeta.querySelector<HTMLButtonElement>('.registro-nav-boton:last-child');
  if (!anterior && !siguiente) return; // un solo ejercicio: no hay a dónde ir

  let inicio: { x: number; y: number; t: number; id: number } | null = null;
  let arrastrando = false;

  const soltar = (dx: number) => {
    tarjeta.style.transition = "transform 0.25s cubic-bezier(.2,.8,.2,1)";
    tarjeta.style.transform = "";
    if (dx !== 0) tarjeta.addEventListener("transitionend", () => { tarjeta.style.transition = ""; }, { once: true });
  };

  // Arrastrar sobre el GIF dispararía el "arrastrar imagen" del navegador, que cancela el gesto
  // (`pointercancel`) antes de que cuente.
  tarjeta.addEventListener("dragstart", (ev) => ev.preventDefault());

  tarjeta.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    if (esInteractivo(ev.target)) return;
    inicio = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId };
    arrastrando = false;
    tarjeta.style.transition = "";
  });

  tarjeta.addEventListener("pointermove", (ev) => {
    if (!inicio || ev.pointerId !== inicio.id) return;
    const dx = ev.clientX - inicio.x;
    const dy = ev.clientY - inicio.y;
    if (!arrastrando) {
      // Se decide la dirección con los primeros píxeles: vertical, se suelta y es scroll.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { inicio = null; return; }
      arrastrando = true;
      tarjeta.setPointerCapture(ev.pointerId);
    }
    if (sinMovimiento()) return;
    // En los extremos resiste, como una liga: se nota que no hay más ejercicios por ese lado.
    const sinDestino = (dx < 0 && (!siguiente || siguiente.disabled)) || (dx > 0 && (!anterior || anterior.disabled));
    const x = sinDestino ? dx * 0.25 : dx * 0.85;
    tarjeta.style.transform = `translateX(${x}px) rotate(${x / 60}deg)`;
  });

  const terminar = (ev: PointerEvent) => {
    if (!inicio || ev.pointerId !== inicio.id) return;
    const dx = ev.clientX - inicio.x;
    const dy = ev.clientY - inicio.y;
    const ms = performance.now() - inicio.t;
    inicio = null;
    if (!arrastrando) return;
    arrastrando = false;
    const decision = ev.type === "pointerup" ? decidirDeslizamiento(dx, dy, ms) : null;
    const boton = decision === "siguiente" ? siguiente : decision === "anterior" ? anterior : null;
    if (decision && boton && !boton.disabled) {
      ir(decision);
    } else {
      soltar(dx);
    }
  };
  tarjeta.addEventListener("pointerup", terminar);
  tarjeta.addEventListener("pointercancel", terminar);
}
