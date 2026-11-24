import { escapar } from "./tarjetaDia";

/**
 * Quejas y sugerencias (entrenador, 2026-11-24): un campo de texto y "Enviar". Lo que escribe
 * le llega al entrenador como notificación (`enviarSugerencia` en functions) con su nombre, y
 * la página se lo dice para que no lo escriba creyendo que es anónimo.
 *
 * El texto y el estado viven en el módulo y no en el DOM, como en "cambiar mi día": un snapshot
 * de Firestore repinta y no debe borrarle lo que lleva escrito.
 */

export const LARGO_MAXIMO = 1000;

let texto = "";
let estado: "escribiendo" | "enviando" | "enviado" = "escribiendo";
let error: string | null = null;

/** Para los tests y al salir de la ventana después de enviar: vuelve al campo vacío. */
export function reiniciarSugerencias(): void {
  if (estado === "enviado") texto = "";
  if (estado !== "enviando") estado = "escribiendo";
  error = null;
}

/** El mensaje según por qué falló (`HttpsError` de la función, o sin internet). */
export function mensajeDeError(e: unknown): string {
  const motivo = (e as { message?: unknown } | null)?.message;
  if (motivo === "limite") return "Ya enviaste varios mensajes hoy. Puedes escribir otro mañana.";
  if (motivo === "texto_invalido") return `Escribe tu mensaje (hasta ${LARGO_MAXIMO} letras).`;
  return "No se pudo enviar. Revisa tu conexión e inténtalo otra vez.";
}

export function ventanaSugerencias(): string {
  if (estado === "enviado") {
    return `
      <div class="tarjeta sugerencias">
        <p class="sugerencias-gracias">¡Gracias! 🙌</p>
        <p class="sugerencias-nota">Tu mensaje ya les llegó a tus coaches.</p>
        <button type="button" class="boton secundario" id="sugerencia-otra">Escribir otro</button>
      </div>`;
  }
  const enviando = estado === "enviando";
  return `
    <div class="tarjeta sugerencias">
      <p class="sugerencias-intro">¿Algo que no te gustó, o algo que te gustaría que mejoráramos? Escríbelo aquí: les llega directo a tus coaches.</p>
      <textarea id="sugerencia-texto" class="campo-libre sugerencias-campo" rows="7" maxlength="${LARGO_MAXIMO}"
                placeholder="Escribe tu queja o sugerencia…" ${enviando ? "disabled" : ""}>${escapar(texto)}</textarea>
      <div class="sugerencias-pie">
        <span class="sugerencias-nota">Tus coaches verán tu nombre.</span>
        <span class="sugerencias-contador" id="sugerencia-contador">${texto.length}/${LARGO_MAXIMO}</span>
      </div>
      ${error ? `<p class="aviso-error">${escapar(error)}</p>` : ""}
      <button type="button" class="boton" id="sugerencia-enviar" ${enviando || texto.trim() === "" ? "disabled" : ""}>
        ${enviando ? "Enviando…" : "Enviar"}
      </button>
    </div>`;
}

/** Se vuelve a colgar en cada repintado (`innerHTML` tira los anteriores). */
export function conectarSugerencias(repintar: () => void, enviar: (texto: string) => Promise<unknown>): void {
  const campo = document.querySelector<HTMLTextAreaElement>("#sugerencia-texto");
  campo?.addEventListener("input", () => {
    texto = campo.value;
    // Sin repintar en cada tecla: le quitaría el foco a media palabra.
    const contador = document.querySelector("#sugerencia-contador");
    if (contador) contador.textContent = `${texto.length}/${LARGO_MAXIMO}`;
    const boton = document.querySelector<HTMLButtonElement>("#sugerencia-enviar");
    if (boton) boton.disabled = texto.trim() === "";
  });
  document.querySelector("#sugerencia-enviar")?.addEventListener("click", async () => {
    if (estado === "enviando" || texto.trim() === "") return;
    estado = "enviando";
    error = null;
    repintar();
    try {
      await enviar(texto.trim());
      estado = "enviado";
      texto = "";
    } catch (e) {
      estado = "escribiendo";
      error = mensajeDeError(e);
    }
    repintar();
  });
  document.querySelector("#sugerencia-otra")?.addEventListener("click", () => {
    estado = "escribiendo";
    repintar();
  });
}
