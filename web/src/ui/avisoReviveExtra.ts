import type { Asistencia } from "../datos";
import { MAXIMO_POR_MES, RACHA_PARA_REVIVE_EXTRA, tieneReviveExtra } from "../cupo";
import { llama } from "./llama";

/**
 * El aviso de Inicio de que ganó el revive extra (entrenador, 2026-10-17): sin él, el premio
 * sería un 3 que se volvió 4 sin que nadie se enterara. Sale una sola vez, hasta que lo
 * cierra; quien ya había llegado a 30 antes de que existiera lo ve al entrar.
 *
 * Que ya lo vio se recuerda en el navegador, como la invitación a los avisos: si borra los
 * datos vuelve a salir una vez, que no es grave.
 *
 * Desde el 2026-10-17 también anuncia la llama azul (pedido del entrenador para Caro y
 * Brianda, las primeras en llegar a 30). Por eso la llave en `main.ts` es la v2: quien ya
 * había cerrado la primera versión, que no hablaba de la llama, la ve una vez más.
 */
export function avisoReviveExtra(asistencias: Asistencia[], visto: boolean): string {
  if (visto || !tieneReviveExtra(asistencias)) return "";
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">⭐ ¡Cumpliste ${RACHA_PARA_REVIVE_EXTRA} días de racha!</p>
      <p class="ajuste-nota">
        Por llegar a ${RACHA_PARA_REVIVE_EXTRA} días ganaste un revive extra para siempre: desde
        ahora tienes ${MAXIMO_POR_MES + 1} revives al mes en vez de ${MAXIMO_POR_MES}, aunque tu racha se
        rompa.
      </p>
      <p class="ajuste-nota">Y tu llama ahora es azul ${llama(true)}</p>
      <button class="boton" id="revive-extra-visto">¡Genial!</button>
    </div>`;
}

/** Se vuelve a colgar en cada repintado, como el resto de `conectar*`. */
export function conectarAvisoReviveExtra(alCerrar: () => void): void {
  document.querySelector("#revive-extra-visto")?.addEventListener("click", alCerrar);
}
