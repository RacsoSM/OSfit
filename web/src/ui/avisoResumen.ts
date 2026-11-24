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

/** El mes ("AAAA-MM") del que hay que avisar, o null. */
export function resumenPorAvisar(
  meses: readonly { mes: string }[] | null,
  hoy: string,
  visto: string | null
): string | null {
  if (!meses) return null;
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
      <div class="logro-aviso tarjeta${entrada}" role="dialog" aria-modal="true" aria-labelledby="resumen-aviso-titulo">
        <div class="logro-llama" aria-hidden="true">📊</div>
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
