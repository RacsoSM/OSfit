import type { Cliente } from "../datos";
import { interpretar } from "../dia";

/** Sábado y domingo no cuentan para la racha, así que la página lo dice en vez de mostrar
 *  un día de rutina que nadie va a hacer. */
export function esFinDeSemana(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00`).getUTCDay();
  return dia === 0 || dia === 6;
}

/**
 * Escapa a mano y no con un `<div>` de usar y tirar por dos razones: los tests corren sin DOM,
 * y el truco del `textContent` deja las comillas intactas — inofensivas en texto, pero esto
 * también termina dentro de atributos (`src`, `alt`) donde una comilla sí escapa del valor.
 */
export function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * La tarjeta muestra **solo el nombre del día**, nunca los ejercicios. Es deliberado: la
 * rutina se la manda el entrenador cuando el cliente la pide, y esa entrega sigue siendo un
 * acto suyo y no un autoservicio. Ver el spec, sección "Por qué la página no muestra los
 * ejercicios".
 */
export function tarjetaDia(cliente: Cliente, hoy: string, acciones = ""): string {
  const dias = cliente.rutinaAsignada?.dias ?? [];

  if (dias.length === 0) {
    return `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">🌱</div>
        <p><strong>Todavía no tienes rutina</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">
          Tu entrenador te la asigna y aparece aquí.
        </p>
      </div>`;
  }

  const indice = interpretar(
    { dia: cliente.ultimoDia, fecha: cliente.ultimoDiaFecha, esAncla: cliente.ultimoDiaEsAncla },
    dias.length,
    hoy
  );

  if (esFinDeSemana(hoy)) {
    const proximo = indice !== null ? dias[indice]?.nombreDia ?? "" : "";
    return `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">😴</div>
        <p><strong>Hoy toca descansar</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">
          El lunes te toca ${escapar(proximo)}.
        </p>
      </div>`;
  }

  if (indice === null) return "";

  // Las acciones van DENTRO de esta tarjeta, no en una aparte: las dos hablan del día que le
  // toca hoy — cambiarlo o avisar que no viene — así que se leen junto al día del que hablan.
  return `
    <div class="tarjeta hoy">
      <p class="tarjeta-titulo">Hoy te toca</p>
      <p class="hoy-dia">Día ${indice + 1}<br>${escapar(dias[indice]?.nombreDia ?? "")}</p>
      ${acciones ? `<div class="hoy-acciones">${acciones}</div>` : ""}
    </div>`;
}
