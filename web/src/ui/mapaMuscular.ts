import type { Sexo } from "../datos";
import {
  RANGOS, indiceRango, nombreMusculo, nombreRango, percentilDe, percentilEntrenanDe,
  rangoGeneral, repartoRangos, siguienteRango, type Comparacion, type FuerzaMusculo, type Meta,
} from "../fuerza";
import { COLORES_RANGO, insigniaRango } from "./insigniaRango";
import { conectarHoja } from "./deslizarHoja";
import { escapar } from "./tarjetaDia";
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
 * Cada músculo se pinta con el color de su rango (`data-rango`, de `fuerzaPorMusculo`); sin
 * registros se queda gris. El "?" de arriba a la izquierda abre la explicación (`ayudaMapa`).
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
/** La explicación abierta: también aquí y no en el HTML, para que un snapshot no la cierre. */
let ayudaAbierta = false;
/**
 * Contra quién compara el detalle (el botón "Todos / Quienes entrenan"). Cada músculo se abre
 * contra quienes entrenan (decisión del entrenador, 2026-10-13); "Todos" dura mientras la hoja
 * siga abierta.
 */
let comparacion: Comparacion = "entrenan";

/** Para los tests: el estado del módulo sobrevive entre pruebas. */
export function reiniciarMapa(): void {
  deEspalda = false;
  seleccionado = null;
  ayudaAbierta = false;
  comparacion = "entrenan";
}

/**
 * Le pone a cada músculo su rango (`data-rango`, 0 = Principiante … 7 = Élite) para que
 * `estilos.css` lo pinte con su color. Sin entrada en `fuerza` se queda sin atributo: el gris
 * de "sin datos".
 */
export function conNiveles(svg: string, fuerza: Readonly<Record<string, FuerzaMusculo>>): string {
  const prefijo = `${/<svg id="([^"]+)"/.exec(svg)?.[1] ?? "mapa"}-elite`;
  let hayElite = false;
  const pintado = svg.replace(/class="musculo" data-musculo="([^"]+)"/g, (todo, grupo: string) => {
    const f = fuerza[grupo];
    if (!f) return todo;
    const rango = indiceRango(f.nivel);
    if (rango !== RANGO_ELITE) return `${todo} data-rango="${rango}"`;
    hayElite = true;
    return `${todo} data-rango="${rango}" filter="url(#${prefijo}-halo)"`;
  });
  if (!hayElite) return pintado;

  const quieto =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const ancho = Number(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/.exec(svg)?.[1] ?? 420);
  const chispas: string[] = [];
  // Al final de su grupo, para que el halo quede por encima de los músculos vecinos y no
  // debajo (en el SVG, lo último se dibuja arriba). Cada uno va seguido de su destello: una
  // copia de su silueta pintada con el reflejo. Las líneas blancas siguen encima de todo.
  const alFrente = pintado.replace(/(<g id="[^"]*musculos">)([\s\S]*?)(<\/g>)/, (_, abre: string, dentro: string, cierra: string) => {
    const elite: string[] = [];
    const resto = dentro.replace(/<path\b[^>]*class="musculo"[^>]*-elite-halo[^>]*\/>\s*/g, (p) => {
      const d = /\sd="([^"]+)"/.exec(p)?.[1] ?? "";
      elite.push(p.trim() + `<path class="destello-elite" d="${d}" fill="url(#${prefijo}-destello)" pointer-events="none"/>`);
      if (!quieto) chispas.push(...chispasDe(d, chispas.length));
      return "";
    });
    return `${abre}${resto}${elite.join("")}${cierra}`;
  });
  const conChispas = chispas.length > 0
    ? alFrente.replace(/<\/svg>\s*$/, `<g class="chispas-elite" filter="url(#${prefijo}-chispa)" pointer-events="none">${chispas.join("")}</g></svg>`)
    : alFrente;
  return conChispas.replace(/(<svg\b[^>]*>)/, `$1${defsElite(prefijo, ancho, quieto)}`);
}

/** Élite es el último rango de `RANGOS`: no hay nada arriba. */
const RANGO_ELITE = RANGOS.length - 1;

/** Una vuelta del destello y de cada chispa, en segundos. */
const CICLO_ELITE = 2.6;

