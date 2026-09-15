import type { Asistencia, Cliente, DiaRutina, Ejercicio } from "../datos";
import { interpretar } from "../dia";
import { conPesosPropios } from "../pesosPropios";
import { variacionQueToca } from "../variacion";

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
 * La tarjeta muestra el nombre del día **y los ejercicios**. Hasta el 2026-09-15 no los
 * mostraba a propósito, y aquella decisión quedó revertida por el entrenador: ver
 * `docs/superpowers/specs/2026-09-15-rutinas-en-la-web-design.md`, sección "Lo que este spec
 * revierte, a propósito". La lista de ejercicios no es un error; no la quites.
 */
/**
 * `pesoONota` es texto libre escrito por el entrenador —a veces "30 kg", a veces "bajarle,
 * se lastimó"— y termina dentro del HTML, así que pasa por `escapar()` como todo lo demás.
 */
/**
 * Los ejercicios que le tocan hoy en ese día. Aplica el invariante de `DiaRutina`: sin
 * variaciones manda la lista base; con variaciones, la que le toca a esta clienta hoy.
 * Espejo de `ejerciciosDe` + `VariacionCalculator` en Kotlin.
 */
function ejerciciosDeHoy(
  dia: DiaRutina,
  indiceDia: number,
  asistencias: Asistencia[],
  hoy: string
): Ejercicio[] {
  const variaciones = dia.variaciones ?? [];
  if (variaciones.length === 0) return dia.ejercicios ?? [];
  const cual = variacionQueToca(indiceDia, asistencias, hoy, variaciones.length);
  return variaciones[cual]?.ejercicios ?? [];
}

/**
 * Los pesos propios sólo mandan mientras siga una plantilla. Con rutina propia, `rutinaAsignada`
 * ya trae los suyos plegados dentro, y aplicarlos otra vez pisaría lo que el entrenador acabe de
 * escribirle en su editor.
 */
function conSusPesos(cliente: Cliente, ejercicios: Ejercicio[]): Ejercicio[] {
  const sigueUnaPlantilla = (cliente.plantillaOrigenId ?? "").trim() !== "";
  return sigueUnaPlantilla ? conPesosPropios(ejercicios, cliente.pesoPorEjercicio) : ejercicios;
}

function listaEjercicios(ejercicios: Ejercicio[]): string {
  if (ejercicios.length === 0) {
    return `
      <p class="hoy-sin-ejercicios">Tu entrenador todavía no cargó los ejercicios de este día.</p>`;
  }

  const filas = ejercicios
    .map(
      (e) => `
        <li class="ejercicio">
          <span class="ejercicio-nombre">${escapar(e.nombre ?? "")}</span>
          <span class="ejercicio-series">${escapar(String(e.series ?? ""))} x ${escapar(e.repeticiones ?? "")}</span>
          ${e.pesoONota ? `<span class="ejercicio-nota">${escapar(e.pesoONota)}</span>` : ""}
        </li>`
    )
    .join("");

  return `<ul class="hoy-ejercicios">${filas}</ul>`;
}

export function tarjetaDia(
  cliente: Cliente,
  hoy: string,
  acciones = "",
  asistencias: Asistencia[] = []
): string {
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
      ${listaEjercicios(
        dias[indice]
          ? conSusPesos(cliente, ejerciciosDeHoy(dias[indice], indice, asistencias, hoy))
          : []
      )}
      ${acciones ? `<div class="hoy-acciones">${acciones}</div>` : ""}
    </div>`;
}
