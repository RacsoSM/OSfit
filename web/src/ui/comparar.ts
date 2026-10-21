import type { Cliente, ModoAmigos, Sexo } from "../datos";
import {
  NOMBRES_MUSCULO, indiceRango, nombreMusculo, nombreRango, rangoGeneral, type FuerzaMusculo,
} from "../fuerza";
import { escapar } from "./tarjetaDia";
import { botonAtras } from "./botonAtras";
import { insigniaRango, COLORES_RANGO } from "./insigniaRango";
import { archivosMapa, conNiveles, prepararSvg, type EstadoSvg } from "./mapaMuscular";
import type { DatosBatalla } from "../batalla";
import { ICONO_BATALLA, abrirBatalla, batallaCon, cambioBatalla, clicBatalla, reiniciarBatalla, vistaBatalla } from "./batalla";

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
 * cada quien, la primera vez que entra, decide quién la ve (`visibilidadAmigos`): todos, solo
 * algunas personas que escoge de la lista, o nadie. Con "nadie" tampoco ve a los demás.
 *
 * 2026-10-21: en la comparación con alguien está el botón de Batalla (`./batalla.ts`). A quien
 * se ve en Amigos se le puede retar, y en la batalla sí se ven sus mejores series con peso
 * (decisión del entrenador): por eso la pregunta ya no promete "nunca el peso".
 */

/** GEMELO: `PersonaComparar` de `functions/src/comparar.ts`. */
export interface PersonaComparar {
  nombre: string;
  sexo: Sexo;
  esTuyo: boolean;
  niveles: Record<string, number>;
}

/** GEMELO: `Candidato` de `functions/src/comparar.ts`. */
export interface Candidato {
  id: string;
  nombre: string;
}

/** Lo que se manda a `elegirMostrarEnAmigos`. */
export interface EleccionAmigos {
  modo: ModoAmigos;
  con?: string[];
}

export type EstadoComparar =
  | { estado: "cargando" }
  | { estado: "listo"; personas: PersonaComparar[]; candidatos?: Candidato[] }
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
 * no vuelve a salir en el instante entre que se guarda y que llega. No se borra al salir de la
 * ventana: para entonces el snapshot ya trae lo mismo.
 */
let eleccionLocal: EleccionAmigos | null = null;
let guardando = false;
let errorEleccion = false;
/** Ya eligió y tocó "Cambiar": se le vuelve a mostrar la pregunta. */
let cambiando = false;
/** Con la lista de "Solo algunas personas" abierta: las marcadas. */
let escogiendo: Set<string> | null = null;
/** Con quién comparte hoy, del último pintado: de ahí arranca la lista al abrirla. */
let conGuardadas: string[] = [];

/** Para los tests y al salir de la ventana. */
export function reiniciarComparar(): void {
  reiniciarBatalla();
  elegida = null;
  deEspalda = false;
  musculo = null;
  errorEleccion = false;
  cambiando = false;
  escogiendo = null;
}

/** Para los tests: olvidar lo elegido en la página. */
export function reiniciarEleccionAmigos(): void {
  eleccionLocal = null;
  guardando = false;
  errorEleccion = false;
  cambiando = false;
  escogiendo = null;
}

/** Para los tests: abrir la lista de "Solo algunas personas" con estas marcadas. */
export function escogerEnAmigos(ids: string[] | null): void {
  escogiendo = ids === null ? null : new Set(ids);
}

type AmigosDelCliente = Pick<Cliente, "sinAccesoAmigos" | "mostrarEnAmigos" | "visibilidadAmigos" | "compartirAmigosCon" | "adminAmigos">;

/** Lo que eligió, o `null` si todavía no. `mostrarEnAmigos` es la versión vieja, sí/no. */
export function modoAmigos(c: AmigosDelCliente): ModoAmigos | null {
  if (eleccionLocal) return eleccionLocal.modo;
  if (c.visibilidadAmigos === "todos" || c.visibilidadAmigos === "algunos" || c.visibilidadAmigos === "nadie") {
    return c.visibilidadAmigos;
  }
  if (c.mostrarEnAmigos === true) return "todos";
  if (c.mostrarEnAmigos === false) return "nadie";
  return null;
}