/** Estrella de cuatro puntas de radio 10, centrada en 0,0: la chispa. */
const ESTRELLA = "M0 -10C1.5 -2 2 -1.5 10 0C2 1.5 1.5 2 0 10C-1.5 2 -2 1.5 -10 0C-2 -1.5 -1.5 -2 0 -10Z";

/**
 * Las chispas de un músculo: dos estrellitas en puntos fijos de su caja (sacada de las
 * coordenadas de su path; aquí no hay `getBBox`, el SVG todavía es texto). Leves: chicas, una a
 * la vez y con desfase entre todas, para que no parpadee el cuerpo entero junto.
 */
function chispasDe(d: string, yaHay: number): string[] {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  if (xs.length === 0 || ys.length === 0) return [];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return ([[0.28, 0.3], [0.7, 0.68]] as const).map(([fx, fy], i) => {
    const x = (x0 + (x1 - x0) * fx).toFixed(1);
    const y = (y0 + (y1 - y0) * fy).toFixed(1);
    // Inicio negativo: cada una arranca ya a media vuelta, sin quedarse quieta y entera
    // esperando su turno. La escala se suma al `translate`, por eso este no lleva escala propia.
    const desfase = (((yaHay + i) * 0.83) % CICLO_ELITE).toFixed(2);
    return `<path d="${ESTRELLA}" fill="#fffbe6" transform="translate(${x} ${y})">`
      + `<animateTransform attributeName="transform" type="scale" additive="sum" values="0;0.75;0;0"`
      + ` keyTimes="0;0.15;0.3;1" dur="${CICLO_ELITE}s" begin="-${desfase}s" repeatCount="indefinite"/></path>`;
  });
}

/**
 * Lo que necesita un músculo en Élite (entrenador, 2026-10-19, propuesta "E" con chispas de la
 * "D"): además de su oro, un halo dorado quieto, un destello que cruza el oro como la luz sobre
 * una medalla y unas chispas leves, para que se lea que no hay un nivel más alto.
 *
 * Son filtros y degradados SVG y no `filter`/`drop-shadow` de CSS porque Safari no aplica los
 * filtros de CSS a lo de adentro de un SVG. El halo sale de la silueta (`SourceAlpha`) y no del
 * color: sigue dorado aunque el músculo esté tocado y tome el color del estilo. Si el teléfono
 * pide menos movimiento queda solo el halo, sin destello ni chispas. Las medidas son las del
 * dibujo ([ancho] = el ancho de su `viewBox`).
 */
function defsElite(prefijo: string, ancho: number, quieto: boolean): string {
  const destello = quieto
    ? `gradientTransform="translate(${-2 * ancho} 0)"`
    : "";
  const barrido = quieto
    ? ""
    : `<animateTransform attributeName="gradientTransform" type="translate" values="-180 0;${ancho} 0;${ancho} 0"`
      + ` keyTimes="0;0.6;1" dur="${CICLO_ELITE}s" repeatCount="indefinite"/>`;
  return `<defs>`
    + `<filter id="${prefijo}-halo" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">`
    + `<feMorphology in="SourceAlpha" operator="dilate" radius="3" result="gordo"/>`
    + `<feGaussianBlur in="gordo" stdDeviation="9" result="difuso"/>`
    + `<feFlood flood-color="#ffd54a" flood-opacity="0.75" result="oro"/>`
    + `<feComposite in="oro" in2="difuso" operator="in" result="halo"/>`
    + `<feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>`
    + `</filter>`
    + `<linearGradient id="${prefijo}-destello" gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="180" y2="260" ${destello}>`
    + `<stop offset="0.3" stop-color="#fff" stop-opacity="0"/>`
    + `<stop offset="0.5" stop-color="#fff" stop-opacity="0.85"/>`
    + `<stop offset="0.7" stop-color="#fff" stop-opacity="0"/>`
    + barrido
    + `</linearGradient>`
    + `<filter id="${prefijo}-chispa" x="-100%" y="-100%" width="300%" height="300%">`
    + `<feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/>`
    + `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>`
    + `</filter>`
    + `</defs>`;
}

