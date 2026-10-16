import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { REGION } from "./comun";

/**
 * Mantiene despiertas, en horario del gimnasio, las funciones que la clienta espera con la
 * pantalla en la mano. Cuando una función pasa unos minutos sin uso, Google la apaga y la
 * siguiente llamada tarda 2 a 4 s más en arrancarla (medido en los registros, 2026-10-16).
 *
 * En vez de dejarlas siempre encendidas (unos 8 dólares al mes cada una), cada 5 minutos de
 * 6 a 10 de la noche, hora de Mazatlán (decisión del entrenador, 2026-10-16), les manda la
 * misma pregunta previa ("preflight") que manda el navegador antes de cada llamada: arranca la
 * instancia sin correr nada de su lógica ni dejar errores en los registros. Google no
 * garantiza que no las recicle de vez en cuando, pero casi siempre basta.
 */

/**
 * Las que más se esperan: guardar el entrenamiento, Amigos, la asistencia al empezar y
 * `sesion`, que canjea el link cuando el teléfono perdió la sesión guardada (pasa en iPhone).
 */
export const DESPERTAR = ["registrarSesion", "compararMusculos", "marcarAsistencia", "sesion"] as const;

export function urlDe(nombre: string, proyecto: string): string {
  return `https://${REGION}-${proyecto}.cloudfunctions.net/${nombre}`;
}

export const despertarFunciones = onSchedule(
  { schedule: "*/5 18-21 * * *", timeZone: "America/Mazatlan", region: REGION },
  async () => {
    const proyecto = process.env.GCLOUD_PROJECT ?? "osfit-cccfe";
    await Promise.all(DESPERTAR.map(async (nombre) => {
      try {
        await fetch(urlDe(nombre, proyecto), {
          method: "OPTIONS",
          headers: {
            Origin: `https://${proyecto}.web.app`,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
          },
          signal: AbortSignal.timeout(20_000),
        });
      } catch (error) {
        // Si una no contesta, la clienta solo espera el arranque como antes: nada se rompe.
        logger.warn("No se pudo despertar", nombre, error);
      }
    }));
  }
);
