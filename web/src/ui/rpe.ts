import { DIAS_PARA_AVANZAR, SEMANAS, type SemanaCiclo, type Sugerencia } from "../ciclo";

/**
 * El RPE de la semana en la tarjeta "Hoy te toca" (entrenador, 2026-11-26; el ciclo en
 * `ciclo.ts`): la pastilla "RPE 8" arriba a la derecha, que al tocarla explica qué es el RPE y
 * muestra las 4 semanas del bloque; debajo del nombre, la barra del bloque con la semana marcada,
 * y la sugerencia según lo que ella reportó.
 */

let abierta = false;
let recienAbierta = false;
/** La semana que tocó en la explicación y falta confirmar; null sin confirmación abierta. */
let porConfirmar: number | null = null;
let enVuelo = false;
let error: string | null = null;
/**
 * El cambio ya hecho mientras el documento de la clienta todavía no lo trae: así la tarjeta
 * cambia al instante y no regresa un momento a la semana vieja.
 */
let ajustePropio: { semana: number; lunes: string } | null = null;

/** La semana elegida que manda, la del documento o la recién cambiada aquí. */
export function ajusteVigente(delDocumento: { semana: number; lunes: string } | null | undefined): { semana: number; lunes: string } | null {
  if (ajustePropio && delDocumento && delDocumento.semana === ajustePropio.semana && delDocumento.lunes === ajustePropio.lunes) {
    ajustePropio = null;
  }
  return ajustePropio ?? delDocumento ?? null;
}

const NOMBRE_FASE: Record<SemanaCiclo["fase"], string> = {
  base: "Base", carga: "Carga", fuerza: "Fuerza", descarga: "Descarga",
};

/** Qué significa cada objetivo, en palabras de gimnasio. */
const EN_PALABRAS: Record<SemanaCiclo["fase"], string> = {
  base: "Termina cada serie sintiendo que te quedaban unas 3 repeticiones.",
  carga: "Termina cada serie sintiendo que te quedaban unas 2 repeticiones.",
  fuerza: "La semana más pesada: termina cada serie con 1 o 2 repeticiones en reserva.",
  descarga: "Semana para recuperarte: baja el peso y termina las series con 4 o más repeticiones de sobra.",
};

export function pastillaRpe(s: SemanaCiclo): string {
  return `<button type="button" class="dh-rpe${s.fase === "descarga" ? " descarga" : ""}" id="abrir-rpe"
            aria-label="Esta semana: ${NOMBRE_FASE[s.fase]}, RPE ${s.rpe}, semana ${s.numero} de ${s.total}. Toca para ver qué significa.">RPE ${s.rpe}</button>`;
}

/**
 * Las 4 semanas del bloque como barra, con la de esta semana marcada (diseño 4 del entrenador,
 * 2026-11-26): así se entiende sola por qué una semana toca descarga. Solo adorno para el lector
 * de pantalla: la pastilla ya lo dice.
 */
export function barraCiclo(s: SemanaCiclo): string {
  const tramos = SEMANAS.map((x, i) =>
    `<span class="dh-tramo${i + 1 === s.numero ? " actual" : ""}"><i></i>${NOMBRE_FASE[x.fase]}</span>`).join("");
  return `<div class="dh-ciclo" aria-hidden="true">${tramos}</div>`;
}

export function notaRpe(sug: Sugerencia, s: SemanaCiclo): string {
  if (!sug) return "";
  const objetivo = s.rpe;
  return sug.tipo === "pesada"
    ? `<p class="dh-sugerencia pesada">Esta semana tus entrenamientos se están sintiendo más pesados de lo planeado (${sug.promedio} contra ${objetivo}). Considera adelantar tu semana de descarga: bájale un poco al peso.</p>`
    : `<p class="dh-sugerencia ligera">Esta semana tus entrenamientos se están sintiendo ligeros (${sug.promedio} contra ${objetivo}). Puedes subirle un poco al peso.</p>`;
}

/**
 * La explicación, como pop up (mismo velo que los demás avisos). Las otras semanas del bloque se
 * pueden tocar para cambiarse a ella, con una confirmación que recomienda decidirlo con su coach
 * (entrenador, 2026-11-26).
 */
