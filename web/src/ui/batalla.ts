import {
  ejerciciosDe, musculosEnComun, resolverBatalla, textoResultado, textoSerie,
  type DatosBatalla, type Eleccion, type EjercicioBatalla, type Lado, type Resultado,
} from "../batalla";
import { nombreMusculo } from "../fuerza";
import { botonAtras } from "./botonAtras";
import { escapar } from "./tarjetaDia";

/**
 * La ventana de Batalla, dentro de la comparación con alguien en Amigos (pedido del
 * entrenador, 2026-10-21): se elige el combate (todo, por músculo o un ejercicio), corre una
 * animación de unos 3 segundos y sale quién ganó, con la mejor serie y el 1RM estimado de las
 * dos en cada ejercicio. La cuenta está en `../batalla.ts`; los datos los trae `batallaAmigos`.
 *
 * Diseño elegido por el entrenador el mismo día: la "Arena" (fondo morado de la pelea) con el
 * cartel partido en diagonal arriba, tú en naranja y la rival en azul, sin importar la paleta.
 * Con el **Modo suspenso** el resultado no se anuncia: los ejercicios salen con las series
 * tapadas, se destapan tocándolas en cualquier orden y el marcador sube cuando un ejercicio
 * tiene las dos destapadas; al destapar el último, el cartel anuncia a la ganadora.
 *
 * El estado vive en el módulo, como en `comparar.ts`: `#contenido` se rehace en cada snapshot
 * de Firestore y no debe sacarla de la batalla, reiniciar la animación ni volver a tapar nada.
 */

export const DURACION_ANIMACION = 3000;
/** Con movimiento reducido no hay pelea que ver: un instante y el resultado. */
const DURACION_QUIETA = 400;
/** El modo suspenso se recuerda en el navegador: es un gusto de cada quien. */
const LLAVE_SUSPENSO = "osfit:batalla-suspenso";

export type DatosCargados =
  | { estado: "cargando" }
  | { estado: "listo"; datos: DatosBatalla }
  | { estado: "error" };

/** El menú de combates o una de sus dos listas. */
type Vista = "menu" | "musculo" | "ejercicio";

interface EstadoBatalla {
  rival: string;
  datos: DatosCargados;
  vista: Vista;
  eleccion: Eleccion | null;
  /** Cuándo empezó la animación (ms); null mientras elige. */
  inicio: number | null;
  duracion: number;
  suspenso: boolean;
  /** Las series ya destapadas, `<fila>:<a|b>`. Sin suspenso no se usa. */
  destapadas: Set<string>;
  /** La última destapada: entra con su vuelta. */
  recien?: string | null;
  /** El anuncio del cartel ya se pintó una vez: su entrada no se repite en cada snapshot. */
  anunciado?: boolean;
}

/** Los rangos generales de las dos, para el cartel (`null` si no tiene). */
export interface RangosCartel {
  a: string | null;
  b: string | null;
}

let batalla: EstadoBatalla | null = null;
let pedido = 0;
/** Lo que dura una animación ya pintada; se limpia al cerrar para no repintar de más. */
let temporizador: ReturnType<typeof setTimeout> | null = null;
let ahora: () => number = () => Date.now();

/** Para los tests: un reloj fijo. */
export function relojBatalla(f: () => number): void {
  ahora = f;
}

export function reiniciarBatalla(): void {
  batalla = null;
  pedido++;
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
}

function nueva(rival: string): EstadoBatalla {
  return {
    rival, datos: { estado: "cargando" }, vista: "menu", eleccion: null, inicio: null,
    duracion: DURACION_ANIMACION, suspenso: suspensoGuardado(), destapadas: new Set(),
  };
}

/** Para los tests: abrir la batalla en un estado dado. */
export function ponerBatalla(e: Partial<EstadoBatalla> & { rival: string } | null): void {
  batalla = e === null ? null : { ...nueva(e.rival), suspenso: false, ...e };
}

/** Si hay una batalla abierta con esa persona. */
export function batallaCon(rival: string): boolean {
  return batalla?.rival === rival;
}

function suspensoGuardado(): boolean {
  try {
    // Prendido de entrada: es la forma divertida, y el diseño elegido lo trae marcado.
    return localStorage.getItem(LLAVE_SUSPENSO) !== "0";
  } catch {
    return true;
  }
}

function guardarSuspenso(valor: boolean): void {
  try {
    localStorage.setItem(LLAVE_SUSPENSO, valor ? "1" : "0");
  } catch {
    // Sin almacenamiento solo se olvida para la próxima vez.
  }
}

