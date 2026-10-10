import type { Sexo } from "../datos";
import { nombreMusculo, percentilDe, rangoDe, type FuerzaMusculo } from "../fuerza";
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
 * Qué lado se ve y qué músculo está tocado. Viven en el módulo y no en el HTML por lo mismo
 * que las acciones del día: `pintar()` corre en cada snapshot de Firestore, y si se
 * decidieran ahí, una asistencia marcada por el entrenador le daría la vuelta al cuerpo o le
 * quitaría la selección.
 */
let deEspalda = false;
let seleccionado: string | null = null;

/** Para los tests: el estado del módulo sobrevive entre pruebas. */
export function reiniciarMapa(): void {
  deEspalda = false;
  seleccionado = null;
}

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

const LEYENDA = `
      <p class="mapa-leyenda">
        <span class="mapa-muestra" aria-hidden="true"></span>
        Toca un músculo para ver tu rango. Se irán pintando con lo que registres.
      </p>`;

/**
 * El texto de abajo del dibujo: con un músculo tocado, su rango y cómo se compara; sin
 * ninguno, la leyenda. Se usa al pintar y al tocar, para que los dos digan lo mismo.
 */
export function detalleMusculo(
  grupo: string | null,
  fuerza: FuerzaMusculo | undefined,
  sexo: Sexo
): string {
  if (grupo === null) return LEYENDA;
  const nombre = nombreMusculo(grupo);
  const cerrar = `<button type="button" class="mapa-detalle-cerrar" id="cerrar-detalle"
                          aria-label="Cerrar">✕</button>`;
  if (!fuerza) {
    return `
      <div class="mapa-detalle" role="status">
        ${cerrar}
        <p class="mapa-detalle-nombre">${nombre}</p>
        <p class="mapa-detalle-rango">Rango: <strong>sin datos</strong></p>
        <p class="mapa-detalle-texto">
          Registra ejercicios de ${nombre.toLowerCase()} para conocer tu rango y ver qué tan
          fuerte eres ${sexo === "H" ? "comparado" : "comparada"} con la población.
        </p>
      </div>`;
  }
  const rango = rangoDe(fuerza.nivel);
  const p = percentilDe(fuerza.nivel);
  return `
      <div class="mapa-detalle" role="status">
        ${cerrar}
        <p class="mapa-detalle-nombre">${nombre}</p>
        <p class="mapa-detalle-rango">Rango: <strong>${rango.nombre}</strong></p>
        <p class="mapa-detalle-texto">Más fuerte que el <strong>${p} %</strong> de la población.</p>
        <div class="mapa-detalle-barra" aria-hidden="true"><span style="width: ${p}%"></span></div>
      </div>`;
}

/**
 * Las dos caras van siempre en el HTML, una detrás de la otra: así girar es una transición
 * de CSS sobre lo que ya está (ver `conectarMapa`) y no un repintado que cortaría el giro.
 *
 * `fuerza` es el nivel de cada grupo (`data-musculo`); vacío mientras no exista el registro.
 */
export function tarjetaMusculos(
  sexo: Sexo | null | undefined,
  mapas: Readonly<Record<string, EstadoSvg>>,
  fuerza: Readonly<Record<string, FuerzaMusculo>> = {}
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
  const detalle = detalleMusculo(seleccionado, seleccionado ? fuerza[seleccionado] : undefined, sexo);
  return `
    <section class="mapa-cuerpo${seleccionado ? " con-detalle" : ""}" aria-label="Tu mapa muscular">
      <div class="mapa-marco">
        <div class="mapa-giro${deEspalda ? " girado" : ""}${seleccionado ? " con-seleccion" : ""}" id="mapa-giro">
          ${cara("frente", de(a.frente), deEspalda)}
          ${cara("espalda", de(a.espalda), !deEspalda)}
        </div>
        <button type="button" class="mapa-girar" id="girar-mapa"
                aria-label="${textoBoton(deEspalda)}" title="${textoBoton(deEspalda)}">🔄</button>
      </div>
      <div id="mapa-detalle">${detalle}</div>
    </section>`;
}

/**
 * Marca el grupo tocado sobre los paths que ya están. Los pasa al final de su grupo para que,
 * al agrandarse, queden encima de sus vecinos: en SVG lo último que se dibuja es lo de arriba.
 */
function marcarSeleccion(): void {
  document.querySelector("#mapa-giro")?.classList.toggle("con-seleccion", seleccionado !== null);
  document.querySelector(".mapa-cuerpo")?.classList.toggle("con-detalle", seleccionado !== null);
  document.querySelectorAll<SVGElement>("#mapa-giro .musculo").forEach((m) => {
    const es = m.dataset.musculo === seleccionado;
    m.classList.toggle("seleccionado", es);
    if (es) m.parentNode?.appendChild(m);
  });
}

/**
 * Se vuelve a llamar en cada repintado: `innerHTML` tira los listeners. Los toques se
 * atienden con cambios sobre lo que ya está, sin repintar, para que el músculo crezca con
 * su transición en vez de aparecer ya grande.
 */
export function conectarMapa(
  sexo: Sexo | null | undefined,
  fuerza: Readonly<Record<string, FuerzaMusculo>> = {}
): void {
  if (sexo !== "H" && sexo !== "M") return;
  const pintarDetalle = () => {
    const caja = document.querySelector("#mapa-detalle");
    if (!caja) return;
    caja.innerHTML = detalleMusculo(seleccionado, seleccionado ? fuerza[seleccionado] : undefined, sexo);
    caja.querySelector("#cerrar-detalle")?.addEventListener("click", () => elegir(null));
  };
  const elegir = (grupo: string | null) => {
    seleccionado = grupo;
    marcarSeleccion();
    pintarDetalle();
  };

  marcarSeleccion();
  document.querySelector("#cerrar-detalle")?.addEventListener("click", () => elegir(null));
  document.querySelector("#mapa-giro")?.addEventListener("click", (e) => {
    const m = (e.target as Element).closest<SVGElement>(".musculo");
    const grupo = m?.dataset.musculo ?? null;
    // Tocar el mismo músculo, o fuera de los músculos, lo suelta.
    elegir(grupo === seleccionado ? null : grupo);
  });
  document.querySelector("#girar-mapa")?.addEventListener("click", () => {
    deEspalda = !deEspalda;
    document.querySelector("#mapa-giro")?.classList.toggle("girado", deEspalda);
    document.querySelector(".mapa-cara-frente")?.toggleAttribute("aria-hidden", deEspalda);
    document.querySelector(".mapa-cara-espalda")?.toggleAttribute("aria-hidden", !deEspalda);
    const b = document.querySelector("#girar-mapa");
    b?.setAttribute("aria-label", textoBoton(deEspalda));
    b?.setAttribute("title", textoBoton(deEspalda));
  });
}