function cara(
  lado: "frente" | "espalda",
  e: EstadoSvg,
  oculta: boolean,
  fuerza: Readonly<Record<string, FuerzaMusculo>>
): string {
  const cuerpo =
    e.estado === "listo"
      ? conNiveles(prepararSvg(e.svg, `mapa-${lado}`), fuerza)
      : e.estado === "error"
        ? `<p class="mapa-aviso">No se pudo cargar.</p>`
        : `<div class="mapa-cargando" role="status" aria-label="Cargando"></div>`;
  return `<div class="mapa-cara mapa-cara-${lado}"${oculta ? ' aria-hidden="true"' : ""}>${cuerpo}</div>`;
}

const textoBoton = (espalda: boolean) => (espalda ? "Ver de frente" : "Ver espalda");

/**
 * Los íconos de los dos botones del dibujo: de línea, en SVG y con el color del texto
 * (`currentColor`). Antes eran 🔄 y "?", que en cada teléfono se veían distinto y como emoji.
 */
const icono = (trazos: string) =>
  `<svg class="mapa-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${trazos}</svg>`;
const ICONO_GIRAR = icono(
  '<path d="M20 12a8 8 0 0 1-13.9 5.4"/><path d="M4 12a8 8 0 0 1 13.9-5.4"/>'
  + '<path d="M18 2.8v3.9h-3.9"/><path d="M6 21.2v-3.9h3.9"/>'
);
/** Amigos: dos personas, de línea como los otros dos. */
const ICONO_COMUNIDAD = icono(
  '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/>'
  + '<path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18.5 14.2a6.5 6.5 0 0 1 3 5.8"/>'
);
const ICONO_AYUDA = icono(
  '<path d="M7.4 7.9a4.6 4.6 0 1 1 6.5 4.2c-1.1.5-1.9 1.5-1.9 2.7v.8"/><path d="M12 20.1v.1"/>'
);

const LEYENDA = `
      <p class="mapa-leyenda">Toca un músculo para ver su detalle</p>`;

const pct = (n: number) => `${n}&nbsp;%`;
const kg = (n: number) => `${n.toLocaleString("es-MX", { maximumFractionDigits: 1 })} kg`;
const serieTexto = (x: { reps: number; peso: number | null }) =>
  x.peso === null ? `${x.reps} reps` : `${kg(x.peso)} × ${x.reps}`;

/**
 * Una opción para subir (entrenador, 2026-10-28): el ejercicio, "Necesitas 9 repeticiones con
 * 33 kg" y su mejor serie, en una tarjeta. Pide la serie entera, no lo que le falta: es lo que
 * va a intentar en su siguiente entrenamiento. En los de peso, a las mismas reps de su mejor serie.
 */
function opcionMeta(m: Meta, etiqueta: string): string {
  const reps = `<strong>${m.objetivo.reps} ${m.objetivo.reps === 1 ? "repetición" : "repeticiones"}</strong>`;
  const con = m.objetivo.peso !== null
    ? ` con <strong>${kg(m.objetivo.peso)}${m.porMancuerna ? " por mancuerna" : ""}</strong>`
    : "";
  return `
        <div class="hoja-opcion">
          <div class="hoja-opcion-etq">${etiqueta}</div>
          <div class="hoja-opcion-ej">${escapar(m.ejercicio)}</div>
          <div class="hoja-opcion-meta">Necesitas ${reps}${con}</div>
          <div class="hoja-opcion-mejor">Tu mejor serie: ${serieTexto(m.mejor)}</div>
        </div>`;
}

/**
 * Si "¿Cómo subir?" está abierto. Vive en el módulo porque cada repintado rehace el detalle
 * (`innerHTML`), y sin esto el menú se cerraría solo al llegar cualquier dato.
 */
let comoSubirAbierto = false;

/** Recuerda si abrió o cerró "¿Cómo subir?" (el evento `toggle` no sube: va en el `details`). */
function conectarComoSubir(raiz: ParentNode | null): void {
  raiz?.querySelector<HTMLDetailsElement>("details.hoja-como")?.addEventListener("toggle", (e) => {
    comoSubirAbierto = (e.currentTarget as HTMLDetailsElement).open;
  });
}

