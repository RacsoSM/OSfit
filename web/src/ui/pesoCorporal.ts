/**
 * El peso corporal en Músculos. Su fuerza se mide contra él (1RM ÷ peso), así que sin peso la
 * ventana no deja pasar: un aviso al centro, encima del mapa, con el campo para anotarlo.
 * Con peso, abajo del mapa queda una línea para actualizarlo, que abre el mismo aviso.
 *
 * Guardar pasa por la función `guardarPeso`; no hace falta repintar a mano al terminar: el
 * peso nuevo llega con el snapshot del cliente y `main.ts` repinta la ventana.
 */

export const PESO_MIN = 25;
export const PESO_MAX = 300;

/** Abierto a mano con "Actualizar" (con peso ya guardado). Fuera del DOM: sobrevive repintados. */
let editando = false;
/** Mientras espera a la función, para que un repintado no reactive el botón. */
let guardando = false;
let error: string | null = null;
/**
 * Lo último que guardó, hasta que el snapshot del cliente lo confirme: la respuesta de la
 * función puede llegar antes que el snapshot, y sin esto el aviso reaparecería un instante.
 */
let recienGuardado: number | null = null;
/** Lo que lleva escrito: un snapshot que llega mientras escribe repinta y no debe borrarlo. */
let borrador: string | null = null;

const tienePeso = (peso: number | null | undefined): peso is number =>
  typeof peso === "number" && peso > 0;

/**
 * Lo que escribió, en kg con un decimal, o null si no es un peso de persona. Acepta coma
 * decimal ("62,5"): es como lo escriben en un teclado en español.
 */
export function pesoValido(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  if (n < PESO_MIN || n > PESO_MAX) return null;
  return Math.round(n * 10) / 10;
}

/** El peso que vale: el recién guardado mientras el del cliente no lo alcance. */
function pesoActual(peso: number | null | undefined): number | null {
  if (recienGuardado !== null && peso === recienGuardado) recienGuardado = null;
  return recienGuardado ?? (tienePeso(peso) ? peso : null);
}

/** Sin peso no hay Músculos. */
export function necesitaPeso(peso: number | null | undefined): boolean {
  return pesoActual(peso) === null;
}

/**
 * El aviso que bloquea la ventana, o la línea para actualizar el peso. Va después del mapa:
 * el velo es `fixed`, tapa todo menos la barra de abajo, así que puede salir a otra ventana.
 */
export function bloquePeso(pesoCliente: number | null | undefined): string {
  const peso = pesoActual(pesoCliente);
  const obligatorio = peso === null;
  // Con peso, solo el botón: el número no se muestra en la pantalla (entrenador, 2026-10-14).
  if (!obligatorio && !editando) {
    return `
      <p class="peso-linea">
        <button type="button" class="boton-texto" id="peso-actualizar">Actualizar peso corporal</button>
      </p>`;
  }
  const valor = (borrador ?? (peso === null ? "" : String(peso))).replace(/"/g, "");
  return `
    <div class="peso-velo">
      <form class="peso-aviso tarjeta" id="peso-form" role="dialog" aria-modal="true"
            aria-labelledby="peso-titulo" novalidate>
        <div class="vacio-emoji" aria-hidden="true">⚖️</div>
        <p class="peso-titulo" id="peso-titulo">
          ${obligatorio
            ? "Para acceder a esta función, necesitas ingresar tu peso corporal"
            : "Actualiza tu peso corporal"}
        </p>
        <p class="peso-texto">Tu fuerza se compara contra tu peso: así sabemos qué tan fuerte eres.</p>
        <label class="registro-campo peso-campo">
          <input id="peso-input" inputmode="decimal" autocomplete="off" placeholder="0"
                 value="${valor}" aria-label="Tu peso corporal en kilos"${guardando ? " disabled" : ""}>
          <span>kg</span>
        </label>
        ${error ? `<p class="peso-error" role="alert">${error}</p>` : ""}
        <button type="submit" class="boton" id="peso-guardar"${guardando ? " disabled" : ""}>
          ${guardando ? "Guardando…" : "Guardar"}
        </button>
        ${obligatorio ? "" : `<button type="button" class="boton secundario" id="peso-cancelar"${guardando ? " disabled" : ""}>Cancelar</button>`}
      </form>
    </div>`;
}

/**
 * Cuelga los eventos del bloque recién pintado. `repintar` vuelve a pintar la ventana (para
 * abrir, cerrar o mostrar un error); `guardar` llama a la función.
 */
export function conectarPeso(
  repintar: () => void,
  guardar: (peso: number) => Promise<unknown>
): void {
  document.querySelector<HTMLInputElement>("#peso-input")?.addEventListener("input", (e) => {
    borrador = (e.target as HTMLInputElement).value;
  });
  document.querySelector("#peso-actualizar")?.addEventListener("click", () => {
    editando = true;
    borrador = null;
    error = null;
    repintar();
    document.querySelector<HTMLInputElement>("#peso-input")?.focus();
  });
  document.querySelector("#peso-cancelar")?.addEventListener("click", () => {
    editando = false;
    borrador = null;
    error = null;
    repintar();
  });
  document.querySelector<HTMLFormElement>("#peso-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (guardando) return;
    const texto = document.querySelector<HTMLInputElement>("#peso-input")?.value ?? "";
    const peso = pesoValido(texto);
    if (peso === null) {
      error = `Escribe tu peso en kilos, entre ${PESO_MIN} y ${PESO_MAX}.`;
      repintar();
      return;
    }
    guardando = true;
    error = null;
    repintar();
    try {
      await guardar(peso);
      recienGuardado = peso;
      editando = false;
      borrador = null;
    } catch {
      error = "No se pudo guardar. Revisa tu conexión e inténtalo otra vez.";
    } finally {
      guardando = false;
      repintar();
    }
  });
}

/** Solo para tests. */
export function reiniciarPeso(): void {
  editando = false;
  guardando = false;
  error = null;
  recienGuardado = null;
  borrador = null;
}
