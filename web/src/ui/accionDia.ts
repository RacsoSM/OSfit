import type { Cliente } from "../datos";
import { horaEnMazatlan } from "../fecha";
import { escapar } from "./tarjetaDia";

/**
 * "Cambiar el día": un pop up con los días de su rutina (entrenador, 2026-11-26). Antes era una
 * hoja dentro de la tarjeta que además pedía el motivo; ya no se pide. Elegir un día lo cambia
 * al instante, también sin internet: quien lo guarda y lo manda es `main.ts` (ver
 * `cambioDia.ts`), por eso este módulo solo pinta y avisa con `alElegir`.
 *
 * El estado vive en el módulo y no en el DOM porque `pintar()` reconstruye toda la página en
 * cada snapshot de Firestore: si el pop up abierto o el día elegido vivieran en los elementos,
 * un snapshot que llegara mientras elige se lo cerraría en la cara.
 */
interface Estado {
  abierta: boolean;
  diaElegido: number | null;
  error: string | null;
  /** La hora del último cambio, para confirmarlo en la tarjeta. */
  confirmacion: string | null;
  /** La primera vez que se pinta abierto entra con animación; los repintados, no. */
  recienAbierta: boolean;
}

const estado: Estado = { abierta: false, diaElegido: null, error: null, confirmacion: null, recienAbierta: false };

/** Si el pop up está abierto (para las pruebas). */
export function cambioDiaAbierto(): boolean {
  return estado.abierta;
}

/**
 * Si todavía puede cambiar el día de hoy. GEMELO de `planCambioDia` en
 * `functions/src/cambiarDia.ts`: la asistencia que marcó la web al EMPEZAR un entrenamiento no
 * cuenta como día hecho mientras no haya guardado ninguno hoy; la del entrenador, sí.
 */
export function diaCambiable(
  asistencias: readonly { fecha: string; asistio: boolean; marcadaDesde?: string }[],
  sesiones: readonly { fecha: string }[] | null,
  hoy: string
): boolean {
  const deHoy = asistencias.find((a) => a.fecha === hoy && a.asistio);
  if (!deHoy) return true;
  return deHoy.marcadaDesde === "registro" && !(sesiones ?? []).some((s) => s.fecha === hoy);
}

/** Lo que se le dice cuando el servidor rechaza el cambio, según el motivo que manda. */
export function mensajeDeError(error: unknown): string {
  const motivo = (error as { message?: unknown } | null)?.message;
  if (motivo === "ya_asistio_hoy") return "Ya entrenaste hoy, así que tu día ya quedó registrado. Mañana podrás elegir otro.";
  if (motivo === "sin_rutina") return "Todavía no tienes rutina asignada. Habla con tu entrenador.";
  if (motivo === "cambio_vencido") return "El cambio de día que hiciste sin internet era de un día que ya pasó, así que no se aplicó.";
  return "No pudimos cambiar tu día. Inténtalo otra vez en un momento.";
}

/** Cuando el servidor rechaza un cambio ya hecho en el teléfono (`main.ts`). */
export function avisarRechazoCambio(texto: string): void {
  estado.error = texto;
  estado.confirmacion = null;
}

/**
 * El botón "Cambiar el día" de la tarjeta, con lo que haya que decir debajo (confirmación,
 * error o por qué no se puede).
 *
 * No se muestra sin rutina asignada. Con la cuenta pausada, o con el día ya hecho
 * (`diaCambiable`), queda deshabilitado con su nota: un botón que desaparece sin decir nada se
 * lee como que la página se rompió. El servidor rechaza esos casos igual.
 *
 * `pendiente`: hay un cambio hecho sin internet que todavía no llega al servidor.
 */
