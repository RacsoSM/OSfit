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
 * - **Sin el rectángulo negro de fondo.** El cuerpo va directo sobre el fondo de la página
 *   (y `.fondo` ya es el fondo pintado de la página, con `position: fixed`).
 * - Sin la declaración XML ni los comentarios, que no van dentro de HTML.
 */
export function prepararSvg(texto: string, prefijo: string): string {
  let s = texto
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<rect class="fondo"[^>]*\/>/g, "");
  s = s.replace(/<style>([\s\S]*?)<\/style>/, (_, css: string) => {
    const reglas = css
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("[data-musculo") && !l.startsWith(".fondo"))
      .map((l) => `#${prefijo} ${l}`);
    return `<style>${reglas.join("\n")}</style>`;
  });
  s = s
    .replace(/\bid="([^"]+)"/g, `id="${prefijo}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefijo}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefijo}-$1"`);
  return s.replace(/<svg\b/, `<svg id="${prefijo}" class="mapa-svg"`).trim();
}

/**
 * Qué lado se ve. Vive en el módulo y no en el HTML por lo mismo que las acciones del día:
 * `pintar()` corre en cada snapshot de Firestore, y si el lado se decidiera ahí, una
 * asistencia marcada por el entrenador le daría la vuelta al cuerpo sola.
 */
let deEspalda = false;

function cara(lado: "frente" | "espalda", e: EstadoSvg, oculta: boolean): string {
  const cuerpo =
    e.estado === "listo"
      ? prepararSvg(e.svg, `mapa-${lado}`)
      : e.estado === "error"
        ? `<p class="mapa-aviso">No se pudo cargar.</p>`
        : `<div class="mapa-cargando" role="status" aria-label="Cargando"></div>`;
  return `<div class="mapa-cara mapa-cara-${lado}"${oculta ? ' aria-hidden="true"' : ""}>${cuerpo}</div>`;
}

const textoBoton = (espalda: boolean) => (espalda ? "Ver de frente" : "Ver espalda");

/**
 * Las dos caras van siempre en el HTML, una detrás de la otra: así girar es una transición
 * de CSS sobre lo que ya está (ver `conectarMapa`) y no un repintado que cortaría el giro.
 */
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
    <section class="mapa-cuerpo" aria-label="Tu mapa muscular">
      <div class="mapa-giro${deEspalda ? " girado" : ""}" id="mapa-giro">
        ${cara("frente", de(a.frente), deEspalda)}
        ${cara("espalda", de(a.espalda), !deEspalda)}
      </div>
      <button type="button" class="mapa-girar" id="girar-mapa">
        <span aria-hidden="true">🔄</span> <span class="mapa-girar-texto">${textoBoton(deEspalda)}</span>
      </button>
      <p class="mapa-leyenda">
        <span class="mapa-muestra" aria-hidden="true"></span>
        Sin datos todavía: cada músculo se irá pintando con lo que registres.
      </p>
    </section>`;
}

/** Se vuelve a llamar en cada repintado: `innerHTML` tira el listener. */
export function conectarMapa(): void {
  document.querySelector("#girar-mapa")?.addEventListener("click", () => {
    deEspalda = !deEspalda;
    document.querySelector("#mapa-giro")?.classList.toggle("girado", deEspalda);
    document.querySelector(".mapa-cara-frente")?.toggleAttribute("aria-hidden", deEspalda);
    document.querySelector(".mapa-cara-espalda")?.toggleAttribute("aria-hidden", !deEspalda);
    const t = document.querySelector(".mapa-girar-texto");
    if (t) t.textContent = textoBoton(deEspalda);
  });
}
