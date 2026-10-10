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
 * - **Cada línea interna dice de qué músculo es** (`data-de`), para pintarla de negro con él
 *   al tocarlo. Se saca de su recorte (`recorte-<grupo>`); las de las partes grises
 *   (`recorte-gris-…`) no son de ningún músculo. Las que van sin recorte son los tramos
 *   sueltos del muslo (`TRAMOS_LIBRES` / `LINEAS_LIBRES` en los generadores de
 *   `docs/mapa-muscular/`): son del cuádriceps.
 */
export function prepararSvg(texto: string, prefijo: string): string {
  let s = texto
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<rect class="fondo"[^>]*\/>/g, "")
    .replace(/<path class="linea" clip-path="url\(#recorte-(?!gris)([^)]+)\)"/g,
      '<path class="linea" data-de="$1" clip-path="url(#recorte-$1)"')
    .replace(/<path class="linea" d=/g, '<path class="linea" data-de="cuadriceps" d=');
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

const SVG_NS = "http://www.w3.org/2000/svg";

/** Deshace `elevar`: los músculos vuelven a su grupo y las copias de líneas desaparecen. */
function bajar(svg: SVGSVGElement): void {
  const musculos = svg.querySelector(`#${svg.id}-musculos`);
  svg.querySelectorAll(".musculo-elevado").forEach((g) => {
    g.querySelectorAll(".musculo").forEach((m) => musculos?.appendChild(m));
    g.remove();
  });
  svg.querySelectorAll(".recorte-elevado").forEach((c) => c.remove());
  svg.querySelectorAll(".linea.oculta").forEach((l) => l.classList.remove("oculta"));
}

/**
 * Hasta qué distancia (unidades del SVG) los dos lados crecen como uno solo. Pecho, glúteos,
 * dorsales, lumbar y trapecio de espalda se tocan (0.7–2.7); cuádriceps e isquiotibiales
 * quedan a 11–20 y, creciendo cada uno desde su centro, se rozaban arriba. Lo más cercano que
 * va por separado son las pantorrillas de la mujer (23).
 */
const SEPARACION_JUNTOS = 20;

function seTocan(a: DOMRect, b: DOMRect): boolean {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  return Math.max(dx, dy) <= SEPARACION_JUNTOS;
}

/**
 * Pone los paths de un músculo dentro de un grupo que crece desde su centro, junto con una
 * copia de sus líneas internas en negro, recortada con su propia forma. Como el recorte se
 * lee en el espacio del grupo, crece con él y las líneas siguen cayendo dentro del músculo.
 *
 * El grupo va al final del SVG, encima también de las líneas blancas de los demás: si no,
 * las del vecino (las del abdomen sobre el pecho) asomarían sobre el músculo agrandado. Las
 * blancas del propio músculo se esconden, porque sin crecer quedarían corridas.
 */
function elevar(svg: SVGSVGElement, paths: SVGGraphicsElement[], n: number, animar: boolean): void {
  const cajas = paths.map((m) => m.getBBox());
  const x0 = Math.min(...cajas.map((c) => c.x));
  const y0 = Math.min(...cajas.map((c) => c.y));
  const x1 = Math.max(...cajas.map((c) => c.x + c.width));
  const y1 = Math.max(...cajas.map((c) => c.y + c.height));
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "musculo-elevado");
  g.style.transformOrigin = `${(x0 + x1) / 2}px ${(y0 + y1) / 2}px`;
  svg.appendChild(g);
  paths.forEach((m) => g.appendChild(m));

  const idRecorte = `${svg.id}-elevado-${n}`;
  const recorte = document.createElementNS(SVG_NS, "clipPath");
  recorte.setAttribute("id", idRecorte);
  recorte.setAttribute("class", "recorte-elevado");
  for (const m of paths) {
    const uso = document.createElementNS(SVG_NS, "use");
    uso.setAttribute("href", `#${m.id}`);
    recorte.appendChild(uso);
  }
  svg.appendChild(recorte);

  const lineas = document.createElementNS(SVG_NS, "g");
  lineas.setAttribute("clip-path", `url(#${idRecorte})`);
  svg.querySelectorAll<SVGElement>(`.linea[data-de="${paths[0].dataset.musculo}"]`).forEach((l) => {
    if (l.closest(".musculo-elevado")) return;
    const copia = l.cloneNode() as SVGElement;
    copia.removeAttribute("clip-path");
    // El otro lado del mismo músculo ya la escondió: la copia no hereda eso.
    copia.classList.remove("oculta");
    copia.classList.add("linea-elevada");
    // En línea y no en CSS: el `<style>` del SVG pinta `#mapa-… .linea` de blanco, y un id
    // le gana a cualquier regla de `estilos.css`.
    copia.style.stroke = "var(--borde-musculo, #000)";
    lineas.appendChild(copia);
    l.classList.add("oculta");
  });
  g.appendChild(lineas);

  // Sin animar (un repintado) entra ya crecido; al tocar, crece con la transición.
  if (animar) g.getBoundingClientRect();
  g.classList.add("crecido");
}

/**
 * Marca el grupo tocado sobre los paths que ya están: lo agranda con sus líneas en negro
 * (`elevar`) y apaga a los demás. Los lados que se tocan crecen juntos desde el centro de
 * los dos; si cada uno creciera desde el suyo, se encimarían en medio.
 */
function marcarSeleccion(animar: boolean): void {
  document.querySelector("#mapa-giro")?.classList.toggle("con-seleccion", seleccionado !== null);
  document.querySelector(".mapa-cuerpo")?.classList.toggle("con-detalle", seleccionado !== null);
  document.querySelectorAll<SVGSVGElement>("#mapa-giro .mapa-svg").forEach((svg) => {
    bajar(svg);
    const paths: SVGGraphicsElement[] = [];
    svg.querySelectorAll<SVGGraphicsElement>(".musculo").forEach((m) => {
      const es = m.dataset.musculo === seleccionado;
      m.classList.toggle("seleccionado", es);
      if (es) paths.push(m);
    });
    if (paths.length === 0) return;
    const juntos = paths.length === 2 && seTocan(paths[0].getBBox(), paths[1].getBBox());
    if (juntos || paths.length === 1) elevar(svg, paths, 0, animar);
    else paths.forEach((m, n) => elevar(svg, [m], n, animar));
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
    marcarSeleccion(true);
    pintarDetalle();
  };

  marcarSeleccion(false);
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
