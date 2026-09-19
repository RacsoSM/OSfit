import type { Asistencia, Cliente } from "../datos";
import { MAXIMO_POR_MES, disponiblesEnElMes } from "../cupo";
import { faltaQueRompioLaRacha } from "../faltaRompio";
import { avisarFalta, revivirRacha } from "../acciones";
import { escapar, esFinDeSemana } from "./tarjetaDia";
import { castigoDelMes, type Tirada } from "../tirada";
import { abrirRuleta } from "./ruleta";

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
 *
 * Las dos llaman a endpoints DISTINTOS, y esa es la diferencia que importa:
 *
 *  - "Hoy no voy a poder ir" → `avisarFalta`. Gratis. Solo le dice al entrenador que hoy no
 *    va, y el botón se va el resto del día.
 *  - "Revivir mi racha" → `revivirRacha`. Cuesta uno de los 3 del mes, y por eso se confirma.
 *
 * Hasta el 2026-09-12 las dos llamaban a `revivirRacha`: avisar con educación cobraba un
 * revive sin que nadie lo hubiera pedido. Ver `docs/backlog.md`.
 */

/** La fecha que se está por revivir. Solo "Revivir mi racha" confirma: avisar no cuesta nada. */
type Pendiente = { fecha: string } | null;

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

/**
 * "Te quedan 2 este mes." / "Te queda 1 este mes."
 *
 * En un mes castigado dice además por qué: sin esa frase el cliente ve un número que no
 * cuadra con los 3 que se le prometieron y no tiene forma de saber de dónde salió.
 */
function cuantosQuedan(disponibles: number, castigado: boolean): string {
  const base = disponibles === 1 ? "Te queda 1 este mes." : `Te quedan ${disponibles} este mes.`;
  return castigado ? `${base} (perdiste la ruleta el mes pasado)` : base;
}

/**
 * El diálogo del spec, palabra por palabra. Se confirma antes de gastar porque son 3 al mes y
 * el cliente no debe descubrir que gastó uno por un toque accidental.
 */
function confirmacion(disponibles: number): string {
  return `
    <p class="confirmar-titulo">¿Usar uno de tus ${MAXIMO_POR_MES} revives?</p>
    <p class="accion-nota">${cuantosQuedan(disponibles, false)}</p>
    <div class="fila-botones">
      <button id="falta-cancelar" class="boton secundario" ${estado.enVuelo ? "disabled" : ""}>
        Cancelar
      </button>
      <button id="falta-confirmar" class="boton" ${estado.enVuelo ? "disabled" : ""}>
        ${estado.enVuelo ? "Enviando…" : "Sí, usar uno"}
      </button>
    </div>`;
}

/** Lo que ve quien revive su racha. */
const ACUSE_REVIVIR = `<p class="aviso-ok">Has revivido tu racha!</p>`;

/** Lo que ve quien avisa que hoy no puede. No menciona rachas: no se gastó nada. */
const ACUSE_AVISO = `<p class="aviso-ok">Entendido, esperamos que todo esté bien, nos vemos pronto!</p>`;

/**
 * "Hoy no voy a poder ir". Se pinta dentro de la tarjeta del día, sin envoltorio propio.
 *
 * `yaAviso` viene de Firestore y no de `estado`: el botón tiene que seguir escondido el resto
 * del día aunque el cliente recargue o abra la página en otro teléfono. `estado.exito` es
 * solo el adelanto local, para que el acuse salga en el mismo instante en que toca y no
 * cuando llegue el snapshot.
 */
export function accionHoyNoPuedo(cliente: Cliente, hoy: string, yaAviso: boolean): string {
  if (esFinDeSemana(hoy)) return "";

  const error =
    estado.error?.origen === "hoy"
      ? `<p class="aviso-error">${escapar(estado.error.texto)}</p>`
      : "";

  // Ya avisó: el acuse ocupa el lugar del botón, no se suma debajo. Volver a ofrecerlo
  // después de decir "nos vemos pronto" invita a tocarlo otra vez sin que signifique nada.
  if (yaAviso || estado.exito === "hoy") return `${error}${ACUSE_AVISO}`;

  return `
    ${error}
    <button id="falta-hoy" class="boton secundario"
            ${!cliente.activo || estado.enVuelo ? "disabled" : ""}>
      ${estado.enVuelo && estado.pendiente === null ? "Avisando…" : "Hoy no voy a poder ir"}
    </button>`;
}

