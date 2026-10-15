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
 * Cada ventana que se abre queda en el historial, como en cualquier app: el gesto o el botón de
 * "atrás" regresa a la ventana en la que estaba antes, una por una (decisión del entrenador,
 * 2026-10-15; antes el historial no pasaba de `[Inicio, ventana]` y "atrás" siempre volvía a
 * Inicio). El menú abierto tiene su propia entrada, así que "atrás" primero lo cierra. Las
 * subventanas (`PADRE`), como Amigos dentro de Músculos, se abren encima de su padre, y salir
 * de ellas hacia el padre es retroceder, para no apilar `Músculos, Amigos, Músculos`.
 *
 * Dentro de una ventana puede haber pantallas (`sub`), como las de Registro: inicio, historial,
 * elegir, capturar, resumen. Cada una lleva su entrada, así que "atrás" también las recorre.
 * Cada entrada recuerda cuál era la anterior (`ant`): regresar a esa pantalla desde la página
 * ("← Volver", elegir un ejercicio) es retroceder y no apilar otra entrada.
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

/** Las subventanas y la ventana sobre la que se abren. */
const PADRE: Partial<Record<IdVentana, IdVentana>> = { comparar: "musculos" };

/** La ventana de la barra que va marcada: la propia, o la del padre en una subventana. */
export function ventanaDeBarra(id: IdVentana): IdVentana {
  return PADRE[id] ?? id;
}

let historial: Historial | null = null;
let avisar: () => void = () => {};
let activa: IdVentana = "inicio";
let menu = false;
/** La pantalla dentro de la ventana activa (`sub`); null = la de entrada. */
let sub: string | null = null;
/** Quién se entera cuando "atrás" cambia de pantalla: Registro pone la suya. */
let alCambiarSub: (ventana: IdVentana, sub: string | null) => void = () => {};

interface Lugar { ventana: IdVentana; sub?: string | null; }

/** Lo que va en `history.state` de una entrada, con dónde estaba antes (`ant`). */
function entrada(ventana: IdVentana, s: string | null, extra: { menu?: boolean } = {}): unknown {
  return { ventana, ...(s !== null ? { sub: s } : {}), ...extra, ant: { ventana: activa, sub } };
}
/** La ventana elegida en el menú, que se abre en cuanto el menú termine de cerrarse. */
let pendiente: IdVentana | null = null;
/**
 * Hay un `back()` en vuelo. `history.back()` es asíncrono: hasta que llega su `popstate`, un
 * `pushState` se metería en medio y dejaría una entrada de menú huérfana. Mientras tanto se
 * ignoran los toques; el hueco dura milisegundos.
 */
let esperando = false;

function leer(estado: unknown): { ventana: IdVentana; menu: boolean; sub: string | null; ant: Lugar | null } {
  const e = (estado ?? {}) as { ventana?: unknown; menu?: unknown; sub?: unknown; ant?: unknown };
  const ant = e.ant as Lugar | undefined;
  return {
    ventana: typeof e.ventana === "string" ? (e.ventana as IdVentana) : "inicio",
    menu: e.menu === true,
    sub: typeof e.sub === "string" ? e.sub : null,
    ant: ant && typeof ant.ventana === "string" ? { ventana: ant.ventana, sub: ant.sub ?? null } : null,
  };
}

/** Ir a una ventana con el menú ya cerrado. */
function irA(id: IdVentana): void {
  if (!historial || id === activa) return;
  const padre = PADRE[activa];
  if (padre !== undefined) {
    // Salir de una subventana es primero regresar a su padre; si iba a otra, se sigue desde
    // ahí al llegar el `popstate` (`pendiente`), como al cerrar el menú.
    if (id !== padre) pendiente = id;
    esperando = true;
    historial.back();
    return;
  }
  historial.pushState(entrada(id, null));
  activa = id;
  sub = null;
}

function alRetroceder(): void {
  esperando = false;
  const e = leer(historial?.state);
  const cambioSub = e.ventana !== activa || e.sub !== sub;
  activa = e.ventana;
  menu = e.menu;
  sub = e.sub;
  if (cambioSub) alCambiarSub(activa, sub);
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
  sub = null;
  pendiente = null;
  esperando = false;
}

/** Quién pone la pantalla cuando "atrás" la cambia (Registro). */
export function alRetrocederSub(f: (ventana: IdVentana, sub: string | null) => void): void {
  alCambiarSub = f;
}

export function subActiva(): string | null {
  return sub;
}

/**
 * Cambio de pantalla dentro de la ventana activa. Las tres formas:
 * - `adelante`: una pantalla nueva encima (iniciar, agregar un ejercicio, ver el historial).
 * - `volver`: regresar a otra; si es la de la entrada anterior, se retrocede en vez de apilar.
 * - `reemplazar`: cambia la de esta entrada (terminar el entrenamiento → resumen: "atrás" desde
 *   el resumen no regresa a un entrenamiento ya guardado).
 */
export function irSub(nueva: string | null, modo: "adelante" | "volver" | "reemplazar"): void {
  if (!historial || esperando || menu || nueva === sub) return;
  const e = leer(historial.state);
  if (modo === "volver" && e.ant && e.ant.ventana === activa && (e.ant.sub ?? null) === nueva) {
    esperando = true;
    sub = nueva;
    historial.back();
    return;
  }
  if (modo === "adelante") historial.pushState(entrada(activa, nueva));
  else historial.replaceState({ ...(historial.state as object ?? {}), ventana: activa, sub: nueva ?? undefined });
  sub = nueva;
}

/**
 * La pantalla en la que quedó la ventana, sin tocar el historial más que para anotarla. Para
 * cuando la ventana decide sola dónde abrir (Registro con un entrenamiento abierto se va a él).
 */
export function marcarSub(actual: string | null): void {
  if (!historial || esperando || menu || actual === sub) return;
  historial.replaceState({ ...(historial.state as object ?? {}), ventana: activa, sub: actual ?? undefined });
  sub = actual;
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
  historial.pushState(entrada(activa, sub, { menu: true }));
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
