import { mesAnterior } from "../tirada";

/**
 * La ventana emergente de Inicio que avisa que ya está su resumen del mes que terminó
 * (entrenador, 2026-11-24): "Tu resumen de octubre ya está listo, ¿deseas verlo ahora?", con
 * "Ver ahora" (abre Resumen mensual en ese mes) y "Cancelar".
 *
 * Sale una sola vez por mes: lo que ya vio se recuerda en el teléfono (`LLAVE_RESUMEN_VISTO`
 * en `main.ts`), por cualquiera de los dos botones o por haber entrado a Resumen mensual. Solo
 * avisa del mes que acaba de terminar: un resumen de hace meses ya no es noticia.
 */

/**
 * La hora de la ventana emergente el día 1: la misma que la notificación del resumen
 * (`avisarResumenMes`, 9:00 de Mazatlán). El resumen se guarda a las 00:30, pero se anuncia junto
 * con el aviso (entrenador, 2026-11-24: "cada 1ero del mes a las 9 am").
 */
export const HORA_AVISO = "09:00";

/**
 * El mes ("AAAA-MM") del que hay que avisar, o null. Cada mes: el día 1 desde las 9:00 (`hora`,
 * "HH:MM" en Mazatlán) y los días siguientes, hasta que lo ve o lo cancela.
 */
export function resumenPorAvisar(
  meses: readonly { mes: string }[] | null,
  hoy: string,
  visto: string | null,
  hora = "23:59"
): string | null {
  if (!meses) return null;
  if (hoy.endsWith("-01") && hora < HORA_AVISO) return null;
  const terminado = mesAnterior(hoy.slice(0, 7));
  return meses.some((m) => m.mes === terminado) && visto !== terminado ? terminado : null;
}

/** "octubre". */
export function nombreMes(mes: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", month: "long" }).format(new Date(`${mes}-15T12:00:00Z`));
}

/** El "pop" de entrada solo la primera vez: `#contenido` se rehace en cada snapshot. */
let yaEntro = false;

export function avisoResumen(mes: string | null): string {
  if (!mes) return "";
  const entrada = yaEntro ? "" : " entrando";
  yaEntro = true;
  return `
    <div class="logro-velo${entrada}">
      <div class="logro-aviso aviso-resumen tarjeta${entrada}" role="dialog" aria-modal="true" aria-labelledby="resumen-aviso-titulo">
        <p class="logro-titulo" id="resumen-aviso-titulo">Tu resumen de ${nombreMes(mes)} ya está listo</p>
        <p class="logro-texto">¿Deseas verlo ahora?</p>
        <button class="boton" id="resumen-aviso-ver">Ver ahora</button>
        <button class="boton secundario" id="resumen-aviso-cancelar">Cancelar</button>
      </div>
    </div>`;
}

/** Se vuelve a colgar en cada repintado, como el resto de `conectar*`. */
export function conectarAvisoResumen(ver: () => void, cancelar: () => void): void {
  document.querySelector("#resumen-aviso-ver")?.addEventListener("click", ver);
  document.querySelector("#resumen-aviso-cancelar")?.addEventListener("click", cancelar);
}