function compartidoCon(c: AmigosDelCliente): string[] {
  return eleccionLocal ? eleccionLocal.con ?? [] : c.compartirAmigosCon ?? [];
}

const AVISO_ERROR_ELECCION = `<p class="aviso-error">No se pudo guardar. Revisa tu conexión e intenta otra vez.</p>`;

/** La primera vez que entra, o al tocar "Cambiar": que decida antes de ver a nadie. */
function vistaEleccion(puedeCancelar: boolean): string {
  const off = guardando ? " disabled" : "";
  return `
    <div class="tarjeta cmp-eleccion">
      <p class="confirmar-titulo">¿Quién puede ver tus músculos?</p>
      <p class="accion-nota">En Amigos se ven tu nombre, tu rango y tu mapa de músculos. Quien te
        vea también podrá retarte a una batalla, donde se comparan sus mejores series con las tuyas,
        con su peso. Lo puedes cambiar cuando quieras.</p>
      ${errorEleccion ? AVISO_ERROR_ELECCION : ""}
      <button class="boton" data-cmp="todos"${off}>Mostrarlos a todos</button>
      <button class="boton secundario" data-cmp="algunos"${off}>Solo a algunas personas</button>
      <button class="boton secundario" data-cmp="nadie"${off}>Mantenerlos ocultos</button>
      <p class="accion-nota cmp-nota">Si los ocultas, tú tampoco podrás ver los de los demás.</p>
      ${puedeCancelar ? `<button class="boton-texto" data-cmp="cancelar"${off}>Cancelar</button>` : ""}
    </div>`;
}

/** "Solo a algunas personas": la lista de todas, para marcar con quién compartir. */
function vistaEscoger(e: EstadoComparar): string {
  if (e.estado === "cargando") return `<p class="accion-nota" style="text-align:center">Cargando…</p>`;
  if (e.estado === "error") {
    return `<p class="aviso-error">No se pudo cargar. Revisa tu conexión e intenta otra vez.</p>
      <button class="boton" data-cmp="reintentar">Reintentar</button>`;
  }
  const marcadas = escogiendo ?? new Set<string>();
  const candidatos = e.candidatos ?? [];
  const off = guardando ? " disabled" : "";
  const lista = candidatos.length === 0
    ? `<p class="accion-nota">Todavía no hay nadie más en Amigos.</p>`
    : `<div class="cmp-candidatos">${candidatos.map((c) => `
        <label class="cmp-candidato">
          <input type="checkbox" data-candidato="${escapar(c.id)}"${marcadas.has(c.id) ? " checked" : ""}${off}>
          <span>${escapar(c.nombre)}</span>
        </label>`).join("")}</div>`;
  // Solo cuentan las que siguen en la lista: alguien pudo perder el acceso desde la última vez.
  const n = candidatos.filter((c) => marcadas.has(c.id)).length;
  return `
    <div class="tarjeta cmp-eleccion">
      <p class="confirmar-titulo">¿Con quién quieres compartirlos?</p>
      <p class="accion-nota">Solo las personas que marques verán tus músculos.</p>
      ${errorEleccion ? AVISO_ERROR_ELECCION : ""}
      ${lista}
      <button class="boton" data-cmp="guardar-algunos"${n === 0 || guardando ? " disabled" : ""}>
        ${n === 0 ? "Marca al menos a una persona" : `Compartir con ${n === 1 ? "1 persona" : `${n} personas`}`}
      </button>
      <button class="boton-texto" data-cmp="cancelar"${off}>Cancelar</button>
    </div>`;
}

/** Con "nadie": ni sale ni ve, y se le dice por qué. */
function vistaOculta(): string {
  return `
    <p class="confirmar-titulo">Amigos</p>
    <div class="tarjeta cmp-eleccion">
      <p class="accion-nota">Tus músculos están ocultos, así que tampoco ves los de los demás.</p>
      <button class="boton" data-cmp="cambiar">Elegir quién puede verlos</button>
    </div>`;
}

