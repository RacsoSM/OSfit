import type { Asistencia, Cliente } from "../datos";
import { MAXIMO_POR_MES, disponiblesEnElMes } from "../cupo";
import { faltaQueRompioLaRacha } from "../faltaRompio";
import { revivirRacha } from "../acciones";
import { escapar, esFinDeSemana } from "./tarjetaDia";

/**
 * Las dos entradas al mismo endpoint, que viven en sitios distintos de la página:
 *
 *  - "Hoy no voy a poder ir" va DENTRO de la tarjeta del día, porque habla del día de hoy.
 *  - "Revivir mi racha" va en su propia tarjeta, debajo de la racha y el promedio, porque
 *    habla de la racha y no del día.
 *
 * Ninguna pide motivo — no hay lista, no hay texto libre, no se guarda nada (spec, "Faltar no
 * pide explicaciones"). Pedirle a alguien enfermo que elija de una lista por qué no puede ir
 * convierte un aviso en un trámite.
 */

/** Qué se está confirmando y desde dónde, para pintar el diálogo donde se pidió. */
type Pendiente = { fecha: string; origen: "hoy" | "revivir" } | null;

interface Estado {
  pendiente: Pendiente;
  enVuelo: boolean;
  /** Dónde mostrar el acuse, para que salga junto al botón que se tocó. */
  exito: "hoy" | "revivir" | null;
  error: { texto: string; origen: "hoy" | "revivir" } | null;
}

const estado: Estado = { pendiente: null, enVuelo: false, exito: null, error: null };