/** Lo que le falta para el siguiente rango, o que ya está en el más alto. */
export function bloqueSiguiente(f: FuerzaMusculo, sexo: Sexo, peso: number, musculo: string): string {
  const s = siguienteRango(f, peso);
  if (s.tipo === "maximo") {
    // También en Élite, su mejor serie y de qué ejercicio, como en los demás rangos
    // (entrenador, 2026-10-21): es lo que la llevó hasta arriba.
    const o = f.origen;
    const mejor = o
      ? ` Tu mejor serie: ${serieTexto(o.serie)} en <strong>${escapar(o.nombre)}</strong>.`
      : "";
    return `<div class="hoja-sig"><p class="hoja-sig-texto">Estás en el rango más alto. ¡Sigue así!${mejor}</p></div>`;
  }
  const actual = indiceRango(f.nivel);
  // Hacia abajo: a 99.6 % redondear decía "100 %" sin haber subido (Said, a 0.004 de Élite).
  const porcentaje = Math.floor(s.avance * 100);
  const barra = `
      <div class="hoja-sig-fila">
        <span>Siguiente: <strong style="color: ${COLORES_RANGO[s.rango]}">${nombreRango(RANGOS[s.rango].desde, sexo)}</strong></span>
        <span>${pct(porcentaje)}</span>
      </div>
      <div class="hoja-sig-barra" aria-hidden="true">
        <span style="width: ${porcentaje}%; background: linear-gradient(90deg, ${COLORES_RANGO[actual]}, ${COLORES_RANGO[s.rango]})"></span>
      </div>`;
  if (s.tipo === "otroEjercicio") {
    const texto = `Para subir, registra un ejercicio que trabaje directo tu ${musculo.toLowerCase()}.`;
    return `<div class="hoja-sig">${barra}<p class="hoja-sig-texto">${texto}</p></div>`;
  }
  // Su mejor ejercicio del músculo y, si hizo otro, el segundo: dos caminos para subir, en un
  // menú plegable para que el detalle no se llene de texto (entrenador, 2026-10-28).
  const opciones = opcionMeta(s, s.otra ? "Opción 1 · tu mejor ejercicio" : "Tu mejor ejercicio")
    + (s.otra ? opcionMeta(s.otra, "Opción 2") : "");
  const rango = nombreRango(RANGOS[s.rango].desde, sexo);
  return `
    <div class="hoja-sig">${barra}
      <details class="hoja-como"${comoSubirAbierto ? " open" : ""}>
        <summary><span>¿Cómo subir a <strong style="color: ${COLORES_RANGO[s.rango]}">${rango}</strong>?</span></summary>
        <div class="hoja-opciones">${opciones}
        </div>
      </details>
    </div>`;
}

/** Las 8 barras: qué porcentaje de cada grupo está en cada rango; la suya, resaltada. */
function grafica(yo: number, contra: Comparacion, sexo: Sexo): string {
  const reparto = repartoRangos(contra);
  const max = Math.max(...reparto);
  const quien = contra === "todos" ? "toda la población" : "la gente que entrena";
  const columnas = reparto.map((p, i) => `
        <div class="h-col${i === yo ? " yo" : ""}">
          <div class="h-caja"><div class="h-barra" style="height: max(4px, ${((p / max) * 100).toFixed(1)}%); background: ${COLORES_RANGO[i]}"></div></div>
          <div class="h-insignia">${insigniaRango(i, 26, `g-${contra}-${i}`)}</div>
          <div class="h-pct">${pct(p)}</div>
          ${i === yo ? `<div class="h-tu">TÚ</div>` : ""}
        </div>`).join("");
  const resumen = reparto.map((p, i) => `${nombreRango(RANGOS[i].desde, sexo)} ${p} %`).join(", ");
  return `<div class="hoja-grafica" role="img" aria-label="Rangos de ${quien}: ${resumen}">${columnas}</div>`;
}

/**
 * Sin músculo tocado, la leyenda. Con uno, su hoja de detalle, que sube desde abajo: su
 * rango con su insignia, cuántos hay en ese rango y a cuántos supera (contra toda la
 * población o contra quienes entrenan, con el botón), la gráfica de los 8 rangos y qué le
 * falta para el siguiente. Se usa al pintar y al tocar, para que los dos digan lo mismo.
 */