export function modalRpe(s: SemanaCiclo): string {
  if (!abierta) return "";
  if (porConfirmar !== null) return confirmacion(s, porConfirmar);
  const entrada = recienAbierta ? " entrando" : "";
  recienAbierta = false;
  const filas = SEMANAS.map((x, i) => {
    const actual = i + 1 === s.numero;
    return `
      <li>
        <button type="button" class="rpe-semana${actual ? " actual" : ""}" data-semana="${i + 1}" ${actual ? "disabled" : ""}>
          <span class="rpe-num">${i + 1}</span>
          <span class="rpe-fase">${NOMBRE_FASE[x.fase]}</span>
          <span class="rpe-valor">${actual ? "Tu semana" : `RPE ${x.rpe}`}</span>
        </button>
      </li>`;
  }).join("");
  return `
    <div class="logro-velo rpe-velo${entrada}" data-cerrar-rpe>
      <div class="logro-aviso tarjeta rpe-aviso${entrada}" role="dialog" aria-modal="true" aria-labelledby="rpe-titulo">
        <p class="cd-titulo" id="rpe-titulo">Esta semana: ${NOMBRE_FASE[s.fase]} · RPE ${s.rpe}</p>
        <p class="rpe-texto">${EN_PALABRAS[s.fase]}</p>
        <p class="rpe-texto tenue">El <strong>RPE</strong> es qué tan pesado se siente, del 1 al 10: la misma escala de
          «¿Qué tan pesado estuvo tu entrenamiento?» al terminar. Tu plan va en bloques de 4 semanas que
          suben poco a poco, con una de descarga para recuperarte. Pasas a la siguiente semana cuando
          entrenas al menos ${DIAS_PARA_AVANZAR} días; si no, la semana se repite.</p>
        <ol class="rpe-semanas">${filas}</ol>
        <p class="rpe-texto tenue rpe-pista">Toca otra semana si necesitas cambiarte a ella.</p>
        ${error ? `<p class="aviso-error">${error}</p>` : ""}
        <button type="button" class="boton" id="cerrar-rpe">Entendido</button>
      </div>
    </div>`;
}

function confirmacion(s: SemanaCiclo, semana: number): string {
  const nueva = SEMANAS[semana - 1];
  return `
    <div class="logro-velo rpe-velo" data-cerrar-rpe>
      <div class="logro-aviso tarjeta rpe-aviso" role="alertdialog" aria-modal="true" aria-labelledby="rpe-confirmar">
        <p class="cd-titulo" id="rpe-confirmar">¿Seguro que quieres cambiar tu semana de «${NOMBRE_FASE[s.fase]}» a «${NOMBRE_FASE[nueva.fase]}»?</p>
        <p class="rpe-texto">Te recomendamos tomar esta decisión con tu coach, ya que cambia tu plan de entrenamiento.</p>
        <p class="rpe-texto tenue">Esta semana quedará como ${NOMBRE_FASE[nueva.fase]} (RPE ${nueva.rpe}) y de ahí tu plan seguirá avanzando como siempre.</p>
        ${error ? `<p class="aviso-error">${error}</p>` : ""}
        <div class="cd-botones">
          <button type="button" class="boton secundario" id="cancelar-semana" ${enVuelo ? "disabled" : ""}>Cancelar</button>
          <button type="button" class="boton" id="confirmar-semana" ${enVuelo ? "disabled" : ""}>${enVuelo ? "Cambiando…" : "Sí, cambiar"}</button>
        </div>
      </div>
    </div>`;
}

/**
 * `alCambiar` guarda la semana elegida en el servidor (`cambiarSemana`) y dice esta semana (su
 * lunes); si falla, se queda el pop up con el error.
 */
export function conectarRpe(repintar: () => void, alCambiar: (semana: number) => Promise<{ lunes: string }>): void {
  document.querySelector("#abrir-rpe")?.addEventListener("click", () => {
    abierta = true;
    recienAbierta = true;
    porConfirmar = null;
    error = null;
    repintar();
  });
  const cerrar = () => {
    if (enVuelo) return;
    abierta = false;
    porConfirmar = null;
    error = null;
    repintar();
  };
  document.querySelector("#cerrar-rpe")?.addEventListener("click", cerrar);
  document.querySelector("[data-cerrar-rpe]")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) cerrar();
  });
  document.querySelectorAll<HTMLElement>(".rpe-semana[data-semana]").forEach((b) =>
    b.addEventListener("click", () => {
      porConfirmar = Number(b.dataset.semana);
      error = null;
      repintar();
    })
  );
  document.querySelector("#cancelar-semana")?.addEventListener("click", () => {
    if (enVuelo) return;
    porConfirmar = null;
    error = null;
    repintar();
  });
  document.querySelector("#confirmar-semana")?.addEventListener("click", async () => {
    if (enVuelo || porConfirmar === null) return;
    const semana = porConfirmar;
    enVuelo = true;
    error = null;
    repintar();
    try {
      const { lunes } = await alCambiar(semana);
      ajustePropio = { semana, lunes };
      abierta = false;
      porConfirmar = null;
    } catch {
      error = "No pudimos cambiar tu semana. Revisa tu conexión e inténtalo otra vez.";
    } finally {
      enVuelo = false;
      repintar();
    }
  });
}