function enPalabras(fecha: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${fecha}T12:00:00Z`));
}

/** "Te quedan 2 este mes." / "Te queda 1 este mes." */
function cuantosQuedan(disponibles: number): string {
  return disponibles === 1 ? "Te queda 1 este mes." : `Te quedan ${disponibles} este mes.`;
}

/**
 * El diálogo del spec, palabra por palabra. Se confirma antes de gastar porque son 3 al mes y
 * el cliente no debe descubrir que gastó uno por un toque accidental.
 */
function confirmacion(disponibles: number): string {
  return `
    <p class="confirmar-titulo">¿Usar uno de tus ${MAXIMO_POR_MES} revives?</p>
    <p class="accion-nota">${cuantosQuedan(disponibles)}</p>
    <div class="fila-botones">
      <button id="falta-cancelar" class="boton secundario" ${estado.enVuelo ? "disabled" : ""}>
        Cancelar
      </button>
      <button id="falta-confirmar" class="boton" ${estado.enVuelo ? "disabled" : ""}>
        ${estado.enVuelo ? "Enviando…" : "Sí, usar uno"}
      </button>
    </div>`;
}

const ACUSE = `<p class="aviso-ok">Esperamos que todo esté bien, te vemos mañana si Dios quiere!</p>`;

/** "Hoy no voy a poder ir". Se pinta dentro de la tarjeta del día, sin envoltorio propio. */
export function accionHoyNoPuedo(
  cliente: Cliente,
  hoy: string,
  asistencias: Asistencia[]
): string {
  if (esFinDeSemana(hoy)) return "";

  const disponibles = disponiblesEnElMes(asistencias, hoy.slice(0, 7));
  const sinCupo = disponibles === 0;
  const bloqueado = !cliente.activo || sinCupo || estado.enVuelo;

  if (estado.pendiente?.origen === "hoy") return confirmacion(disponibles);

  const aviso = estado.exito === "hoy" ? ACUSE : "";
  const error =
    estado.error?.origen === "hoy"
      ? `<p class="aviso-error">${escapar(estado.error.texto)}</p>`
      : "";

  return `
    ${aviso}${error}
    <button id="falta-hoy" class="boton secundario" ${bloqueado ? "disabled" : ""}>
      Hoy no voy a poder ir
    </button>
    ${sinCupo && cliente.activo ? `<p class="accion-nota">Ya usaste tus ${MAXIMO_POR_MES} revives de este mes.</p>` : ""}`;
}

/**
 * "Revivir mi racha", en su propia tarjeta debajo de la racha y el promedio.
 *
 * No se dibuja si no hay nada que reparar. Son dos motivos distintos y los dos terminan igual:
 * la racha está viva, o la rotura ya quedó fuera de la ventana de 2 días hábiles. En ninguno
 * de los dos casos la página le recuerda al cliente que puede faltar.
 */
export function tarjetaRevivir(
  cliente: Cliente,
  hoy: string,
  asistencias: Asistencia[]
): string {
  if (esFinDeSemana(hoy)) return "";

  const rota = faltaQueRompioLaRacha(asistencias, hoy);
  if (rota === null && estado.exito !== "revivir") return "";

  const disponibles = disponiblesEnElMes(asistencias, hoy.slice(0, 7));
  const sinCupo = disponibles === 0;
  const bloqueado = !cliente.activo || sinCupo || estado.enVuelo;

  const cuerpo =
    estado.pendiente?.origen === "revivir"
      ? confirmacion(disponibles)
      : estado.exito === "revivir"
        ? ACUSE
        : `<button id="falta-revivir" class="boton secundario" ${bloqueado ? "disabled" : ""}>
             💔 Revivir mi racha
           </button>
           <p class="accion-nota">Repara tu falta del ${escapar(enPalabras(rota as string))}.</p>
           ${
             !cliente.activo
               ? `<p class="accion-nota">Tu cuenta está pausada. Habla con tu entrenador.</p>`
               : sinCupo
                 ? `<p class="accion-nota">Ya usaste tus ${MAXIMO_POR_MES} revives de este mes.</p>`
                 : `<p class="accion-nota">${cuantosQuedan(disponibles)}</p>`
           }`;

  const error =
    estado.error?.origen === "revivir"
      ? `<p class="aviso-error">${escapar(estado.error.texto)}</p>`
      : "";

  return `<div class="tarjeta">${error}${cuerpo}</div>`;
}

/** Se vuelve a llamar en cada repintado, porque `innerHTML` tira los listeners anteriores. */
export function conectarAccionFalta(
  hoy: string,
  asistencias: Asistencia[],
  repintar: () => void
): void {
  function pedirConfirmacion(fecha: string, origen: "hoy" | "revivir"): void {
    estado.pendiente = { fecha, origen };
    estado.error = null;
    estado.exito = null;
    repintar();
  }

  document
    .querySelector("#falta-hoy")
    ?.addEventListener("click", () => pedirConfirmacion(hoy, "hoy"));

  document.querySelector("#falta-revivir")?.addEventListener("click", () => {
    const rota = faltaQueRompioLaRacha(asistencias, hoy);
    if (rota !== null) pedirConfirmacion(rota, "revivir");
  });

  document.querySelector("#falta-cancelar")?.addEventListener("click", () => {
    estado.pendiente = null;
    repintar();
  });

  document.querySelector("#falta-confirmar")?.addEventListener("click", async () => {
    const pendiente = estado.pendiente;
    if (!pendiente || estado.enVuelo) return;
    estado.enVuelo = true;
    estado.error = null;
    repintar();
    try {
      await revivirRacha({ fecha: pendiente.fecha });
      estado.exito = pendiente.origen;
      estado.pendiente = null;
    } catch (error) {
      // El cupo agotado no es un error genérico: el cliente necesita saber que ya gastó los
      // tres del mes, no que "algo falló". El código viene de la `HttpsError` de la función.
      const codigo = (error as { code?: string }).code;
      estado.error = {
        origen: pendiente.origen,
        texto:
          codigo === "functions/resource-exhausted"
            ? `Ya usaste tus ${MAXIMO_POR_MES} revives de este mes.`
            : "No pudimos registrar tu aviso. Inténtalo otra vez en un momento.",
      };
      estado.pendiente = null;
    } finally {
      estado.enVuelo = false;
      repintar();
    }
  });
}