export function detalleMusculo(
  grupo: string | null,
  fuerza: FuerzaMusculo | undefined,
  sexo: Sexo,
  peso: number | null = null
): string {
  if (grupo === null) return LEYENDA;
  const nombre = nombreMusculo(grupo);
  const cerrar = `<button type="button" class="hoja-cerrar" id="cerrar-detalle" aria-label="Cerrar">✕</button>`;
  if (!fuerza) {
    return `
      <section class="hoja-detalle" role="dialog" aria-label="${nombre}">
        <div class="hoja-agarre" aria-hidden="true"><div class="hoja-asa"></div></div>${cerrar}
        <p class="hoja-musculo">${nombre}</p>
        <p class="hoja-sin-datos">Sin datos</p>
        <p class="hoja-frase">
          Registra ejercicios de ${nombre.toLowerCase()} para conocer tu rango y ver qué tan
          fuerte eres ${sexo === "H" ? "comparado" : "comparada"} con los demás.
        </p>
      </section>`;
  }
  const yo = indiceRango(fuerza.nivel);
  const rango = nombreRango(fuerza.nivel, sexo);
  const reparto = repartoRangos(comparacion);
  const supera = comparacion === "todos" ? percentilDe(fuerza.nivel) : percentilEntrenanDe(fuerza.nivel);
  const frase = comparacion === "todos"
    ? `De todas las personas del mundo, entrenen o no, el <strong>${pct(reparto[yo])}</strong> está en este rango. Eres más fuerte que el <strong>${pct(supera)}</strong> de ellas.`
    : `De todas las personas que entrenan en el mundo, el <strong>${pct(reparto[yo])}</strong> está en este rango. Eres más fuerte que el <strong>${pct(supera)}</strong> de ellas.`;
  const otra = comparacion === "todos"
    ? `Contra la gente que entrena, eres más fuerte que el ${pct(percentilEntrenanDe(fuerza.nivel))}.`
    : `Contra toda la población (también quien no entrena), eres más fuerte que el ${pct(percentilDe(fuerza.nivel))}.`;
  const boton = (c: Comparacion, texto: string) =>
    `<button type="button" data-comparar="${c}" aria-pressed="${comparacion === c}">${texto}</button>`;
  return `
      <section class="hoja-detalle" role="dialog" aria-label="${nombre}: ${rango}" style="--color: ${COLORES_RANGO[yo]}">
        <div class="hoja-agarre" aria-hidden="true"><div class="hoja-asa"></div></div>${cerrar}
        <p class="hoja-musculo">${nombre}</p>
        <div class="hoja-cabeza">
          ${insigniaRango(yo, 76, "detalle")}
          <div><p class="hoja-sub">Tu rango</p><p class="hoja-rango">${rango}</p></div>
        </div>
        <div class="hoja-comparar">${boton("todos", "Todos")}${boton("entrenan", "Quienes entrenan")}</div>
        <p class="hoja-frase">${frase}</p>
        ${grafica(yo, comparacion, sexo)}
        ${peso ? bloqueSiguiente(fuerza, sexo, peso, nombre) : ""}
        <p class="hoja-otra">${otra}</p>
      </section>`;
}

/**
 * La explicación de la ventana: qué es, de dónde sale el color y los rangos en orden, del más
 * bajo al más alto, con su color y a quién supera cada uno. Los porcentajes salen de las
 * mismas tablas que el detalle del músculo, en el nivel donde empieza cada rango.
 */
