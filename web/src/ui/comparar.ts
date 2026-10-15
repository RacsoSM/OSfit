import type { Cliente, Sexo } from "../datos";
import {
  NOMBRES_MUSCULO, indiceRango, nombreMusculo, nombreRango, rangoGeneral, type FuerzaMusculo,
} from "../fuerza";
import { escapar } from "./tarjetaDia";
import { insigniaRango, COLORES_RANGO } from "./insigniaRango";
import { archivosMapa, conNiveles, prepararSvg, type EstadoSvg } from "./mapaMuscular";

/**
 * Amigos (antes "Compararme", dentro de Músculos): todas las que tienen algún músculo con rango, con su rango
 * general, en orden alfabético y "Tú" primero, para que nadie se sienta abajo (decisión del
 * entrenador, 2026-10-14). Al tocar a alguien salen los dos cuerpos lado a lado, cada uno con
 * los colores de sus rangos, y abajo músculo por músculo.
 *
 * La lista la arma la función `compararMusculos`: solo trae nombre, sexo y el nivel de cada
 * músculo. Nunca pesos.
 *
 * 2026-10-15 pasa a llamarse "Amigos". El entrenador decide quién entra (`sinAccesoAmigos`) y
 * cada quien, la primera vez que entra, decide si los demás la ven (`mostrarEnAmigos`).
 */

/** GEMELO: `PersonaComparar` de `functions/src/comparar.ts`. */
export interface PersonaComparar {
  nombre: string;
  sexo: Sexo;
  esTuyo: boolean;
  niveles: Record<string, number>;
}

export type EstadoComparar =
  | { estado: "cargando" }
  | { estado: "listo"; personas: PersonaComparar[] }
  | { estado: "error" };

/**
 * Lo elegido vive en el módulo y no en el HTML, como en el mapa: `pintar()` corre en cada
 * snapshot de Firestore y no debe sacarla de la comparación que está viendo.
 */
let elegida: string | null = null;
let deEspalda = false;
let musculo: string | null = null;

/**
 * Lo que eligió en esta página mientras el snapshot del cliente no lo trae: así la pregunta
 * no vuelve a salir en el instante entre tocar y que llegue. No se borra al salir de la
 * ventana: para entonces el snapshot ya trae lo mismo.
 */
let eleccionLocal: boolean | null = null;
let guardando = false;
let errorEleccion = false;

/** Para los tests y al salir de la ventana. */
export function reiniciarComparar(): void {
  elegida = null;
  deEspalda = false;
  musculo = null;
  errorEleccion = false;
}

/** Para los tests: olvidar lo elegido en la página. */
export function reiniciarEleccionAmigos(): void {
  eleccionLocal = null;
  guardando = false;
  errorEleccion = false;
}

type AmigosDelCliente = Pick<Cliente, "sinAccesoAmigos" | "mostrarEnAmigos">;

/** `true`/`false` si ya eligió; `null` si todavía no. */
function muestra(c: AmigosDelCliente): boolean | null {
  return eleccionLocal ?? (typeof c.mostrarEnAmigos === "boolean" ? c.mostrarEnAmigos : null);
}

const AVISO_ERROR_ELECCION = `<p class="aviso-error">No se pudo guardar. Revisa tu conexión e intenta otra vez.</p>`;

/** La primera vez que entra: que decida antes de ver a nadie. */
function vistaEleccion(): string {
  const off = guardando ? " disabled" : "";
  return `
    <div class="tarjeta cmp-eleccion">
      <p class="confirmar-titulo">¿Quieres que los demás vean tus músculos?</p>
      <p class="accion-nota">En Amigos se ven el nombre, el rango y el mapa de músculos de quienes
        decidieron mostrarse. Nunca el peso. Tú eliges si apareces y lo puedes cambiar cuando quieras.</p>
      ${errorEleccion ? AVISO_ERROR_ELECCION : ""}
      <button class="boton" data-cmp="mostrar"${off}>Mostrar mis músculos</button>
      <button class="boton secundario" data-cmp="ocultar"${off}>Mantenerlos ocultos</button>
      <p class="accion-nota cmp-nota">Aunque los ocultes, tú sí puedes ver a los demás.</p>
    </div>`;
}

