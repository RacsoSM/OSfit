import type { Asistencia } from "../datos";
import { tieneReviveExtra } from "../cupo";
import { rachaActual } from "../racha";
import { llama } from "./llama";
import { OBJETIVO_SEMANAL } from "../registro";

/**
 * La racha y los entrenamientos de la semana ("2 / 5", contados de lo que anotó en Registro).
 * El promedio de minutos por sesión que iba aquí se cambió de lugar con "Tu semana" de
 * Registro (entrenador, 2026-10-14). `entrenamientosSemana` es null mientras no llegan sus
 * sesiones.
 */
export function tarjetasStats(asistencias: Asistencia[], hoy: string, entrenamientosSemana: number | null = null): string {
  const racha = rachaActual(asistencias, hoy);
  // Sin ninguna asistencia registrada, un "🔥 0" y un "—" son un cero críptico, no una
  // respuesta: hace falta decir que es porque todavía no hay historial y quién lo llena.
  const sinHistorial = asistencias.length === 0;

  return `
    <div class="fila">
      <div class="tarjeta">
        <p class="tarjeta-titulo">Tu racha</p>
        <p class="numero">${llama(tieneReviveExtra(asistencias))} ${racha}</p>
        <p style="color: var(--texto-tenue); font-size: 12px; margin: 0">
          ${sinHistorial ? "arranca con tu primera sesión" : racha === 1 ? "día seguido sin faltar" : "días seguidos sin faltar"}
        </p>
      </div>
      <div class="tarjeta">
        <p class="tarjeta-titulo">Esta semana</p>
        <p class="numero">${entrenamientosSemana ?? "—"}<span class="numero-de"> / ${OBJETIVO_SEMANAL}</span></p>
        <p style="color: var(--texto-tenue); font-size: 12px; margin: 0">
          ${entrenamientosSemana === 1 ? "entrenamiento" : "entrenamientos"}
        </p>
      </div>
    </div>
    ${
      sinHistorial
        ? `<p class="accion-nota" style="text-align: center">
             Todavía no tienes asistencias · tu entrenador las registra después de cada sesión.
           </p>`
        : ""
    }`;
}