export function ayudaMapa(sexo: Sexo): string {
  const filas = RANGOS.map((r, i) => {
    const desde = Math.max(r.desde, 1);
    return `
          <li class="ayuda-rango">
            <span class="ayuda-insignia" data-rango="${i}">${insigniaRango(i, 24, `ayuda-${i}`)}</span>
            <span class="ayuda-rango-nombre">${i + 1}. ${nombreRango(r.desde, sexo)}</span>
            <span class="ayuda-rango-pct">${percentilDe(desde)} % · ${percentilEntrenanDe(desde)} %</span>
          </li>`;
  }).join("");
  return `
    <div class="ayuda-velo" id="ayuda-velo">
      <div class="ayuda-hoja tarjeta" role="dialog" aria-modal="true" aria-labelledby="ayuda-titulo">
        <button type="button" class="mapa-detalle-cerrar" id="cerrar-ayuda" aria-label="Cerrar">✕</button>
        <p class="ayuda-titulo" id="ayuda-titulo">¿Cómo funciona?</p>
        <p class="ayuda-texto">
          Tu mapa se pinta con lo que anotas en <strong>Registro</strong>. Por cada músculo
          tomamos tu mejor marca de las últimas 8 semanas y la comparamos con tu peso corporal:
          así, alguien más ligero no queda en desventaja.
        </p>
        <p class="ayuda-texto">
          Cada color es un rango. Van del más bajo al más alto: entre más abajo en la lista,
          más fuerte eres.
        </p>
        <ul class="ayuda-rangos">
          <li class="ayuda-rango ayuda-rango-cabeza">
            <span></span><span>Rango</span><span>Superas a</span>
          </li>${filas}
          <li class="ayuda-rango">
            <span class="rango-muestra rango-sin-datos" aria-hidden="true"></span>
            <span class="ayuda-rango-nombre">Gris: sin datos</span><span></span>
          </li>
        </ul>
        <p class="ayuda-nota">
          "Superas a": a qué porcentaje de toda la población · y de la gente que entrena.
        </p>
        <p class="ayuda-texto">
          Toca un músculo para ver su detalle. Con el botón de girar, abajo a la derecha,
          ves tu espalda.
        </p>
      </div>
    </div>`;
}

/**
 * Su rango general, arriba del dibujo: la insignia, el rango y en cuántos músculos se basa.
 * Vacío sin ningún músculo con rango. Se oculta con un músculo tocado (`.con-detalle` en
 * `estilos.css`): ahí manda la hoja de ese músculo.
 */
export function bloqueRangoGeneral(
  fuerza: Readonly<Record<string, FuerzaMusculo>>,
  sexo: Sexo
): string {
  const g = rangoGeneral(fuerza);
  if (!g) return "";
  const i = indiceRango(g.nivel);
  const cuantos = g.musculos === 1 ? "tu músculo con rango" : `tus ${g.musculos} músculos con rango`;
  return `
      <div class="rango-general" style="--color: ${COLORES_RANGO[i]}" role="status"
           aria-label="Tu rango general: ${nombreRango(g.nivel, sexo)}">
        ${insigniaRango(i, 46, "general")}
        <div class="rango-general-texto">
          <p class="rango-general-sub">Tu rango general</p>
          <p class="rango-general-nombre">${nombreRango(g.nivel, sexo)}</p>
          <p class="rango-general-detalle">Más fuerte que el ${pct(percentilEntrenanDe(g.nivel))} de quienes entrenan</p>
          <p class="rango-general-base">Promedio de ${cuantos}</p>
        </div>
      </div>`;
}

/**
 * Las dos caras van siempre en el HTML, una detrás de la otra: así girar es una transición
 * de CSS sobre lo que ya está (ver `conectarMapa`) y no un repintado que cortaría el giro.
 *
 * `fuerza` es el nivel de cada grupo (`data-musculo`); vacío mientras no exista el registro.
 *
 * `pie` va en medio de la fila de abajo, entre Amigos y girar: el "Actualizar peso
 * corporal" (`bloquePeso`). La fila va debajo de "Toca un músculo…" y los dos íconos a la
 * altura del peso, no encima del dibujo (pedido del entrenador, 2026-10-14).
 *
 * Sin acceso a Amigos (`conAmigos` falso) el ícono no sale, pero su hueco se queda para que
 * el peso siga centrado.
 */
