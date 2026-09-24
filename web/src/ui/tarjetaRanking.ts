import type { FilaRanking, Ranking } from "../datos";
import { escapar } from "./tarjetaDia";

/**
 * La ventana Ranking: el top de rachas, actual e histórica. Ver
 * `docs/superpowers/specs/2026-09-24-ranking-rachas-design.md`.
 */

export type EstadoRanking =
  | { estado: "cargando" }
  | { estado: "listo"; datos: Ranking }
  | { estado: "error" };

export type PestanaRanking = "actual" | "historica";

/**
 * La pestaña elegida vive en el módulo y no en el DOM, por lo mismo que el estado de
 * `accionDia`: `pintar()` rehace `#contenido` en cada snapshot de Firestore, y la clienta que
 * está mirando la histórica no debe volver a la actual porque el entrenador marcó una
 * asistencia.
 */
let pestanaElegida: PestanaRanking = "actual";

export function elegirPestanaRanking(p: PestanaRanking): void {
  pestanaElegida = p;
}

const MEDALLAS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function segmentado(activa: PestanaRanking): string {
  const boton = (id: PestanaRanking, texto: string) => {
    const on = id === activa;
    return `<button class="segmento${on ? " activo" : ""}" data-pestana="${id}" aria-selected="${on}" role="tab">${texto}</button>`;
  };
  return `<div class="segmentos" role="tablist">${boton("actual", "Racha actual")}${boton("historica", "Histórica")}</div>`;
}

/** Por puesto y no por posición en la lista: un empate en el 2 comparte la de plata. */
function fila(f: FilaRanking): string {
  const nombre = f.esTuyo ? `Tú · ${escapar(f.nombre)}` : escapar(f.nombre);
  return `
      <li class="ranking-fila${f.esTuyo ? " tuya" : ""}">
        <span class="ranking-puesto">${MEDALLAS[f.puesto] ?? f.puesto}</span>
        <span class="ranking-nombre">${nombre}</span>
        <span class="ranking-racha">🔥 ${f.racha}</span>
      </li>`;
}

function cuerpo(estado: EstadoRanking, pestana: PestanaRanking): string {
  if (estado.estado === "cargando") {
    return `<div class="ranking-esqueleto">${"<div></div>".repeat(5)}</div>`;
  }
  if (estado.estado === "error") {
    return `
      <div class="vacio" style="padding: 14px 8px">
        <div class="vacio-emoji">📡</div>
        <p><strong>No pudimos cargar el ranking</strong></p>
        <button class="boton" id="ranking-reintentar">Reintentar</button>
      </div>`;
  }
  const lista = pestana === "actual" ? estado.datos.actual : estado.datos.historica;
  if (lista.length === 0) {
    return `
      <div class="vacio" style="padding: 14px 8px">
        <div class="vacio-emoji">🏆</div>
        <p><strong>Todavía no hay rachas</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">Aparecerán en cuanto haya asistencias.</p>
      </div>`;
  }
  return `<ol class="ranking-lista">${lista.map(fila).join("")}</ol>`;
}

export function tarjetaRanking(estado: EstadoRanking, pestana: PestanaRanking = pestanaElegida): string {
  return `
    <div class="tarjeta ranking">
      ${segmentado(pestana)}
      ${cuerpo(estado, pestana)}
    </div>`;
}

/**
 * Se vuelve a colgar en cada repintado: `innerHTML` tira los listeners junto con los nodos.
 * Cambiar de pestaña no llama a la función: las dos listas ya llegaron juntas.
 */
export function conectarRanking(repintar: () => void, reintentar: () => void): void {
  document.querySelectorAll<HTMLElement>(".ranking [data-pestana]").forEach((b) => {
    b.addEventListener("click", () => {
      elegirPestanaRanking(b.dataset.pestana === "historica" ? "historica" : "actual");
      repintar();
    });
  });
  document.querySelector("#ranking-reintentar")?.addEventListener("click", reintentar);
}