export function abrirBatalla(rival: string, pedir: (nombre: string) => Promise<DatosBatalla>, repintar: () => void): void {
  reiniciarBatalla();
  batalla = nueva(rival);
  cargar(pedir, repintar);
}

function cargar(pedir: (nombre: string) => Promise<DatosBatalla>, repintar: () => void): void {
  if (!batalla) return;
  const este = ++pedido;
  const rival = batalla.rival;
  batalla.datos = { estado: "cargando" };
  pedir(rival).then(
    (datos) => { if (este === pedido && batalla) { batalla.datos = { estado: "listo", datos }; repintar(); } },
    () => { if (este === pedido && batalla) { batalla.datos = { estado: "error" }; repintar(); } }
  );
}

function sinMovimiento(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function empezar(eleccion: Eleccion, repintar: () => void): void {
  if (!batalla) return;
  batalla.eleccion = eleccion;
  batalla.inicio = ahora();
  batalla.anunciado = false;
  batalla.destapadas = new Set();
  batalla.recien = null;
  batalla.duracion = sinMovimiento() ? DURACION_QUIETA : DURACION_ANIMACION;
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => { temporizador = null; repintar(); }, batalla.duracion + 20);
  repintar();
  window.scrollTo(0, 0);
}

/** Volver al menú de combates (la flecha desde una lista o el resultado, y "Otra batalla"). */
function alMenu(b: EstadoBatalla): void {
  b.vista = "menu";
  b.eleccion = null;
  b.inicio = null;
}

/** El ícono del botón: dos espadas cruzadas, en el trazo de los íconos de la barra. */
export const ICONO_BATALLA = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="icono-batalla">
    <path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/>
    <path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>
  </svg>`;

const ICONO_MUSCULO = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="icono-batalla">
    <circle cx="12" cy="5" r="2.5"/><path d="M7 21v-6l-2-5 7-2 7 2-2 5v6"/>
  </svg>`;

