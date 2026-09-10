import type { Asistencia } from "../datos";
import { promedioMinutos, rachaActual } from "../racha";

export function tarjetasStats(asistencias: Asistencia[], hoy: string): string {
  const racha = rachaActual(asistencias, hoy);
  const promedio = promedioMinutos(asistencias);

  return `
    <div class="fila">
      <div class="tarjeta">
        <p class="tarjeta-titulo">Tu racha</p>
        <p class="numero">🔥 ${racha}</p>
        <p style="color: var(--texto-tenue); font-size: 12px; margin: 0">
          ${racha === 1 ? "día seguido sin faltar" : "días seguidos sin faltar"}
        </p>
      </div>
      <div class="tarjeta">
        <p class="tarjeta-titulo">Promedio</p>
        <p class="numero">${promedio ?? "—"}</p>
        <p style="color: var(--texto-tenue); font-size: 12px; margin: 0">
          ${promedio === null ? "aún sin sesiones medidas" : "minutos por sesión"}
        </p>
      </div>
    </div>`;
}
