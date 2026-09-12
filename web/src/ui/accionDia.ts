import type { Cliente } from "../datos";
import { MOTIVOS, motivosPara } from "../motivos";
import { cambiarDia } from "../acciones";
import { horaEnMazatlan } from "../fecha";
import { escapar, esFinDeSemana } from "./tarjetaDia";

/** Mismo tope que `MOTIVO_MAXIMO` en `functions/src/cambiarDia.ts`. */
const MOTIVO_MAXIMO = 200;

/**
 * El estado vive en el módulo y no en el DOM porque `pintar()` reconstruye toda la página en
 * cada snapshot de Firestore: si la hoja abierta, la selección o el "enviando…" vivieran en
 * los elementos, un snapshot que llegara mientras el cliente elige le cerraría la hoja en la
 * cara sin que él hubiera tocado nada.
 */
interface Estado {
  abierta: boolean;
  diaElegido: number | null;
  motivoId: string | null;
  motivoTexto: string;
  textoLibre: string;
  enVuelo: boolean;
  error: string | null;
  /** Lo que se le confirma al cliente después de cambiar: hora y motivo elegido. */
  confirmacion: { hora: string; motivo: string } | null;
}

const estado: Estado = {
  abierta: false,
  diaElegido: null,
  motivoId: null,
  motivoTexto: "",
  textoLibre: "",
  enVuelo: false,
  error: null,
  confirmacion: null,
};

/**
 * Si la hoja de motivos está abierta. Mientras lo esté, la tarjeta del día no dibuja el otro
 * botón: el cliente está en mitad de elegir día y motivo, y un "Hoy no voy a poder ir" colgado
 * debajo de Cancelar/Cambiar se lee como una tercera opción del formulario.
 */
export function hojaDeMotivosAbierta(): boolean {
  return estado.abierta;
}

/** El motivo que se va a mandar: el texto libre si eligió "Otro", si no el del catálogo. */
function motivoAEnviar(): string {
  return estado.motivoId === "otro" ? estado.textoLibre.trim() : estado.motivoTexto;
}

function listoParaEnviar(): boolean {
  const motivo = motivoAEnviar();
  return (
    estado.diaElegido !== null &&
    estado.motivoId !== null &&
    motivo !== "" &&
    motivo.length <= MOTIVO_MAXIMO
  );
}

function hoja(cliente: Cliente): string {
  const dias = cliente.rutinaAsignada?.dias ?? [];

  const opcionesDia = dias
    .map(
      (dia, indice) => `
        <button class="opcion ${estado.diaElegido === indice ? "elegida" : ""}"
                data-dia="${indice}" ${estado.enVuelo ? "disabled" : ""}>
          Día ${indice + 1} · ${escapar(dia.nombreDia)}
        </button>`
    )
    .join("");

  const opcionesMotivo = motivosPara(cliente.nombre)
    .map(
      (motivo) => `
        <button class="opcion ${estado.motivoId === motivo.id ? "elegida" : ""}"
                data-motivo="${motivo.id}" ${estado.enVuelo ? "disabled" : ""}>
          ${escapar(motivo.texto)}
        </button>`
    )
    .join("");

  // El texto libre es lo único de esta pantalla que escribe el cliente, así que se escapa al
  // devolverlo: acaba dentro del HTML que arma esta misma función.
  const campoLibre =
    estado.motivoId === "otro"
      ? `<textarea id="motivo-libre" class="campo-libre" rows="2" maxlength="${MOTIVO_MAXIMO}"
                   placeholder="Cuéntale a tu entrenador"
                   ${estado.enVuelo ? "disabled" : ""}>${escapar(estado.textoLibre)}</textarea>`
      : "";

  return `
    <p class="accion-subtitulo">¿Qué día quieres hacer?</p>
    <div class="opciones">${opcionesDia}</div>
    <p class="accion-subtitulo">¿Por qué?</p>
    <div class="opciones">${opcionesMotivo}</div>
    ${campoLibre}
    ${estado.error ? `<p class="aviso-error">${escapar(estado.error)}</p>` : ""}
    <div class="fila-botones">
      <button id="cerrar-cambio-dia" class="boton secundario" ${estado.enVuelo ? "disabled" : ""}>
        Cancelar
      </button>
      <button id="enviar-cambio-dia" class="boton"
              ${estado.enVuelo || !listoParaEnviar() ? "disabled" : ""}>
        ${estado.enVuelo ? "Cambiando…" : "Cambiar mi día"}
      </button>
    </div>`;
}