const ICONO_PESA = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="icono-batalla">
    <path d="M6 8v8"/><path d="M18 8v8"/><path d="M3 10v4"/><path d="M21 10v4"/><path d="M6 12h12"/>
  </svg>`;

const CORONA = `
  <svg class="bat-corona" viewBox="0 0 34 26" aria-hidden="true" focusable="false">
    <path d="M3 22 L1 5 L10 12 L17 1 L24 12 L33 5 L31 22 Z"/>
  </svg>`;

function tituloEleccion(e: Eleccion, d: DatosBatalla): string {
  if (e.modo === "todo") return "Todo";
  if (e.modo === "musculo") return nombreMusculo(e.musculo);
  return d.ejercicios.find((x) => x.id === e.ejercicio)?.nombre ?? "Ejercicio";
}

function inicial(nombre: string): string {
  return escapar(Array.from(nombre.trim())[0]?.toUpperCase() ?? "?");
}

/**
 * El cartel partido en diagonal. Sin `resultado`, la presentación con sus rangos; con él, el
 * anuncio: la ganadora con corona y su marcador en oro, la otra apagada.
 */
function cartel(d: DatosBatalla, rangos: RangosCartel, resultado?: { r: Resultado; entrando: boolean }): string {
  const lado = (l: Lado) => {
    const nombre = l === "a" ? "Tú" : d.b.nombre;
    const rango = rangos[l];
    const ganador = resultado?.r.ganador;
    const clase = resultado ? (ganador === l ? " gana" : ganador === null ? "" : " pierde") : "";
    const marcador = resultado ? `<strong class="bat-cartel-marcador">${resultado.r.victorias[l]}</strong>` : "";
    return `
      <div class="bat-cartel-lado ${l}${clase}">
        ${resultado && ganador === l ? CORONA : ""}
        <span class="bat-cartel-avatar">${inicial(l === "a" ? d.a.nombre : d.b.nombre)}</span>
        <span class="bat-cartel-nombre">${escapar(nombre)}</span>
        ${resultado ? marcador : rango ? `<span class="bat-cartel-rango">${escapar(rango)}</span>` : ""}
      </div>`;
  };
  let centro: string;
  if (resultado) {
    const { titulo, como } = textoResultado(resultado.r, d);
    centro = `
      <div class="bat-cartel-anuncio">
        <span class="bat-cartel-titulo">${escapar(titulo)}</span>
        <span class="bat-cartel-como">${escapar(como)}</span>
      </div>`;
  } else {
    centro = `<span class="bat-cartel-vs" aria-hidden="true">VS</span>`;
  }
  const clase = resultado ? ` anuncio${resultado.entrando ? " entrando" : ""}` : "";
  return `
    <div class="bat-cartel${clase}" ${resultado ? `role="status"` : `aria-label="Tú contra ${escapar(d.b.nombre)}"`}>
      ${lado("a")}${centro}${lado("b")}
    </div>`;
}

function vistaMenu(b: EstadoBatalla, d: DatosBatalla, rangos: RangosCartel): string {
  const n = d.ejercicios.length;
  const musculos = musculosEnComun(d).length;
  const opciones = n === 0
    ? `<p class="accion-nota bat-vacio">Todavía no tienen ningún ejercicio en común. Cuando las dos registren el mismo, ya podrán batallar.</p>`
    : `
      <p class="bat-elige">Elige tu combate</p>
      <div class="bat-combates">
        <button class="bat-combate total" data-bat="todo">
          <span class="bat-combate-icono">${ICONO_BATALLA}</span>
          <span class="bat-combate-texto"><span>Batalla total</span><small>${n === 1 ? "El ejercicio en común" : `Los ${n} ejercicios en común`}</small></span>
        </button>
        <button class="bat-combate" data-bat-vista="musculo">
          <span class="bat-combate-icono">${ICONO_MUSCULO}</span>
          <span class="bat-combate-texto"><span>Por músculo</span><small>${musculos === 1 ? "1 músculo para elegir" : `${musculos} músculos para elegir`}</small></span>
        </button>
        <button class="bat-combate" data-bat-vista="ejercicio">
          <span class="bat-combate-icono">${ICONO_PESA}</span>
          <span class="bat-combate-texto"><span>Uno contra uno</span><small>Un solo ejercicio, cara a cara</small></span>
        </button>
      </div>
      <label class="bat-suspenso">
        <input type="checkbox" data-bat-suspenso${b.suspenso ? " checked" : ""}>
        <span class="bat-suspenso-texto">
          <span>Modo suspenso</span>
          <small>Este modo hace que cada resultado sea más divertido: tú destapas las series una por una.</small>
        </span>
      </label>`;
  return `
    ${cartel(d, rangos)}
    ${opciones}
    <p class="accion-nota bat-regla">Gana quien levanta más en proporción a su peso corporal, con su mejor serie de todo su historial.</p>`;
}

function vistaLista(b: EstadoBatalla, d: DatosBatalla): string {
  const lista = b.vista === "musculo"
    ? `<div class="bat-opciones">${musculosEnComun(d).map(({ musculo, ejercicios }) => `
        <button class="bat-opcion" data-bat-musculo="${musculo}">
          <span class="bat-opcion-nombre">${escapar(nombreMusculo(musculo))}</span>
          <span class="bat-opcion-nota">${ejercicios === 1 ? "1 ejercicio" : `${ejercicios} ejercicios`}</span>
        </button>`).join("")}</div>`
    : `<div class="bat-lista">${d.ejercicios.map((e) => `
        <button class="bat-opcion fila" data-bat-ejercicio="${escapar(e.id)}">
          <span class="bat-opcion-nombre">${escapar(e.nombre)}</span>
          <span class="bat-opcion-flecha" aria-hidden="true">›</span>
        </button>`).join("")}</div>`;
  return `
    <p class="bat-elige">${b.vista === "musculo" ? "¿Por qué músculo pelean?" : "¿En qué ejercicio?"}</p>
    ${lista}`;
}

/**
 * La pelea: los dos entran desde los lados, chocan tres veces con destellos y un "VS", y se
 * apaga. Las animaciones llevan un retraso negativo con lo que ya pasó, así que si un snapshot
 * repinta a la mitad siguen donde iban en vez de empezar de nuevo.
 */
function vistaAnimacion(b: EstadoBatalla, d: DatosBatalla): string {
  const ya = Math.max(0, ahora() - (b.inicio ?? 0));
  const chispas = Array.from({ length: 10 }, (_, i) => {
    const angulo = (i * 36 + 12) * (Math.PI / 180);
    const largo = 46 + (i % 3) * 14;
    return `<i class="bat-chispa" style="--x:${Math.round(Math.cos(angulo) * largo)}px;--y:${Math.round(Math.sin(angulo) * largo)}px"></i>`;
  }).join("");
  return `
    <div class="bat-arena" role="status" aria-label="Batallando…" style="--ya:-${ya}ms">
      <p class="bat-arena-tema">${escapar(tituloEleccion(b.eleccion!, d))}</p>
      <div class="bat-ring">
        <div class="bat-peleador a"><span class="bat-avatar">${inicial(d.a.nombre)}</span><span class="bat-peleador-nombre">Tú</span></div>
        <div class="bat-choque" aria-hidden="true">
          <span class="bat-destello"></span>
          <span class="bat-chispas">${chispas}</span>
          <span class="bat-vs">VS</span>
        </div>
        <div class="bat-peleador b"><span class="bat-avatar">${inicial(d.b.nombre)}</span><span class="bat-peleador-nombre">${escapar(d.b.nombre)}</span></div>
      </div>
    </div>`;
}

/** Una serie: destapada (con su 1RM) o, en suspenso, una tarjeta con "?" para tocar. */
function celda(
  e: EjercicioBatalla, i: number, lado: Lado, gana: Lado | null, completa: boolean,
  tapada: boolean, otraTapada: boolean, recien: boolean, rival: string
): string {
  if (tapada) {
    const texto = lado === "a" ? "Tu serie" : `Serie de ${rival}`;
    return `
      <button class="bat-celda tapada ${lado}" data-bat-destapar="${i}:${lado}" aria-label="Destapar ${escapar(texto)} en ${escapar(e.nombre)}">
        <span class="bat-tapada-signo" aria-hidden="true">?</span>
        <span class="bat-tapada-texto">${escapar(texto)}</span>
      </button>`;
  }
  const m = e[lado];
  const gano = completa && gana === lado;
  const rm = m.unoRm !== null ? `<span class="bat-rm">1RM ≈ ${m.unoRm} kg</span>` : "";
  // Cuánto levanta para su peso: es lo que decide, y explica por qué a veces gana el 1RM menor.
  const pct = m.porPeso != null
    ? `<span class="bat-pct">${m.porPeso} % de ${lado === "a" ? "tu" : "su"} peso</span>`
    : "";
  const espera = otraTapada ? `<span class="bat-espera">${lado === "a" ? `Esperando a ${escapar(rival)}…` : "Esperando tu serie…"}</span>` : "";
  return `
    <div class="bat-celda${gano ? " gana" : ""}${recien ? " destapando" : ""}">
      <span class="bat-serie">${escapar(textoSerie(e, m))}</span>
      ${rm}
      ${pct}
      ${espera}
      ${gano ? `<span class="bat-gana">Gana</span>` : ""}
    </div>`;
}

function vistaResultado(b: EstadoBatalla, d: DatosBatalla, rangos: RangosCartel): string {
  const r = resolverBatalla(ejerciciosDe(d, b.eleccion!));
  const tapada = (i: number, l: Lado) => b.suspenso && !b.destapadas.has(`${i}:${l}`);
  const completas = r.filas.map((_, i) => !tapada(i, "a") && !tapada(i, "b"));
  const faltan = completas.filter((c) => !c).length;
  const filas = r.filas.map(({ ejercicio: e, gana }, i) => {
    const completa = completas[i];
    const c = (l: Lado) => celda(e, i, l, gana, completa, tapada(i, l), tapada(i, l === "a" ? "b" : "a"),
      b.recien === `${i}:${l}`, d.b.nombre);
    return `
    <div class="bat-fila">
      <p class="bat-fila-nombre">${escapar(e.nombre)}${e.pesoPorMancuerna ? ` <span class="bat-fila-nota">por mancuerna</span>` : ""}${completa && gana === null ? ` <span class="bat-empate">Empate</span>` : ""}</p>
      <div class="bat-celdas">${c("a")}${c("b")}</div>
    </div>`;
  }).join("");

  let arriba: string;
  if (faltan > 0) {
    // El marcador solo cuenta los ejercicios con las dos series destapadas.
    const cuenta = (l: Lado) => r.filas.filter((f, i) => completas[i] && f.gana === l).length;
    arriba = `
      <div class="bat-parcial" role="status">
        <div class="bat-parcial-marcador">
          <span class="a"><span>Tú</span><strong>${cuenta("a")}</strong></span>
          <span class="bat-parcial-guion" aria-hidden="true">–</span>
          <span class="b"><strong>${cuenta("b")}</strong><span>${escapar(d.b.nombre)}</span></span>
        </div>
        <span class="bat-parcial-faltan">${faltan === 1 ? "Queda 1 ejercicio por destapar" : `Quedan ${faltan} ejercicios por destapar`}</span>
      </div>`;
  } else {
    arriba = cartel(d, rangos, { r, entrando: !b.anunciado });
    b.anunciado = true;
  }
  return `
    <p class="bat-tema">${escapar(tituloEleccion(b.eleccion!, d))}${b.suspenso ? " · Modo suspenso" : ""}</p>
    ${arriba}
    <div class="bat-tabla">
      <div class="bat-celdas bat-encabezado" aria-hidden="true"><span>Tú</span><span>${escapar(d.b.nombre)}</span></div>
      ${filas}
    </div>
    ${faltan > 0 ? `<button class="boton-texto bat-destapar-todo" data-bat="destapar-todo">Destapar todo de una vez</button>` : ""}
    <button class="boton bat-otra" data-bat="otra">Otra batalla</button>`;
}

/** Lo que va dentro de `#comparar` con la batalla abierta. */
export function vistaBatalla(rangos: RangosCartel = { a: null, b: null }): string {
  const b = batalla;
  if (!b) return "";
  let cuerpo: string;
  // La flecha regresa un paso: de una lista o del resultado al menú; del menú, a la comparación.
  let atras = "cerrar";
  if (b.datos.estado === "cargando") {
    cuerpo = `<p class="accion-nota bat-cargando">Preparando la batalla…</p>`;
  } else if (b.datos.estado === "error") {
    cuerpo = `<p class="aviso-error">No se pudo cargar la batalla. Revisa tu conexión e intenta otra vez.</p>
      <button class="boton" data-bat="reintentar">Reintentar</button>`;
  } else if (b.eleccion === null || b.inicio === null) {
    if (b.vista === "menu") {
      cuerpo = vistaMenu(b, b.datos.datos, rangos);
    } else {
      cuerpo = vistaLista(b, b.datos.datos);
      atras = "menu";
    }
  } else if (ahora() - b.inicio < b.duracion) {
    cuerpo = vistaAnimacion(b, b.datos.datos);
    atras = "menu";
  } else {
    cuerpo = vistaResultado(b, b.datos.datos, rangos);
    atras = "menu";
  }
  return `${botonAtras(`data-bat="${atras}"`)}<div class="batalla">${cuerpo}</div>`;
}

