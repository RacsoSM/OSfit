import type { Sexo } from "../datos";
import { seccionVacia } from "./tarjetaInsignias";

/**
 * La ventana Músculos: el mapa de frente y de espalda que le toca según su sexo.
 *
 * Los SVG viven en `web/public/` y se generan con los scripts de `docs/mapa-muscular/`. Van
 * en línea (no en `<img>`) porque el color de cada músculo lo va a poner la página según su
 * nivel, y eso solo se puede desde CSS si el SVG es parte del documento. Por la misma razón
 * se piden con `fetch` al entrar y no se meten al bundle: son ~90 kB cada uno y no hacen
 * falta en Inicio. Ver `docs/superpowers/specs/2026-10-10-mapa-fuerza-entrenamiento-design.md`.
 *
 * Todavía no hay registros de fuerza, así que todos los músculos salen en el gris "sin datos".
 */

export type EstadoSvg =
  | { estado: "cargando" }
  | { estado: "listo"; svg: string }
  | { estado: "error" };

export interface ArchivosMapa { frente: string; espalda: string; }

export function archivosMapa(sexo: Sexo): ArchivosMapa {
  return sexo === "M"
    ? { frente: "/mapa-muscular-frente-mujer.svg", espalda: "/mapa-muscular-espalda-mujer.svg" }
    : { frente: "/mapa-muscular-frente.svg", espalda: "/mapa-muscular-espalda.svg" };
}

/**
 * Deja el SVG listo para ir dentro de la página, junto a otro igual:
 *
 * - **Ids con prefijo.** Los cuatro mapas usan los mismos ids (`recorte-antebrazo`,
 *   `musculos`…): con frente y espalda en el mismo documento, un `url(#recorte-…)` repetido
 *   recortaría con la forma del otro dibujo.
 * - **Sin los colores de la foto.** El `<style>` del SVG pinta cada grupo con la paleta de la
 *   referencia; en la página es global, así que se quedaría pintando los dos mapas. Se
 *   conservan las reglas de forma (contorno, líneas) acotadas a este SVG, y el color de los
 *   músculos lo pone `estilos.css`.
 * - **`fondo` → `mapa-fondo`.** `.fondo` ya es el fondo pintado de la página, con
 *   `position: fixed` y tamaño de pantalla.
 * - Sin la declaración XML ni los comentarios, que no van dentro de HTML.
 */
export function prepararSvg(texto: string, prefijo: string): string {
  let s = texto
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/class="fondo"/g, 'class="mapa-fondo"');
  s = s.replace(/<style>([\s\S]*?)<\/style>/, (_, css: string) => {
    const reglas = css
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("[data-musculo"))
      .map((l) => `#${prefijo} ${l.replace(/^\.fondo\b/, ".mapa-fondo")}`);
    return `<style>${reglas.join("\n")}</style>`;
  });
  s = s
    .replace(/\bid="([^"]+)"/g, `id="${prefijo}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefijo}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefijo}-$1"`);
  return s.replace(/<svg\b/, `<svg id="${prefijo}" class="mapa-svg"`).trim();
}

function vista(titulo: string, e: EstadoSvg, prefijo: string): string {
  const cuerpo =
    e.estado === "listo"
      ? prepararSvg(e.svg, prefijo)
      : e.estado === "error"
        ? `<p class="mapa-aviso">No se pudo cargar.</p>`
        : `<div class="mapa-cargando" role="status" aria-label="Cargando"></div>`;
  return `
      <figure class="mapa-vista">
        <div class="mapa-dibujo">${cuerpo}</div>
        <figcaption>${titulo}</figcaption>
      </figure>`;
}

export function tarjetaMusculos(
  sexo: Sexo | null | undefined,
  mapas: Readonly<Record<string, EstadoSvg>>
): string {
  if (sexo !== "H" && sexo !== "M") {
    return seccionVacia(
      "Tu mapa muscular",
      "💪",
      "Tu mapa muscular está casi listo",
      "Tu entrenador tiene que completar tu perfil para mostrártelo."
    );
  }
  const a = archivosMapa(sexo);
  const de = (archivo: string): EstadoSvg => mapas[archivo] ?? { estado: "cargando" };
  return `
    <div class="tarjeta mapa-cuerpo">
      <p class="tarjeta-titulo">Tu mapa muscular</p>
      <div class="mapa-vistas">
        ${vista("Frente", de(a.frente), "mapa-frente")}
        ${vista("Espalda", de(a.espalda), "mapa-espalda")}
      </div>
      <p class="mapa-leyenda">
        <span class="mapa-muestra" aria-hidden="true"></span>
        Sin datos todavía: cada músculo se irá pintando con lo que registres.
      </p>
    </div>`;
}