/** Arriba de la lista: cómo está y cómo cambiarlo. El administrador además ve que ve a todos. */
function lineaVisibilidad(modo: ModoAmigos, cuantas: number, admin = false): string {
  const texto = modo === "algunos"
    ? `Solo ${cuantas === 1 ? "1 persona ve" : `${cuantas} personas ven`} tus músculos.`
    : modo === "nadie" ? "Tus músculos están ocultos para los demás."
    : "Todos ven tus músculos.";
  return `
    <p class="accion-nota cmp-visibilidad">
      ${texto}
      <button class="boton-texto" data-cmp="cambiar">Cambiar</button>
    </p>
    ${admin ? `<p class="accion-nota cmp-visibilidad">Como administrador, ves a todos.</p>` : ""}`;
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

function vistaLista(personas: PersonaComparar[], mapas: Readonly<Record<string, EstadoSvg>>, linea: string): string {
  const yo = personas.find((p) => p.esTuyo);
  const nota = yo
    ? `<p class="accion-nota cmp-nota">Toca a alguien para comparar sus músculos con los tuyos.</p>`
    : `<p class="accion-nota cmp-nota">Todavía no tienes músculos con rango: registra tus entrenamientos para aparecer aquí. Igual puedes ver al resto.</p>`;
  const lista = personas.length === 0
    ? `<p class="accion-nota" style="text-align:center">Todavía nadie tiene músculos con rango.</p>`
    : `<div class="cmp-grid">${personas.map((p, i) => tarjeta(p, i, mapas)).join("")}</div>`;
  return `
    <p class="confirmar-titulo">Amigos</p>
    ${linea}
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
    ${botonAtras(`data-cmp="lista"`)}
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
    </div>
    ${barraBatalla(yo, otra)}`;
}

/**
 * La invitación a la batalla: una barra fija sobre la de navegación, con el degradado del
 * cartel de la Arena y los dos avatares (propuesta "L", entrenador, 2026-10-21). Antes era un
 * botón ancho arriba de los cuerpos que se veía como la acción principal de la pantalla.
 */
function barraBatalla(yo: PersonaComparar | undefined, otra: PersonaComparar): string {
  const inicial = (n: string) => escapar(Array.from(n.trim())[0]?.toUpperCase() ?? "?");
  return `
    <div class="bat-barra">
      <span class="bat-barra-avatares" aria-hidden="true">
        <span class="a">${inicial(yo?.nombre ?? "Tú")}</span><span class="b">${inicial(otra.nombre)}</span>
      </span>
      <span class="bat-barra-texto">${yo ? "¿Quién es más fuerte?" : "Registra tus entrenamientos para batallar"}</span>
      <button class="bat-barra-boton" data-cmp="batalla" aria-label="Batalla contra ${escapar(otra.nombre)}" ${yo ? "" : "disabled"}>${ICONO_BATALLA}<span>Batalla</span></button>
    </div>`;
}

/** Su rango general por nombre ("Atlética"), para el cartel de la batalla. */
function rangoDe(p: PersonaComparar | undefined): string | null {
  const g = p ? rangoGeneral(fuerzaDe(p)) : null;
  return g && p ? nombreRango(g.nivel, p.sexo) : null;
}

/** Lo que va en `#contenido` con Amigos abierto. */
export function ventanaComparar(
  e: EstadoComparar,
  miSexo: Sexo | null | undefined,
  mapas: Readonly<Record<string, EstadoSvg>>,
  cliente: AmigosDelCliente = {}
): string {
  let cuerpoHtml: string;
  const modo = modoAmigos(cliente);
  conGuardadas = modo === "algunos" ? compartidoCon(cliente) : [];
  let enComparacion = false;
  if (miSexo !== "H" && miSexo !== "M") {
    cuerpoHtml = `<p class="accion-nota">Tu entrenador tiene que completar tu perfil para compararte.</p>`;
  } else if (cliente.sinAccesoAmigos === true && cliente.adminAmigos !== true) {
    cuerpoHtml = `<p class="accion-nota">Tu entrenador todavía no te ha dado acceso a Amigos.</p>`;
  } else if (escogiendo !== null) {
    cuerpoHtml = vistaEscoger(e);
  } else if (modo === null || cambiando) {
    cuerpoHtml = vistaEleccion(modo !== null);
  } else if (modo === "nadie" && cliente.adminAmigos !== true) {
    cuerpoHtml = vistaOculta();
  } else if (e.estado === "cargando") {
    cuerpoHtml = `<p class="accion-nota" style="text-align:center">Cargando…</p>`;
  } else if (e.estado === "error") {
    cuerpoHtml = `<p class="aviso-error">No se pudo cargar. Revisa tu conexión e intenta otra vez.</p>
      <button class="boton" data-cmp="reintentar">Reintentar</button>`;
  } else {
    const otra = elegida === null ? undefined : e.personas.find((p) => p.nombre === elegida && !p.esTuyo);
    enComparacion = otra !== undefined;
    cuerpoHtml = otra && batallaCon(otra.nombre)
      ? vistaBatalla({ a: rangoDe(e.personas.find((p) => p.esTuyo)), b: rangoDe(otra) })
      : otra
      ? vistaComparacion(e.personas.find((p) => p.esTuyo), miSexo, otra, mapas)
      : vistaLista(e.personas, mapas, lineaVisibilidad(modo, compartidoCon(cliente).length, cliente.adminAmigos === true));
  }
  // En la comparación la flecha regresa a la lista (va dentro de `vistaComparacion`); en lo
  // demás —la lista, cargando o el error— sale de Amigos a Músculos.
  const atras = enComparacion ? "" : botonAtras(`data-cmp="salir"`);
  return `<div id="comparar" class="comparar">${atras}${cuerpoHtml}</div>`;
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
  salir: () => void,
  elegir: (eleccion: EleccionAmigos) => Promise<unknown>,
  pedirBatalla: (nombre: string) => Promise<DatosBatalla> = () => Promise.reject(new Error("sin batalla"))
): void {
  const raiz = document.querySelector<HTMLElement>("#comparar");
  if (!raiz) return;
  const guardar = (eleccion: EleccionAmigos) => {
    guardando = true;
    errorEleccion = false;
    repintar();
    elegir(eleccion).then(
      () => { eleccionLocal = eleccion; guardando = false; cambiando = false; escogiendo = null; repintar(); },
      () => { guardando = false; errorEleccion = true; repintar(); }
    );
  };
  // Marcar o desmarcar a alguien en "Solo a algunas personas".
  raiz.addEventListener("change", (ev) => {
    if (cambioBatalla(ev.target as Element, repintar)) return;
    const caja = (ev.target as Element).closest<HTMLInputElement>("input[data-candidato]");
    if (!caja || escogiendo === null) return;
    const id = caja.dataset.candidato!;
    if (caja.checked) escogiendo.add(id); else escogiendo.delete(id);
    repintar();
  });
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
    if (clicBatalla(el, repintar, pedirBatalla)) return;
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
    if (accion === "batalla" && elegida !== null) { abrirBatalla(elegida, pedirBatalla, repintar); repintar(); window.scrollTo(0, 0); return; }
    if (accion === "salir") { salir(); return; }
    if (accion === "girar") { deEspalda = !deEspalda; repintar(); return; }
    if (accion === "reintentar") { reintentar(); return; }
    if (guardando) return;
    if (accion === "todos" || accion === "nadie") { guardar({ modo: accion }); return; }
    if (accion === "algunos") {
      escogiendo = new Set(conGuardadas);
      errorEleccion = false;
      repintar();
      return;
    }
    if (accion === "guardar-algunos" && escogiendo) { guardar({ modo: "algunos", con: [...escogiendo] }); return; }
    if (accion === "cambiar") { cambiando = true; errorEleccion = false; repintar(); return; }
    if (accion === "cancelar") { cambiando = false; escogiendo = null; errorEleccion = false; repintar(); }
  });
}
