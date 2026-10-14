/**
 * Jalar hacia abajo la hoja de detalle de un músculo para cerrarla (backlog 2, punto 15.2): la
 * barrita de arriba invitaba al gesto y no hacía nada. La hoja sigue al dedo y, al soltar, se
 * cierra si bajó lo suficiente o fue un tirón rápido; si no, regresa a su lugar.
 *
 * El gesto se toma solo en la zona de la barrita (`.hoja-agarre`, con `touch-action: none`): el
 * resto de la hoja se desplaza con el dedo cuando el contenido no cabe, y ese desplazamiento no
 * debe cerrarla.
 */

/** Distancia que basta por sí sola. */
const DISTANCIA = 80;
/** Más corto que eso, cuenta si fue rápido (px/ms): un tirón. */
const DISTANCIA_MINIMA = 30;
const VELOCIDAD = 0.5;

/** Si al soltar se cierra (`dy` positivo = hacia abajo). */
export function decidirCierre(dy: number, ms: number): boolean {
  if (dy <= 0) return false;
  return dy >= DISTANCIA || (dy >= DISTANCIA_MINIMA && dy / Math.max(ms, 1) >= VELOCIDAD);
}

function sinMovimiento(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Cuelga el gesto de la hoja recién pintada. `cerrar` es lo mismo que tocar el ✕. */
export function conectarHoja(hoja: HTMLElement | null, cerrar: () => void): void {
  const agarre = hoja?.querySelector<HTMLElement>(".hoja-agarre");
  if (!hoja || !agarre) return;
  let inicio: { y: number; t: number; id: number } | null = null;

  agarre.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    inicio = { y: ev.clientY, t: performance.now(), id: ev.pointerId };
    agarre.setPointerCapture(ev.pointerId);
    hoja.style.transition = "none";
    hoja.style.animation = "none";
  });

  agarre.addEventListener("pointermove", (ev) => {
    if (!inicio || ev.pointerId !== inicio.id || sinMovimiento()) return;
    const dy = ev.clientY - inicio.y;
    // Hacia arriba apenas cede, como una liga: la hoja ya está abierta del todo.
    hoja.style.transform = `translateY(${dy > 0 ? dy : dy * 0.15}px)`;
  });

  const terminar = (ev: PointerEvent) => {
    if (!inicio || ev.pointerId !== inicio.id) return;
    const dy = ev.clientY - inicio.y;
    const ms = performance.now() - inicio.t;
    inicio = null;
    hoja.style.transition = "transform 0.22s cubic-bezier(.2,.8,.2,1)";
    if (ev.type === "pointerup" && decidirCierre(dy, ms)) {
      if (sinMovimiento()) { cerrar(); return; }
      hoja.style.transform = "translateY(100%)";
      hoja.addEventListener("transitionend", () => cerrar(), { once: true });
      // Por si el navegador no avisa del final de la transición.
      setTimeout(() => { if (hoja.isConnected) cerrar(); }, 300);
      return;
    }
    hoja.style.transform = "";
  };
  agarre.addEventListener("pointerup", terminar);
  agarre.addEventListener("pointercancel", terminar);
}
