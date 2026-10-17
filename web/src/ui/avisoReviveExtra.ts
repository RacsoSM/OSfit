import type { Asistencia } from "../datos";
import { MAXIMO_POR_MES, RACHA_PARA_REVIVE_EXTRA, tieneReviveExtra } from "../cupo";

/**
 * El aviso de Inicio de que ganó el revive extra (entrenador, 2026-10-17): sin él, el premio
 * sería un 3 que se volvió 4 sin que nadie se enterara. Sale una sola vez, hasta que lo
 * cierra; quien ya había llegado a 30 antes de que existiera lo ve al entrar.
 *
 * Que ya lo vio se recuerda en el navegador, como la invitación a los avisos: si borra los
 * datos vuelve a salir una vez, que no es grave.
 */
export function avisoReviveExtra(asistencias: Asistencia[], visto: boolean): string {
  if (visto || !tieneReviveExtra(asistencias)) return "";
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">⭐ Revive extra, para siempre</p>
      <p class="ajuste-nota">
        Llegaste a ${RACHA_PARA_REVIVE_EXTRA} días de racha. Desde ahora tienes
        ${MAXIMO_POR_MES + 1} revives al mes en vez de ${MAXIMO_POR_MES}, aunque tu racha se rompa.
      </p>
      <button class="boton" id="revive-extra-visto">¡Genial!</button>
    </div>`;
}

/** Se vuelve a colgar en cada repintado, como el resto de `conectar*`. */
export function conectarAvisoReviveExtra(alCerrar: () => void): void {
  document.querySelector("#revive-extra-visto")?.addEventListener("click", alCerrar);
}
