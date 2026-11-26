import { DIAS_PARA_AVANZAR, SEMANAS, type SemanaCiclo, type Sugerencia } from "../ciclo";

/**
 * El RPE de la semana en la tarjeta "Hoy te toca" (entrenador, 2026-11-26; el ciclo en
 * `ciclo.ts`): la pastilla "RPE 8" arriba a la derecha, que al tocarla explica qué es el RPE y
 * muestra las 4 semanas del bloque; debajo del nombre, la barra del bloque con la semana marcada,
 * y la sugerencia según lo que ella reportó.
 */

let abierta = false;
let recienAbierta = false;

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

/** La explicación, como pop up (mismo velo que los demás avisos). */
export function modalRpe(s: SemanaCiclo): string {
  if (!abierta) return "";
  const entrada = recienAbierta ? " entrando" : "";
  recienAbierta = false;
  const filas = SEMANAS.map((x, i) => `
      <li class="rpe-semana${i + 1 === s.numero ? " actual" : ""}">
        <span class="rpe-num">${i + 1}</span>
        <span class="rpe-fase">${NOMBRE_FASE[x.fase]}</span>
        <span class="rpe-valor">RPE ${x.rpe}</span>
      </li>`).join("");
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
        <button type="button" class="boton" id="cerrar-rpe">Entendido</button>
      </div>
    </div>`;
}

export function conectarRpe(repintar: () => void): void {
  document.querySelector("#abrir-rpe")?.addEventListener("click", () => {
    abierta = true;
    recienAbierta = true;
    repintar();
  });
  const cerrar = () => { abierta = false; repintar(); };
  document.querySelector("#cerrar-rpe")?.addEventListener("click", cerrar);
  document.querySelector("[data-cerrar-rpe]")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) cerrar();
  });
}