export function tarjetaMusculos(
  sexo: Sexo | null | undefined,
  mapas: Readonly<Record<string, EstadoSvg>>,
  fuerza: Readonly<Record<string, FuerzaMusculo>> = {},
  peso: number | null = null,
  pie = "",
  conAmigos = true
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
  const detalle = detalleMusculo(seleccionado, seleccionado ? fuerza[seleccionado] : undefined, sexo, peso);
  return `
    <section class="mapa-cuerpo${seleccionado ? " con-detalle" : ""}${seleccionado && !fuerza[seleccionado] ? " sin-datos" : ""}${rangoGeneral(fuerza) ? " con-general" : ""}" aria-label="Tu mapa muscular">
      <button type="button" class="mapa-ayuda" id="abrir-ayuda"
              aria-label="¿Cómo funciona?" title="¿Cómo funciona?">${ICONO_AYUDA}</button>
      ${bloqueRangoGeneral(fuerza, sexo)}
      <div class="mapa-escena">
        <div class="mapa-marco">
          <div class="mapa-giro${deEspalda ? " girado" : ""}${seleccionado ? " con-seleccion" : ""}" id="mapa-giro">
            ${cara("frente", de(a.frente), deEspalda, fuerza)}
            ${cara("espalda", de(a.espalda), !deEspalda, fuerza)}
          </div>
        </div>
      </div>
      <div id="mapa-detalle">${detalle}</div>
      <div class="mapa-pie">
        ${conAmigos
          ? `<button type="button" class="mapa-comparar" id="abrir-comparar"
                aria-label="Amigos: compárate con los demás" title="Amigos">${ICONO_COMUNIDAD}</button>`
          : `<span class="mapa-comparar mapa-hueco" aria-hidden="true">${ICONO_COMUNIDAD}</span>`}
        <div class="mapa-pie-centro">${pie}</div>
        <button type="button" class="mapa-girar" id="girar-mapa"
                aria-label="${textoBoton(deEspalda)}" title="${textoBoton(deEspalda)}">${ICONO_GIRAR}</button>
      </div>
      ${ayudaAbierta ? ayudaMapa(sexo) : ""}
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
  fuerza: Readonly<Record<string, FuerzaMusculo>> = {},
  peso: number | null = null
): void {
  if (sexo !== "H" && sexo !== "M") return;
  const pintarDetalle = (abriendo = false) => {
    const caja = document.querySelector("#mapa-detalle");
    if (!caja) return;
    caja.innerHTML = detalleMusculo(seleccionado, seleccionado ? fuerza[seleccionado] : undefined, sexo, peso);
    if (abriendo) caja.querySelector(".hoja-detalle")?.classList.add("entra");
    caja.querySelector("#cerrar-detalle")?.addEventListener("click", () => elegir(null));
    conectarHoja(caja.querySelector<HTMLElement>(".hoja-detalle"), () => elegir(null));
    conectarComoSubir(caja);
  };
  const elegir = (grupo: string | null) => {
    const abriendo = seleccionado === null && grupo !== null;
    if (abriendo) comparacion = "entrenan";
    seleccionado = grupo;
    // Sin datos la hoja es chica: el cuerpo se encoge menos (ver `estilos.css`).
    document.querySelector(".mapa-cuerpo")?.classList.toggle("sin-datos", grupo !== null && !fuerza[grupo]);
    marcarSeleccion(true);
    pintarDetalle(abriendo);
  };

  marcarSeleccion(false);
  conectarComoSubir(document.querySelector("#mapa-detalle"));
  document.querySelector("#cerrar-detalle")?.addEventListener("click", () => elegir(null));
  conectarHoja(document.querySelector<HTMLElement>("#mapa-detalle .hoja-detalle"), () => elegir(null));
  // "Todos / Quienes entrenan": delegado en la caja, que sobrevive a `pintarDetalle`.
  document.querySelector("#mapa-detalle")?.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-comparar]");
    const c = b?.dataset.comparar;
    if (c !== "todos" && c !== "entrenan" || c === comparacion) return;
    comparacion = c;
    pintarDetalle();
  });

  // La explicación se abre y cierra sobre lo que ya está, sin repintar (como el giro).
  const conectarAyuda = () => {
    const velo = document.querySelector<HTMLElement>("#ayuda-velo");
    if (!velo) return;
    const cerrar = () => { ayudaAbierta = false; velo.remove(); };
    velo.querySelector("#cerrar-ayuda")?.addEventListener("click", cerrar);
    // Tocar fuera de la hoja también la cierra.
    velo.addEventListener("click", (e) => { if (e.target === velo) cerrar(); });
  };
  conectarAyuda();
  document.querySelector("#abrir-ayuda")?.addEventListener("click", () => {
    if (ayudaAbierta) return;
    ayudaAbierta = true;
    document.querySelector(".mapa-cuerpo")?.insertAdjacentHTML("beforeend", ayudaMapa(sexo));
    conectarAyuda();
    document.querySelector<HTMLElement>("#cerrar-ayuda")?.focus();
  });
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
