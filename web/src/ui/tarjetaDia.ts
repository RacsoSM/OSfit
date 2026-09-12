import type { Cliente } from "../datos";
import { interpretar } from "../dia";

/** Sábado y domingo no cuentan para la racha, así que la página lo dice en vez de mostrar
 *  un día de rutina que nadie va a hacer. */
export function esFinDeSemana(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00`).getUTCDay();
  return dia === 0 || dia === 6;
}

export function escapar(texto: string): string {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

/**
 * La tarjeta muestra **solo el nombre del día**, nunca los ejercicios. Es deliberado: la
 * rutina se la manda el entrenador cuando el cliente la pide, y esa entrega sigue siendo un
 * acto suyo y no un autoservicio. Ver el spec, sección "Por qué la página no muestra los
 * ejercicios".
 */
export function tarjetaDia(cliente: Cliente, hoy: string): string {
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

  return `
    <div class="tarjeta hoy">
      <p class="tarjeta-titulo">Hoy te toca</p>
      <p class="hoy-dia">Día ${indice + 1}<br>${escapar(dias[indice]?.nombreDia ?? "")}</p>
    </div>`;
}
