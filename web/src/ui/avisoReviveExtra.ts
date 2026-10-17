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
 * Brianda, las primeras en llegar a 30), y lo llama "comodín para revivir la racha". Cada
 * cambio de texto o de forma sube la versión de la llave en `main.ts` (va en la v4: ventana
 * emergente), para que quien ya había cerrado una versión anterior vea la nueva una vez más.
 */
/**
 * La entrada (el "pop") solo la primera vez que se pinta: `#contenido` se rehace en cada
 * snapshot de Firestore y, sin esto, la ventana volvería a saltar cada vez que el entrenador
 * marca una asistencia.
 */
let yaEntro = false;

/**
 * Ventana emergente sobre todo, barra incluida (como el aviso de reps): en una tarjeta entre
 * las demás casi no se veía (entrenador, 2026-10-17).
 */
export function avisoReviveExtra(asistencias: Asistencia[], visto: boolean, otorgado: boolean): string {
  if (visto || !tieneReviveExtra(asistencias, otorgado)) return "";
  const entrada = yaEntro ? "" : " entrando";
  yaEntro = true;
  return `
    <div class="logro-velo${entrada}">
      <div class="logro-aviso tarjeta${entrada}" role="dialog" aria-modal="true" aria-labelledby="logro-titulo">
        <div class="logro-llama">${llama(true)}</div>
        <p class="logro-titulo" id="logro-titulo">¡Cumpliste ${RACHA_PARA_REVIVE_EXTRA} días de racha!</p>
        <p class="logro-texto">
          Ganaste un <strong>comodín extra</strong> para revivir tu racha, para siempre: desde ahora
          tienes <strong>${MAXIMO_POR_MES + 1} comodines al mes</strong> en vez de ${MAXIMO_POR_MES}, aunque tu
          racha se rompa.
        </p>
        <p class="logro-texto">Y tu llama ahora es <strong>azul</strong>.</p>
        <button class="boton" id="revive-extra-visto">¡Genial!</button>
      </div>
    </div>`;
}

/** Se vuelve a colgar en cada repintado, como el resto de `conectar*`. */
export function conectarAvisoReviveExtra(alCerrar: () => void): void {
  document.querySelector("#revive-extra-visto")?.addEventListener("click", alCerrar);
}