/**
 * "Quiero cambiar el día que me toca" (spec, "Tarjeta del día"), con su hoja de motivos.
 *
 * No se muestra el fin de semana — no hay día que cambiar — ni sin rutina asignada. Con el
 * cliente inactivo la acción queda deshabilitada: su historial es suyo, cambiar una rutina
 * que no está haciendo no.
 *
 * `yaAsistioHoy` la deshabilita también: con la asistencia de hoy ya marcada el día está
 * hecho, y cambiarlo entonces no movería el entrenamiento que acaba de hacer, solo
 * desordenaría el ciclo. El servidor rechaza el caso igual, por si alguien llama a la
 * función a mano.
 */
export function accionDia(cliente: Cliente, hoy: string, yaAsistioHoy: boolean): string {
  const dias = cliente.rutinaAsignada?.dias ?? [];
  if (dias.length === 0 || esFinDeSemana(hoy)) return "";

  if (!cliente.activo) {
    return `
      <button class="boton" disabled>Quiero cambiar el día que me toca</button>
      <p class="accion-nota">Tu cuenta está pausada. Habla con tu entrenador.</p>`;
  }

  // Deshabilitado y no escondido: la nota explica por qué, y un botón que desaparece sin
  // decir nada se lee como que la página se rompió.
  if (yaAsistioHoy) {
    return `
      <button class="boton" disabled>Quiero cambiar el día que me toca</button>
      <p class="accion-nota">Ya registraste tu asistencia de hoy.</p>`;
  }

  // Sin esta línea el cliente no sabe si el toque funcionó y vuelve a tocar (spec, "Tarjeta
  // del día").
  const confirmacion = estado.confirmacion
    ? `<p class="aviso-ok">
         Cambiaste tu día a las ${escapar(estado.confirmacion.hora)} ·
         ${escapar(estado.confirmacion.motivo)}
       </p>`
    : "";

  const cuerpo = estado.abierta
    ? hoja(cliente)
    : `<button id="abrir-cambio-dia" class="boton">Quiero cambiar el día que me toca</button>
       ${estado.error ? `<p class="aviso-error">${escapar(estado.error)}</p>` : ""}`;

  // Sin envoltorio de tarjeta: esto se pinta dentro de la tarjeta del día.
  return `${confirmacion}${cuerpo}`;
}

/** Se vuelve a llamar en cada repintado, porque `innerHTML` tira los listeners anteriores. */
export function conectarAccionDia(repintar: () => void): void {
  document.querySelector("#abrir-cambio-dia")?.addEventListener("click", () => {
    estado.abierta = true;
    estado.error = null;
    repintar();
  });

  document.querySelector("#cerrar-cambio-dia")?.addEventListener("click", () => {
    estado.abierta = false;
    estado.error = null;
    repintar();
  });

  document.querySelectorAll<HTMLElement>("[data-dia]").forEach((boton) => {
    boton.addEventListener("click", () => {
      estado.diaElegido = Number(boton.dataset.dia);
      repintar();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-motivo]").forEach((boton) => {
    boton.addEventListener("click", () => {
      estado.motivoId = boton.dataset.motivo ?? null;
      estado.motivoTexto = MOTIVOS.find((m) => m.id === estado.motivoId)?.texto ?? "";
      repintar();
    });
  });

  const libre = document.querySelector<HTMLTextAreaElement>("#motivo-libre");
  libre?.addEventListener("input", () => {
    estado.textoLibre = libre.value;
    // Se habilita el botón a mano en vez de repintar: repintar en cada tecla le quitaría el
    // foco al cliente a media palabra.
    const enviar = document.querySelector<HTMLButtonElement>("#enviar-cambio-dia");
    if (enviar) enviar.disabled = !listoParaEnviar();
  });

  document.querySelector("#enviar-cambio-dia")?.addEventListener("click", async () => {
    if (estado.enVuelo || !listoParaEnviar()) return;
    const motivo = motivoAEnviar();
    estado.enVuelo = true;
    estado.error = null;
    repintar();
    try {
      await cambiarDia({ diaIndex: estado.diaElegido!, motivo });
      // La tarjeta del día se repinta sola: `observarCliente` ya está suscrito y la función
      // dejó el trío denormalizado actualizado antes de responder.
      estado.confirmacion = { hora: horaEnMazatlan(), motivo };
      estado.abierta = false;
      estado.diaElegido = null;
      estado.motivoId = null;
      estado.motivoTexto = "";
      estado.textoLibre = "";
    } catch {
      estado.error = "No pudimos cambiar tu día. Inténtalo otra vez en un momento.";
    } finally {
      estado.enVuelo = false;
      repintar();
    }
  });
}
