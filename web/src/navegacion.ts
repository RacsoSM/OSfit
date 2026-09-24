import type { IdVentana } from "./ventanas";

/**
 * Qué ventana está abierta y si el menú lateral también, sincronizado con el botón "atrás".
 *
 * El estado vive acá y no en `pintar()`, por lo mismo que el de las acciones: `pintar()`
 * corre en cada snapshot de Firestore, y una ventana guardada ahí regresaría a la clienta a
 * Inicio cada vez que el entrenador marcara una asistencia.
 *
 * La ventana va en `history.state` y NUNCA en la dirección. El `#` ya está tomado:
 * `firebase.ts` lo lee como el token que se escondía ahí antes, así que un `#medallas` se
 * canjearía como token. La ruta tampoco, porque `resolverSesion` decide con ella si hay que
 * canjear. Con la URL quieta, la sesión no se entera de que existen ventanas.
 *
 * El historial nunca pasa de `[Inicio, ventana]`, más la entrada del menú mientras está
 * abierto: así "atrás" desde cualquier ventana vuelve a Inicio y no recorre todo lo visitado.
 *
 * Es el único módulo que toca `history`, y lo recibe inyectado para poder probarlo.
 */

/** Lo que se usa de `window.history`. */
export interface Historial {
  readonly state: unknown;
  pushState(estado: unknown): void;
  replaceState(estado: unknown): void;
  back(): void;
  alRetroceder(escucha: () => void): void;
}

let historial: Historial | null = null;
let avisar: () => void = () => {};
let activa: IdVentana = "inicio";
let menu = false;
/** La ventana elegida en el menú, que se abre en cuanto el menú termine de cerrarse. */
let pendiente: IdVentana | null = null;
/**
 * Hay un `back()` en vuelo. `history.back()` es asíncrono: hasta que llega su `popstate`, un
 * `pushState` se metería en medio y dejaría una entrada de menú huérfana. Mientras tanto se
 * ignoran los toques; el hueco dura milisegundos.
 */
let esperando = false;

function leer(estado: unknown): { ventana: IdVentana; menu: boolean } {
  const e = (estado ?? {}) as { ventana?: unknown; menu?: unknown };
  return {
    ventana: typeof e.ventana === "string" ? (e.ventana as IdVentana) : "inicio",
    menu: e.menu === true,
  };
}

/** Ir a una ventana con el menú ya cerrado. */
function irA(id: IdVentana): void {
  if (!historial || id === activa) return;
  if (id === "inicio") {
    // Volver es retroceder, no empujar: así no se acumulan entradas.
    esperando = true;
    historial.back();
    return;
  }
  if (activa === "inicio") historial.pushState({ ventana: id });
  else historial.replaceState({ ventana: id });
  activa = id;
}

function alRetroceder(): void {
  esperando = false;
  const e = leer(historial?.state);
  activa = e.ventana;
  menu = e.menu;
  const p = pendiente;
  pendiente = null;
  if (p !== null) irA(p);
  avisar();
}

/**
 * Se llama una vez resuelta la sesión, no antes: el `replaceState` borra `history.state`, y
 * la pantalla del candado lo lee para su diagnóstico (`h+/-`).
 */
export function iniciarNavegacion(h: Historial, alCambiar: () => void): void {
  // Algunos navegadores conservan `history.state` al recargar: sin esto, una recarga sobre
  // Medallas dejaría una entrada de más y el primer "atrás" no haría nada visible.
  h.replaceState(null);
  if (historial !== h) h.alRetroceder(alRetroceder);
  historial = h;
  avisar = alCambiar;
  activa = "inicio";
  menu = false;
  pendiente = null;
  esperando = false;
}

export function ventanaActiva(): IdVentana {
  return activa;
}

export function menuAbierto(): boolean {
  return menu;
}

export function abrirVentana(id: IdVentana): void {
  if (!historial || esperando) return;
  if (menu) {
    // Primero se retira la entrada del menú y después se navega, así esa entrada nunca queda
    // en el historial, se haya abierto desde Inicio o desde otra ventana. El panel se cierra
    // ya, sin esperar al `popstate`, para que el toque se sienta atendido.
    menu = false;
    pendiente = id;
    esperando = true;
    historial.back();
    avisar();
    return;
  }
  irA(id);
  avisar();
}

export function abrirMenu(): void {
  if (!historial || esperando || menu) return;
  // Con su propia entrada, "atrás" cierra el menú en vez de sacarla de la página.
  historial.pushState({ ventana: activa, menu: true });
  menu = true;
  avisar();
}

export function cerrarMenu(): void {
  if (!historial || esperando || !menu) return;
  menu = false;
  esperando = true;
  historial.back();
  avisar();
}

/** El `history` de verdad, con la forma que pide `iniciarNavegacion`. */
export function historialDelNavegador(): Historial {
  // Cada ventana arranca arriba; que el navegador restaure el scroll de otra sería un salto.
  history.scrollRestoration = "manual";
  return {
    get state() { return history.state; },
    pushState: (e) => history.pushState(e, ""),
    replaceState: (e) => history.replaceState(e, ""),
    back: () => history.back(),
    alRetroceder: (f) => window.addEventListener("popstate", f),
  };
}