/** La casilla del modo suspenso; true si el cambio era suyo. Lo llama el `change` de `#comparar`. */
export function cambioBatalla(el: Element, repintar: () => void): boolean {
  if (!batalla || !(el instanceof HTMLInputElement) || el.dataset.batSuspenso === undefined) return false;
  batalla.suspenso = el.checked;
  guardarSuspenso(el.checked);
  repintar();
  return true;
}

/**
 * Un toque dentro de la batalla; true si era suyo. Lo llama el listener delegado de
 * `#comparar`, que también recibe los de la comparación.
 */
export function clicBatalla(el: HTMLElement, repintar: () => void, pedir: (nombre: string) => Promise<DatosBatalla>): boolean {
  if (!batalla) return false;
  const b = batalla;
  const d = el.dataset;
  if (d.batVista === "musculo" || d.batVista === "ejercicio") { b.vista = d.batVista; repintar(); window.scrollTo(0, 0); return true; }
  if (d.batMusculo !== undefined) { empezar({ modo: "musculo", musculo: d.batMusculo }, repintar); return true; }
  if (d.batEjercicio !== undefined) { empezar({ modo: "ejercicio", ejercicio: d.batEjercicio }, repintar); return true; }
  if (d.batDestapar !== undefined) {
    b.destapadas.add(d.batDestapar);
    const esta = d.batDestapar;
    b.recien = esta;
    // La vuelta se ve una vez: si un snapshot repinta después, ya no se repite.
    setTimeout(() => { if (b.recien === esta) b.recien = null; }, 700);
    repintar();
    return true;
  }
  if (d.bat === undefined) return false;
  if (d.bat === "todo") { empezar({ modo: "todo" }, repintar); return true; }
  if (d.bat === "destapar-todo" && b.eleccion && b.datos.estado === "listo") {
    ejerciciosDe(b.datos.datos, b.eleccion).forEach((_, i) => { b.destapadas.add(`${i}:a`); b.destapadas.add(`${i}:b`); });
    b.recien = null;
    repintar();
    return true;
  }
  if (d.bat === "otra" || d.bat === "menu") { alMenu(b); repintar(); window.scrollTo(0, 0); return true; }
  if (d.bat === "reintentar") { cargar(pedir, repintar); repintar(); return true; }
  if (d.bat === "cerrar") { reiniciarBatalla(); repintar(); window.scrollTo(0, 0); return true; }
  return false;
}
