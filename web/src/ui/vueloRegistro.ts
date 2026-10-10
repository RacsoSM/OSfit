/**
 * La animación de Registro al elegir un ejercicio: su GIF despega del grid, se eleva, vuela en
 * arco y aterriza en la miniatura de la tarjeta nueva del entrenamiento, mientras la pantalla
 * nueva aparece debajo. Al llegar, la tarjeta se ilumina un instante.
 *
 * Se hace con un clon del GIF fijo en pantalla (`position: fixed`, colgado de `body`): el grid
 * desaparece en cuanto se repinta, y el clon tiene que sobrevivir a ese repintado. La
 * trayectoria es una cuenta pura (`trayectoria`) para poder probarla sin DOM.
 *
 * Con "reducir movimiento" activado en el teléfono no hay vuelo: la tarjeta solo aparece.
 */

export interface Caja { left: number; top: number; width: number; height: number; }
export interface Punto { x: number; y: number; escala: number; }

/** Cuánto sube el arco sobre la recta, en px. Con tope para que un recorrido largo no salga volando. */
const ALTURA_ARCO = 60;

/**
 * Los desplazamientos (con origen en la esquina superior izquierda del clon) a medio camino y
 * al final. El punto medio va por encima de la recta: así el GIF describe un arco y no una
 * línea, que es lo que hace que se lea como "lo lancé hacia allá".
 */
export function trayectoria(desde: Caja, hasta: Caja): { medio: Punto; fin: Punto } {
  const fin: Punto = {
    x: hasta.left - desde.left,
    y: hasta.top - desde.top,
    escala: hasta.width / desde.width,
  };
  const arco = Math.min(ALTURA_ARCO, Math.abs(fin.y) * 0.25 + 20);
  return {
    medio: { x: fin.x / 2, y: fin.y / 2 - arco, escala: (1 + fin.escala) / 2 },
    fin,
  };
}

function sinMovimiento(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const ELEVADO = 1.06;
const SOMBRA = "0 18px 40px rgba(0, 0, 0, 0.45)";

/**
 * Despega el GIF tocado: deja un clon fijo exactamente encima y lo eleva un poco. Devuelve el
 * clon para `aterrizar`, o null si no hay animación (reducir movimiento, sin `animate`).
 */
export function despegar(origen: HTMLElement | null): HTMLElement | null {
  if (!origen || sinMovimiento() || typeof origen.animate !== "function") return null;
  const r = origen.getBoundingClientRect();
  const clon = origen.cloneNode(true) as HTMLElement;
  clon.removeAttribute("loading");
  clon.classList.add("registro-vuelo");
  Object.assign(clon.style, {
    position: "fixed", left: `${r.left}px`, top: `${r.top}px`,
    width: `${r.width}px`, height: `${r.height}px`, margin: "0",
  });
  document.body.appendChild(clon);
  clon.animate(
    [{ transform: "scale(1)", boxShadow: "none" }, { transform: `scale(${ELEVADO})`, boxShadow: SOMBRA }],
    { duration: 140, easing: "ease-out", fill: "forwards" }
  );
  return clon;
}

/**
 * Lleva el clon hasta el GIF de la tarjeta nueva. El destino se esconde mientras el clon vuela
 * y aparece justo cuando aterriza, para que se vea como el mismo objeto. Si no hubo despegue,
 * solo trae la tarjeta a la vista.
 */
export function aterrizar(clon: HTMLElement | null, tarjeta: HTMLElement | null): void {
  const destino = tarjeta?.querySelector<HTMLElement>(".registro-ej-gif") ?? null;
  // Instantáneo y antes de medir: el clon está fijo en pantalla, así que mover la página no
  // lo afecta, y el destino tiene que estar ya donde va a quedar.
  tarjeta?.scrollIntoView({ block: "center" });

  if (!clon || !tarjeta || !destino) {
    clon?.remove();
    return;
  }

  const desde: Caja = {
    left: parseFloat(clon.style.left), top: parseFloat(clon.style.top),
    width: parseFloat(clon.style.width), height: parseFloat(clon.style.height),
  };
  const { medio, fin } = trayectoria(desde, destino.getBoundingClientRect());
  const radio = getComputedStyle(destino).borderRadius || "10px";
  destino.style.visibility = "hidden";

  const contenido = tarjeta.closest<HTMLElement>("#registro");
  contenido?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
  tarjeta.animate(
    [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
    { duration: 380, delay: 160, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }
  );

  const vuelo = clon.animate(
    [
      { transform: `translate(0, 0) scale(${ELEVADO})`, boxShadow: SOMBRA },
      { transform: `translate(${medio.x}px, ${medio.y}px) scale(${medio.escala})`, boxShadow: SOMBRA, offset: 0.55 },
      { transform: `translate(${fin.x}px, ${fin.y}px) scale(${fin.escala})`, boxShadow: "none", borderRadius: radio },
    ],
    { duration: 620, easing: "cubic-bezier(.45,.05,.25,1)", fill: "forwards" }
  );
  const terminar = () => {
    destino.style.visibility = "";
    clon.remove();
    tarjeta.animate(
      [
        { boxShadow: "0 0 0 0 color-mix(in srgb, var(--primario) 55%, transparent)" },
        { boxShadow: "0 0 0 10px color-mix(in srgb, var(--primario) 0%, transparent)" },
      ],
      { duration: 650, easing: "ease-out" }
    );
  };
  vuelo.onfinish = terminar;
  vuelo.oncancel = terminar;
}
