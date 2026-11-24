/**
 * "¿Qué tan pesado estuvo tu entrenamiento?" (entrenador, 2026-11-24): la calificación del 1 al
 * 10 del resumen al terminar, que va a `guardarEsfuerzo` (functions). Se apunta primero en el
 * teléfono y se borra cuando el servidor contesta: sin internet no se pierde, se manda al
 * volver la señal (`reenviarEsfuerzos`, al abrir la página y con el evento `online`).
 */

const LLAVE = "osfit:esfuerzos-pendientes";

export type EnviarEsfuerzo = (d: { sesionId: string; esfuerzo: number }) => Promise<unknown>;

function leer(): Record<string, number> {
  try {
    const x = JSON.parse(globalThis.localStorage?.getItem(LLAVE) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(x).filter((e): e is [string, number] =>
      typeof e[1] === "number" && Number.isInteger(e[1]) && e[1] >= 1 && e[1] <= 10));
  } catch { return {}; }
}

function escribir(p: Record<string, number>): void {
  try { globalThis.localStorage?.setItem(LLAVE, JSON.stringify(p)); } catch { /* sin almacenamiento: solo se intenta una vez */ }
}

/** Las que faltan por mandar (para los tests y para saber si hay algo). */
export function esfuerzosPendientes(): Record<string, number> { return leer(); }

async function mandar(sesionId: string, esfuerzo: number, enviar: EnviarEsfuerzo): Promise<void> {
  try {
    await enviar({ sesionId, esfuerzo });
    // Solo se borra si no la cambió mientras tanto (tocó otro número antes de que contestara).
    const p = leer();
    if (p[sesionId] === esfuerzo) { delete p[sesionId]; escribir(p); }
  } catch { /* se queda apuntada: se manda en el próximo intento */ }
}

export function calificarEsfuerzo(sesionId: string, esfuerzo: number, enviar: EnviarEsfuerzo): Promise<void> {
  escribir({ ...leer(), [sesionId]: esfuerzo });
  return mandar(sesionId, esfuerzo, enviar);
}

export function reenviarEsfuerzos(enviar: EnviarEsfuerzo): Promise<void> {
  return Promise.all(Object.entries(leer()).map(([id, n]) => mandar(id, n, enviar))).then(() => undefined);
}
