import type { VideoResumen } from "../datos";
import { escapar } from "./tarjetaDia";
import { seccionVacia } from "./tarjetaInsignias";

export const MAXIMO_VIDEOS = 6;

/**
 * Lo que necesita la tarjeta de un video: el documento de Firestore más la URL ya resuelta
 * (o `null` si `getDownloadURL()` falló). Resolverla es cosa del cableado, no de esta función
 * — así esta sigue siendo síncrona y testeable sin DOM ni Storage real.
 */
export interface VideoConUrl extends VideoResumen {
  url: string | null;
}

/**
 * Se exporta para que el cableado (`main.ts`) elija los mismos 6 ANTES de pedirle la URL a
 * Storage a cada uno: pedir la URL de todo el historial sería gastar llamadas de más por
 * clienta con años de quincenas.
 */
export function ultimosRangoDescendente<T extends { rangoInicio: string }>(
  videos: T[],
  cantidad: number
): T[] {
  return [...videos].sort((a, b) => (a.rangoInicio < b.rangoInicio ? 1 : -1)).slice(0, cantidad);
}

function formatearDuracion(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = Math.floor(segundos % 60);
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

function tarjetaVideo(v: VideoConUrl): string {
  const cuerpo = v.url
    ? `<video class="video-resumen" src="${escapar(v.url)}" controls preload="metadata"></video>`
    : `<div class="video-no-disponible">Video no disponible</div>`;

  return `
    <div class="video">
      <p class="video-rango">${escapar(v.encabezadoRango)}</p>
      <p class="video-duracion">${formatearDuracion(v.duracionSegundos)}</p>
      ${cuerpo}
    </div>`;
}

export function tarjetaVideos(videos: VideoConUrl[]): string {
  if (videos.length === 0) {
    return seccionVacia(
      "Tus videos de resumen",
      "🎬",
      "Todavía no tienes videos",
      "Tu entrenador publica uno al cerrar cada quincena."
    );
  }

  const piezas = ultimosRangoDescendente(videos, MAXIMO_VIDEOS).map(tarjetaVideo);

  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Tus videos de resumen</p>
      <div class="videos">${piezas.join("")}</div>
    </div>`;
}
