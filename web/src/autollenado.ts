/**
 * "Autollenar con lo de la vez pasada" de Ajustes (entrenador, 2026-10-22): con él, al agregar
 * en Registro un ejercicio que ya había hecho, entra con las series de la última vez. Apagado
 * de entrada: así entra sin series (ver `agregarEjercicio`).
 *
 * Se recuerda en este teléfono, como "Registrar en libras".
 */
const LLAVE = "osfit:registro-autollenar";

export function autollenarActivo(): boolean {
  try {
    return localStorage.getItem(LLAVE) === "1";
  } catch {
    return false;
  }
}

export function guardarAutollenar(activo: boolean): void {
  try {
    if (activo) localStorage.setItem(LLAVE, "1");
    else localStorage.removeItem(LLAVE);
  } catch {
    // Sin almacenamiento solo se olvida: sigue sin autollenar.
  }
}