/**
 * "Revivir mi racha", en su propia tarjeta debajo de la racha y el promedio.
 *
 * No se dibuja si no hay nada que reparar. Son dos motivos distintos y los dos terminan igual:
 * la racha está viva, o la rotura ya quedó fuera de la ventana de 2 días hábiles. En ninguno
 * de los dos casos la página le recuerda al cliente que puede faltar.
 *
 * Desde la ruleta (2026-09-18) esta tarjeta tiene dos estados más, y la regla que los ordena
 * es que **el juego solo existe donde antes había una pared**: sin cupo, con la racha rota y
 * la cuenta activa. Con cupo no cambia nada, que es el camino de todos los clientes.
 */
export function tarjetaRevivir(
  cliente: Cliente,
  hoy: string,
  asistencias: Asistencia[],
  tiradaEsteMes: Tirada | null,
  tiradaMesAnterior: Tirada | null
): string {
  if (esFinDeSemana(hoy)) return "";

  const rota = faltaQueRompioLaRacha(asistencias, hoy);
  if (rota === null && estado.exito !== "revivir") return "";

  const castigo = castigoDelMes(tiradaMesAnterior);
  const disponibles = disponiblesEnElMes(asistencias, hoy.slice(0, 7), castigo);
  const sinCupo = disponibles === 0;
  const bloqueado = !cliente.activo || sinCupo || estado.enVuelo;

  // La propuesta: sin cupo, con la cuenta activa y sin haber jugado este mes.
  const ofreceJuego = sinCupo && cliente.activo && tiradaEsteMes === null && rota !== null;

  const cuerpo =
    estado.pendiente !== null
      ? confirmacion(disponibles)
      : estado.exito === "revivir"
        ? ACUSE_REVIVIR
        : ofreceJuego
          ? `<p class="accion-nota">💔 Te quedaste sin vidas para revivir tu racha… pero te
               tengo una propuesta.</p>
             <button id="falta-propuesta" class="boton">Leer propuesta</button>`
          : `<button id="falta-revivir" class="boton secundario" ${bloqueado ? "disabled" : ""}>
               💔 Revivir mi racha
             </button>
             <p class="accion-nota">Repara tu falta del ${escapar(enPalabras(rota as string))}.</p>
             ${
               !cliente.activo
                 ? `<p class="accion-nota">Tu cuenta está pausada. Habla con tu entrenador.</p>`
                 : sinCupo
                   ? `<p class="accion-nota">Ya usaste tus revives de este mes. Y tu tirada.</p>`
                   : `<p class="accion-nota">${cuantosQuedan(disponibles, castigo > 0)}</p>`
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
  // Avisar no se confirma: no cuesta nada y confirmarlo solo estorbaría a quien ya decidió
  // que hoy no puede. Lo que sí hace falta es que un doble toque no mande dos llamadas.
  document.querySelector("#falta-hoy")?.addEventListener("click", async () => {
    if (estado.enVuelo) return;
    estado.enVuelo = true;
    estado.error = null;
    repintar();
    try {
      await avisarFalta({});
      estado.exito = "hoy";
    } catch {
      // Avisar no tiene errores propios que valga la pena distinguir: no hay cupo que se
      // agote ni fecha que revalidar, así que cualquier fallo es "no llegó, vuelve a
      // intentar" y el botón se queda donde estaba.
      estado.error = {
        origen: "hoy",
        texto: "No pudimos registrar tu aviso. Inténtalo otra vez en un momento.",
      };
    } finally {
      estado.enVuelo = false;
      repintar();
    }
  });

  // La propuesta solo abre el modal: la ruleta tiene su propio estado y su propio conectado.
  document.querySelector("#falta-propuesta")?.addEventListener("click", () => {
    abrirRuleta();
    repintar();
  });

  document.querySelector("#falta-revivir")?.addEventListener("click", () => {
    const rota = faltaQueRompioLaRacha(asistencias, hoy);
    if (rota === null) return;
    estado.pendiente = { fecha: rota };
    estado.error = null;
    estado.exito = null;
    repintar();
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
      estado.exito = "revivir";
      estado.pendiente = null;
    } catch (error) {
      // El cupo agotado no es un error genérico: el cliente necesita saber que ya gastó los
      // tres del mes, no que "algo falló". El código viene de la `HttpsError` de la función.
      const codigo = (error as { code?: string }).code;
      estado.error = {
        origen: "revivir",
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
