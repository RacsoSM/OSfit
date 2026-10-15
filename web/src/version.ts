/**
 * Avisar cuando hay una versión nueva de la página (decisión del entrenador, 2026-10-15).
 *
 * Abrir la página desde cero ya trae siempre la última (el HTML va sin caché y `sw.js` lo pide
 * a la red primero). El problema es la página que se queda abierta: instalada en el teléfono,
 * al mandarla al fondo y volver, el sistema la reanuda sin recargar y sigue con el código viejo
 * durante días. Por eso, cada vez que vuelve a la página y cada media hora mientras la tiene
 * abierta, se pregunta cuál es la versión vigente (`/version.json`, que escribe el build: ver
 * `vite.config.ts`). Si no es la suya, sale un aviso con "Actualizar"; recargar lo decide ella,
 * para no cambiarle la pantalla a media serie. Recargar no pierde nada: el entrenamiento en curso
 * y la cola sin internet viven en el navegador.
 */

/** Cada cuánto se vuelve a preguntar mientras la página está a la vista. */
export const CADA_MS = 30 * 60_000;

/**
 * La versión que trae `/version.json`, o null si no es eso: en desarrollo no existe, y hosting
 * responde a cualquier ruta desconocida con el HTML de la página.
 */
export function versionDe(datos: unknown): string | null {
  const v = (datos as { version?: unknown } | null)?.version;
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** Hay otra versión publicada: distinta, no "mayor". Un deploy de vuelta atrás también cuenta. */
export function hayVersionNueva(actual: string, publicada: string | null): boolean {
  return publicada !== null && publicada !== actual;
}

/** Lo que se usa del navegador, inyectado para probarlo sin DOM. */
export interface Entorno {
  pedir: () => Promise<unknown>;
  visible: () => boolean;
  alVolver: (escucha: () => void) => void;
  cada: (escucha: () => void, ms: number) => void;
}

export const entornoDelNavegador = (): Entorno => ({
  // `no-store`: ni el navegador ni un proxy deben contestar con una copia guardada.
  pedir: () => fetch("/version.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
  visible: () => document.visibilityState === "visible",
  alVolver: (escucha) => {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") escucha();
    });
    window.addEventListener("online", escucha);
  },
  cada: (escucha, ms) => { setInterval(escucha, ms); },
});

/**
 * Pregunta por la versión al volver a la página y cada `CADA_MS` mientras está a la vista, y
 * llama a `alHaberNueva` la primera vez que encuentra otra. Sin señal o con una respuesta rara,
 * no pasa nada: se vuelve a preguntar en la siguiente ocasión.
 */
export function vigilarVersion(actual: string, alHaberNueva: () => void, entorno: Entorno = entornoDelNavegador()): void {
  let avisado = false;
  let preguntando = false;
  const revisar = async (): Promise<void> => {
    if (avisado || preguntando || !entorno.visible()) return;
    preguntando = true;
    try {
      if (hayVersionNueva(actual, versionDe(await entorno.pedir()))) {
        avisado = true;
        alHaberNueva();
      }
    } catch {
      /* sin señal: se intenta otra vez al volver o a la media hora */
    } finally {
      preguntando = false;
    }
  };
  entorno.alVolver(() => { void revisar(); });
  entorno.cada(() => { void revisar(); }, CADA_MS);
}
