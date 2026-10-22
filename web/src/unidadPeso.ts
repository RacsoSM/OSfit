import type { UnidadLibre } from "./barras";

/**
 * "Registrar en libras" de Ajustes (entrenador, 2026-10-22): con él, en Registro el peso libre se
 * anota en libras en vez de kg (las máquinas de placas siguen en barras). Solo cambia cómo se
 * escribe: se guarda en kg y en todo lo demás se ve en kg.
 *
 * Se recuerda en este teléfono, como el estilo y el modo sin datos.
 */
const LLAVE = "osfit:registro-libras";

export function registroEnLibras(): boolean {
  try {
    return localStorage.getItem(LLAVE) === "1";
  } catch {
    return false;
  }
}

export function guardarRegistroEnLibras(activo: boolean): void {
  try {
    if (activo) localStorage.setItem(LLAVE, "1");
    else localStorage.removeItem(LLAVE);
  } catch {
    // Sin almacenamiento solo se olvida: sigue en kg.
  }
}

/** La unidad del peso libre que toca usar. */
export function unidadLibre(): UnidadLibre {
  return registroEnLibras() ? "lb" : "kg";
}
