/**
 * Las partes de la página que se cargan hasta que se usan (2026-11-26): los juegos, el Arcade,
 * Mi espacio, el Resumen mensual, Amigos y Estadísticas. Al abrir la página solo se baja y se
 * lee lo de Inicio, la barra y Registro; lo demás llega la primera vez que se entra ahí (y el
 * service worker lo deja guardado en el teléfono, así que la siguiente vez sale al instante,
 * también sin internet: ver `public/sw.js`).
 *
 * Cada parte es un `import()`: Vite la separa en su propio archivo. Mientras llega, la ventana
 * pinta "Cargando…" y, al llegar, la página se repinta sola (`alCargar`, que pone `main.ts`).
 */

export interface Perezoso<M> {
  /** El módulo si ya llegó; si no, null (y lo pide). */
  ya(): M | null;
  /** El módulo si ya llegó; si no, null, sin pedirlo (para limpiar el estado de una parte). */
  listo(): M | null;
  /** El módulo, cuando llegue. */
  pedir(): Promise<M>;
}

let repintar: () => void = () => {};

/** Lo que se hace cuando llega cualquier parte: en la página, repintar. */
export function alCargar(fn: () => void): void {
  repintar = fn;
}

export function perezoso<M>(cargar: () => Promise<M>): Perezoso<M> {
  let modulo: M | null = null;
  let pedido: Promise<M> | null = null;
  const pedir = (): Promise<M> => {
    if (!pedido) {
      pedido = cargar().then(
        (m) => { modulo = m; repintar(); return m; },
        (e: unknown) => {
          // Sin señal y sin copia guardada: se puede volver a intentar al volver a entrar.
          pedido = null;
          throw e;
        }
      );
    }
    return pedido;
  };
  return {
    ya: () => {
      if (!modulo) pedir().catch(() => {});
      return modulo;
    },
    listo: () => modulo,
    pedir,
  };
}

/** Lo que pinta una ventana mientras llega su parte. */
export function cargando(): string {
  return `<div class="tarjeta vacio cargando-parte" role="status"><p>Cargando…</p></div>`;
}

export const parteArcade = perezoso(() => import("./ui/arcade"));
export const parteDiscos = perezoso(() => import("./ui/juegoDiscos"));
export const parteKettlebell = perezoso(() => import("./ui/kettlebellBird"));
export const parteBoxJump = perezoso(() => import("./ui/boxJump"));
export const partePesaRun = perezoso(() => import("./ui/pesaRun"));
export const parteEspacio = perezoso(() => import("./ui/espacio"));
export const parteResumen = perezoso(() => import("./ui/resumenMensual"));
export const parteComparar = perezoso(() => import("./ui/comparar"));
export const parteEstadisticas = perezoso(() => import("./ui/estadisticas"));