/** Arriba de la lista: cómo está y cómo cambiarlo. */
function lineaVisibilidad(visible: boolean): string {
  const off = guardando ? " disabled" : "";
  return `
    ${errorEleccion ? AVISO_ERROR_ELECCION : ""}
    <p class="accion-nota cmp-visibilidad">
      ${visible ? "Los demás ven tus músculos." : "Tus músculos están ocultos para los demás."}
      <button class="boton-texto" data-cmp="${visible ? "ocultar" : "mostrar"}"${off}>${visible ? "Ocultarlos" : "Mostrarlos"}</button>
    </p>`;
}

/** Para los tests: abrir directo la comparación con alguien. */
export function elegirEnComparar(nombre: string | null): void {
  elegida = nombre;
  musculo = null;
}

const fuerzaDe = (p: PersonaComparar): Record<string, FuerzaMusculo> =>
  Object.fromEntries(Object.entries(p.niveles).map(([m, nivel]) => [m, { nivel }]));

/**
 * Una tarjeta de la lista: su cuerpo de frente pintado con sus rangos, su nombre y su rango
 * general con la insignia (estilo "mini cuerpos", elegido por el entrenador, 2026-10-14). Desde
 * la lista ya se ve en qué es fuerte cada quien.
 */
function tarjeta(p: PersonaComparar, i: number, mapas: Readonly<Record<string, EstadoSvg>>): string {
  const fuerza = fuerzaDe(p);
  const g = rangoGeneral(fuerza)!;
  const indice = indiceRango(g.nivel);
  const e = mapas[archivosMapa(p.sexo).frente] ?? { estado: "cargando" };
  const dibujo = e.estado === "listo"
    ? conNiveles(prepararSvg(e.svg, `cmp-l${i}`), fuerza)
    : `<div class="mapa-cargando" aria-hidden="true"></div>`;
  return `
    <button class="cmp-tarjeta${p.esTuyo ? " tuya" : ""}" data-persona="${escapar(p.nombre)}"
            aria-label="${escapar(p.esTuyo ? `Tú, ${nombreRango(g.nivel, p.sexo)}` : `Compararte con ${p.nombre}, ${nombreRango(g.nivel, p.sexo)}`)}">
      <span class="cmp-tarjeta-cuerpo" aria-hidden="true">${dibujo}</span>
      <span class="cmp-tarjeta-nombre">${escapar(p.nombre)}${p.esTuyo ? ` <span class="cmp-tu">Tú</span>` : ""}</span>
      <span class="cmp-tarjeta-rango" style="color: ${COLORES_RANGO[indice]}">
        ${insigniaRango(indice, 22, `cmp-l${i}-ins`)}${escapar(nombreRango(g.nivel, p.sexo))}
      </span>
    </button>`;
}

function vistaLista(personas: PersonaComparar[], mapas: Readonly<Record<string, EstadoSvg>>, visible: boolean): string {
  const yo = personas.find((p) => p.esTuyo);
  const nota = yo
    ? `<p class="accion-nota cmp-nota">Toca a alguien para comparar sus músculos con los tuyos.</p>`
    : `<p class="accion-nota cmp-nota">Todavía no tienes músculos con rango: registra tus entrenamientos para aparecer aquí. Igual puedes ver al resto.</p>`;
  const lista = personas.length === 0
    ? `<p class="accion-nota" style="text-align:center">Todavía nadie tiene músculos con rango.</p>`
    : `<div class="cmp-grid">${personas.map((p, i) => tarjeta(p, i, mapas)).join("")}</div>`;
  return `
    <p class="confirmar-titulo">Compárate con el resto</p>
    ${lineaVisibilidad(visible)}
    ${nota}
    ${lista}`;
}

