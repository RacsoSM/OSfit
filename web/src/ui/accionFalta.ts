import type { Asistencia, Cliente } from "../datos";
import { MAXIMO_POR_MES, disponiblesEnElMes } from "../cupo";
import { faltaQueRompioLaRacha } from "../faltaRompio";
import { revivirRacha } from "../acciones";
import { escapar, esFinDeSemana } from "./tarjetaDia";

/**
 * Las dos entradas al mismo endpoint: avisar que hoy no se puede venir, y reparar la falta
 * que rompió la racha.
 *
 * Ninguna pide motivo — no hay lista, no hay texto libre, no se guarda nada (spec, "Faltar no
 * pide explicaciones"). Pedirle a alguien enfermo que elija de una lista por qué no puede ir
 * convierte un aviso en un trámite.
 */

/** Cuál de las dos entradas está esperando confirmación, si alguna. */
type Pendiente = { fecha: string } | null;

interface Estado {
  pendiente: Pendiente;
  enVuelo: boolean;
  exito: boolean;
  error: string | null;
}

const estado: Estado = { pendiente: null, enVuelo: false, exito: false, error: null };

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

export function accionFalta(cliente: Cliente, hoy: string, asistencias: Asistencia[]): string {
  // El fin de semana no cuenta para la racha, así que no hay nada que proteger (spec,
  // "Estados vacíos y de excepción").
  if (esFinDeSemana(hoy)) return "";

  const disponibles = disponiblesEnElMes(asistencias, hoy.slice(0, 7));
  const rota = faltaQueRompioLaRacha(asistencias, hoy);
  const sinCupo = disponibles === 0;
  const bloqueado = !cliente.activo || sinCupo || estado.enVuelo;

  // Con la racha viva el botón de revivir no existe: la página no le recuerda al cliente que
  // puede faltar (spec, "Racha y promedio").
  const botonRevivir =
    rota === null
      ? ""
      : `<button id="falta-revivir" class="boton secundario" ${bloqueado ? "disabled" : ""}>
           Revivir mi racha
         </button>
         <p class="accion-nota">Repara tu falta del ${escapar(enPalabras(rota))}.</p>`;

  const nota = !cliente.activo
    ? `<p class="accion-nota">Tu cuenta está pausada. Habla con tu entrenador.</p>`
    : sinCupo
      ? `<p class="accion-nota">Ya usaste tus ${MAXIMO_POR_MES} revives de este mes.</p>`
      : `<p class="accion-nota">${cuantosQuedan(disponibles)}</p>`;

  const cuerpo = estado.pendiente
    ? confirmacion(disponibles)
    : `<button id="falta-hoy" class="boton secundario" ${bloqueado ? "disabled" : ""}>
         Hoy no voy a poder ir
       </button>
       ${botonRevivir}
       ${nota}`;

  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Si no puedes venir</p>
      ${estado.exito ? `<p class="aviso-ok">Esperamos que todo esté bien, te vemos mañana si Dios quiere!</p>` : ""}
      ${estado.error ? `<p class="aviso-error">${escapar(estado.error)}</p>` : ""}
      ${cuerpo}
    </div>`;
}

/** Se vuelve a llamar en cada repintado, porque `innerHTML` tira los listeners anteriores. */
export function conectarAccionFalta(
  hoy: string,
  asistencias: Asistencia[],
  repintar: () => void
): void {
  function pedirConfirmacion(fecha: string): void {
    estado.pendiente = { fecha };
    estado.error = null;
    estado.exito = false;
    repintar();
  }

  document.querySelector("#falta-hoy")?.addEventListener("click", () => pedirConfirmacion(hoy));

  document.querySelector("#falta-revivir")?.addEventListener("click", () => {
    const rota = faltaQueRompioLaRacha(asistencias, hoy);
    if (rota !== null) pedirConfirmacion(rota);
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
      estado.exito = true;
      estado.pendiente = null;
    } catch (error) {
      // El cupo agotado no es un error genérico: el cliente necesita saber que ya gastó los
      // tres del mes, no que "algo falló". El código viene de la `HttpsError` de la función.
      const codigo = (error as { code?: string }).code;
      estado.error =
        codigo === "functions/resource-exhausted"
          ? `Ya usaste tus ${MAXIMO_POR_MES} revives de este mes.`
          : "No pudimos registrar tu aviso. Inténtalo otra vez en un momento.";
      estado.pendiente = null;
    } finally {
      estado.enVuelo = false;
      repintar();
    }
  });
}