export function accionDia(cliente: Cliente, hoy: string, yaAsistioHoy: boolean, pendiente = false): string {
  const dias = cliente.rutinaAsignada?.dias ?? [];
  if (dias.length === 0) return "";

  const boton = (deshabilitado: boolean) =>
    `<button type="button" id="abrir-cambio-dia" class="dh-accion" ${deshabilitado ? "disabled" : ""}>Cambiar el día</button>`;

  if (!cliente.activo) {
    return `${boton(true)}<p class="accion-nota">Tu cuenta está pausada. Habla con tu entrenador.</p>`;
  }
  if (yaAsistioHoy) {
    return `${boton(true)}<p class="accion-nota">Ya entrenaste hoy: tu día quedó registrado.</p>`;
  }

  const confirmacion = estado.confirmacion
    ? `<p class="aviso-ok">Cambiaste tu día a las ${escapar(estado.confirmacion)}.${
        pendiente ? " Se guardará en cuanto haya internet." : ""}</p>`
    : "";
  const error = estado.error ? `<p class="aviso-error">${escapar(estado.error)}</p>` : "";
  return `${boton(false)}${confirmacion}${error}`;
}

/**
 * El pop up: los días de su rutina, con el de hoy marcado, y "Cambiar" para confirmar. Va fuera
 * de la tarjeta (al final de Inicio) y fijo sobre toda la pantalla, como los demás avisos.
 * `indiceHoy`: el día que le toca ahora, o null si no se sabe.
 */
export function modalCambioDia(cliente: Cliente, indiceHoy: number | null): string {
  if (!estado.abierta) return "";
  const dias = cliente.rutinaAsignada?.dias ?? [];
  if (dias.length === 0) return "";
  const entrada = estado.recienAbierta ? " entrando" : "";
  estado.recienAbierta = false;
  const elegido = estado.diaElegido;
  const opciones = dias
    .map((dia, i) => {
      const esHoy = i === indiceHoy;
      return `
        <button type="button" class="cd-opcion${elegido === i ? " elegida" : ""}" data-dia="${i}" ${esHoy ? "disabled" : ""}
                aria-pressed="${elegido === i}">
          <span class="cd-numero">${i + 1}</span>
          <span class="cd-nombre">${escapar(dia.nombreDia ?? "")}</span>
          ${esHoy ? `<span class="cd-hoy">Hoy</span>` : ""}
        </button>`;
    })
    .join("");
  return `
    <div class="logro-velo cd-velo${entrada}" data-cerrar-cambio-dia>
      <div class="logro-aviso tarjeta cd-aviso${entrada}" role="dialog" aria-modal="true" aria-labelledby="cd-titulo">
        <p class="cd-titulo" id="cd-titulo">¿Qué día quieres hacer hoy?</p>
        <div class="cd-opciones">${opciones}</div>
        <div class="cd-botones">
          <button type="button" class="boton secundario" id="cerrar-cambio-dia">Cancelar</button>
          <button type="button" class="boton" id="enviar-cambio-dia" ${elegido === null ? "disabled" : ""}>
            ${elegido === null ? "Elige un día" : `Cambiar al día ${elegido + 1}`}
          </button>
        </div>
      </div>
    </div>`;
}

/**
 * Se vuelve a llamar en cada repintado, porque `innerHTML` tira los listeners anteriores.
 * `alElegir` guarda el cambio (en el teléfono y, si hay señal, en el servidor).
 */
export function conectarAccionDia(repintar: () => void, alElegir: (diaIndex: number) => void): void {
  document.querySelector("#abrir-cambio-dia")?.addEventListener("click", () => {
    estado.abierta = true;
    estado.recienAbierta = true;
    estado.diaElegido = null;
    estado.error = null;
    repintar();
  });

  const cerrar = () => {
    estado.abierta = false;
    estado.diaElegido = null;
    repintar();
  };
  document.querySelector("#cerrar-cambio-dia")?.addEventListener("click", cerrar);
  // Tocar fuera del recuadro también cierra, como cualquier pop up.
  document.querySelector("[data-cerrar-cambio-dia]")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) cerrar();
  });

  document.querySelectorAll<HTMLElement>(".cd-opcion[data-dia]").forEach((boton) => {
    boton.addEventListener("click", () => {
      estado.diaElegido = Number(boton.dataset.dia);
      repintar();
    });
  });

  document.querySelector("#enviar-cambio-dia")?.addEventListener("click", () => {
    if (estado.diaElegido === null) return;
    const dia = estado.diaElegido;
    estado.abierta = false;
    estado.diaElegido = null;
    estado.error = null;
    estado.confirmacion = horaEnMazatlan();
    alElegir(dia);
    repintar();
  });
}