/** Un cuerpo: el SVG del lado que se ve, con los colores de sus rangos. */
function cuerpo(
  quien: "a" | "b",
  titulo: string,
  sexo: Sexo,
  fuerza: Record<string, FuerzaMusculo>,
  mapas: Readonly<Record<string, EstadoSvg>>
): string {
  const archivos = archivosMapa(sexo);
  const lado = deEspalda ? "espalda" : "frente";
  const e = mapas[archivos[lado]] ?? { estado: "cargando" };
  const svg = e.estado === "listo"
    ? conNiveles(prepararSvg(e.svg, `cmp-${quien}-${lado}`), fuerza)
    : e.estado === "error"
      ? `<p class="mapa-aviso">No se pudo cargar.</p>`
      : `<div class="mapa-cargando" role="status" aria-label="Cargando"></div>`;
  const g = rangoGeneral(fuerza);
  return `
    <figure class="cmp-cuerpo">
      <figcaption>
        <span class="cmp-cuerpo-nombre">${escapar(titulo)}</span>
        <span class="cmp-cuerpo-rango"${g ? ` style="color: ${COLORES_RANGO[indiceRango(g.nivel)]}"` : ""}>${g ? escapar(nombreRango(g.nivel, sexo)) : "Sin datos"}</span>
      </figcaption>
      <div class="cmp-svg">${svg}</div>
    </figure>`;
}

function celda(f: FuerzaMusculo | undefined, sexo: Sexo, gana: boolean): string {
  if (!f) return `<span class="cmp-celda sin">—</span>`;
  const i = indiceRango(f.nivel);
  return `<span class="cmp-celda${gana ? " gana" : ""}"><i style="background: ${COLORES_RANGO[i]}"></i>${escapar(nombreRango(f.nivel, sexo))}</span>`;
}

function vistaComparacion(
  yo: PersonaComparar | undefined,
  miSexo: Sexo,
  otra: PersonaComparar,
  mapas: Readonly<Record<string, EstadoSvg>>
): string {
  const mia = yo ? fuerzaDe(yo) : {};
  const suya = fuerzaDe(otra);
  // En el orden de siempre (`NOMBRES_MUSCULO`), solo los que alguna de las dos tiene.
  const musculos = Object.keys(NOMBRES_MUSCULO).filter((m) => mia[m] || suya[m]);
  const filas = musculos.map((m) => {
    const a = mia[m]?.nivel ?? -1;
    const b = suya[m]?.nivel ?? -1;
    return `
      <button class="cmp-musculo${musculo === m ? " tocado" : ""}" data-musculo-cmp="${m}">
        <span class="cmp-musculo-nombre">${escapar(nombreMusculo(m))}</span>
        ${celda(mia[m], miSexo, a > b)}
        ${celda(suya[m], otra.sexo, b > a)}
      </button>`;
  }).join("");
  // Solo claves conocidas (`NOMBRES_MUSCULO`) llegan aquí: es seguro dentro del selector.
  const resalte = musculo && NOMBRES_MUSCULO[musculo]
    ? `<style>.cmp-cuerpos .musculo:not([data-musculo="${musculo}"]) { opacity: 0.25; }</style>`
    : "";
  return `
    <button class="boton-texto registro-volver" data-cmp="lista">← Todos</button>
    ${resalte}
    <div class="cmp-cuerpos">
      ${cuerpo("a", "Tú", miSexo, mia, mapas)}
      ${cuerpo("b", otra.nombre, otra.sexo, suya, mapas)}
    </div>
    <button class="boton secundario cmp-girar" data-cmp="girar">${deEspalda ? "Ver de frente" : "Ver espalda"}</button>
    <div class="tarjeta cmp-tabla">
      <div class="cmp-musculo cmp-encabezado" aria-hidden="true">
        <span></span><span>Tú</span><span>${escapar(otra.nombre)}</span>
      </div>
      ${filas}
    </div>`;
}

/** Lo que va en `#contenido` con Amigos abierto. */
export function ventanaComparar(
  e: EstadoComparar,
  miSexo: Sexo | null | undefined,
  mapas: Readonly<Record<string, EstadoSvg>>,
  cliente: AmigosDelCliente = {}
): string {
  let cuerpoHtml: string;
  const visible = muestra(cliente);
  if (miSexo !== "H" && miSexo !== "M") {
    cuerpoHtml = `<p class="accion-nota">Tu entrenador tiene que completar tu perfil para compararte.</p>`;
  } else if (cliente.sinAccesoAmigos === true) {
    cuerpoHtml = `<p class="accion-nota">Tu entrenador todavía no te ha dado acceso a Amigos.</p>`;
  } else if (visible === null) {
    cuerpoHtml = vistaEleccion();
  } else if (e.estado === "cargando") {
    cuerpoHtml = `<p class="accion-nota" style="text-align:center">Cargando…</p>`;
  } else if (e.estado === "error") {
    cuerpoHtml = `<p class="aviso-error">No se pudo cargar. Revisa tu conexión e intenta otra vez.</p>
      <button class="boton" data-cmp="reintentar">Reintentar</button>`;
  } else {
    const otra = elegida === null ? undefined : e.personas.find((p) => p.nombre === elegida && !p.esTuyo);
    cuerpoHtml = otra
      ? vistaComparacion(e.personas.find((p) => p.esTuyo), miSexo, otra, mapas)
      : vistaLista(e.personas, mapas, visible);
  }
  return `<div id="comparar" class="comparar">${cuerpoHtml}</div>`;
}

/** Los sexos cuyos mapas hay que tener: el suyo y el de quien está viendo. */
export function sexosAComparar(e: EstadoComparar, miSexo: Sexo | null | undefined): Sexo[] {
  const sexos = new Set<Sexo>();
  if (miSexo === "H" || miSexo === "M") sexos.add(miSexo);
  if (e.estado === "listo") {
    const otra = elegida === null ? undefined : e.personas.find((p) => p.nombre === elegida && !p.esTuyo);
    // En la lista se dibujan todos: hacen falta los mapas de los dos sexos que haya.
    for (const p of otra ? [otra] : e.personas) sexos.add(p.sexo);
  }
  return [...sexos];
}

/** Un solo listener delegado en `#comparar`: el contenido se rehace en cada repintado. */
export function conectarComparar(
  repintar: () => void,
  reintentar: () => void,
  elegir: (mostrar: boolean) => Promise<unknown>
): void {
  const raiz = document.querySelector<HTMLElement>("#comparar");
  if (!raiz) return;
  raiz.addEventListener("click", (ev) => {
    const objetivo = ev.target as Element;
    // Tocar un músculo en cualquiera de los dos cuerpos lo resalta en ambos.
    const enCuerpo = objetivo.closest<SVGElement>(".cmp-cuerpos [data-musculo]");
    if (enCuerpo) {
      const m = enCuerpo.getAttribute("data-musculo");
      musculo = m === musculo ? null : m;
      repintar();
      return;
    }
    const el = objetivo.closest<HTMLElement>("button");
    if (!el) return;
    if (el.dataset.persona !== undefined) {
      const p = el.dataset.persona;
      if (el.classList.contains("tuya")) return;
      elegida = p;
      musculo = null;
      repintar();
      window.scrollTo(0, 0);
      return;
    }
    if (el.dataset.musculoCmp !== undefined) {
      musculo = el.dataset.musculoCmp === musculo ? null : el.dataset.musculoCmp;
      repintar();
      return;
    }
    const accion = el.dataset.cmp;
    if (accion === "lista") { elegida = null; musculo = null; repintar(); return; }
    if (accion === "girar") { deEspalda = !deEspalda; repintar(); return; }
    if (accion === "reintentar") { reintentar(); return; }
    if ((accion === "mostrar" || accion === "ocultar") && !guardando) {
      const mostrar = accion === "mostrar";
      const antes = eleccionLocal;
      eleccionLocal = mostrar;
      guardando = true;
      errorEleccion = false;
      repintar();
      elegir(mostrar).then(
        () => { guardando = false; repintar(); },
        () => { eleccionLocal = antes; guardando = false; errorEleccion = true; repintar(); }
      );
    }
  });
}
