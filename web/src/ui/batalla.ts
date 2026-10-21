import {
  ejerciciosDe, musculosEnComun, resolverBatalla, textoResultado, textoSerie,
  type DatosBatalla, type Eleccion, type EjercicioBatalla, type Lado,
} from "../batalla";
import { nombreMusculo } from "../fuerza";
import { botonAtras } from "./botonAtras";
import { escapar } from "./tarjetaDia";

/**
 * La ventana de Batalla, dentro de la comparación con alguien en Amigos (pedido del
 * entrenador, 2026-10-21): se elige por músculo, por ejercicio o todo, corre una animación de
 * unos 3 segundos y sale quién ganó, con la mejor serie y el 1RM estimado de las dos en cada
 * ejercicio. La cuenta está en `../batalla.ts`; los datos los trae `batallaAmigos`.
 *
 * El estado vive en el módulo, como en `comparar.ts`: `#contenido` se rehace en cada snapshot
 * de Firestore y no debe sacarla de la batalla ni reiniciar la animación.
 */

export const DURACION_ANIMACION = 3000;
/** Con movimiento reducido no hay pelea que ver: un instante y el resultado. */
const DURACION_QUIETA = 400;

export type DatosCargados =
  | { estado: "cargando" }
  | { estado: "listo"; datos: DatosBatalla }
  | { estado: "error" };

type Modo = Eleccion["modo"];

interface EstadoBatalla {
  rival: string;
  datos: DatosCargados;
  modo: Modo;
  eleccion: Eleccion | null;
  /** Cuándo empezó la animación (ms); null mientras elige. */
  inicio: number | null;
  duracion: number;
  /** El resultado ya se pintó una vez: su entrada no se repite en cada snapshot. */
  mostrado?: boolean;
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

/** Para los tests: abrir la batalla en un estado dado. */
export function ponerBatalla(e: Partial<EstadoBatalla> & { rival: string } | null): void {
  batalla = e === null ? null : { datos: { estado: "cargando" }, modo: "musculo", eleccion: null, inicio: null, duracion: DURACION_ANIMACION, ...e };
}

/** Si hay una batalla abierta con esa persona. */
export function batallaCon(rival: string): boolean {
  return batalla?.rival === rival;
}

export function abrirBatalla(rival: string, pedir: (nombre: string) => Promise<DatosBatalla>, repintar: () => void): void {
  reiniciarBatalla();
  batalla = { rival, datos: { estado: "cargando" }, modo: "musculo", eleccion: null, inicio: null, duracion: DURACION_ANIMACION };
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
  batalla.mostrado = false;
  batalla.duracion = sinMovimiento() ? DURACION_QUIETA : DURACION_ANIMACION;
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => { temporizador = null; repintar(); }, batalla.duracion + 20);
  repintar();
  window.scrollTo(0, 0);
}

/** El ícono del botón: dos espadas cruzadas, en el trazo de los íconos de la barra. */
export const ICONO_BATALLA = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="icono-batalla">
    <path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/>
    <path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>
  </svg>`;

function tituloEleccion(e: Eleccion, d: DatosBatalla): string {
  if (e.modo === "todo") return "Todo";
  if (e.modo === "musculo") return nombreMusculo(e.musculo);
  return d.ejercicios.find((x) => x.id === e.ejercicio)?.nombre ?? "Ejercicio";
}

function inicial(nombre: string): string {
  return escapar(Array.from(nombre.trim())[0]?.toUpperCase() ?? "?");
}

function vistaElegir(b: EstadoBatalla, d: DatosBatalla): string {
  const pestana = (m: Modo, texto: string) =>
    `<button class="bat-pestana${b.modo === m ? " activa" : ""}" data-bat-modo="${m}" aria-pressed="${b.modo === m}">${texto}</button>`;
  let opciones: string;
  if (d.ejercicios.length === 0) {
    opciones = `<p class="accion-nota bat-vacio">Todavía no tienen ningún ejercicio en común. Cuando las dos registren el mismo, ya podrán batallar.</p>`;
  } else if (b.modo === "musculo") {
    opciones = `<div class="bat-opciones">${musculosEnComun(d).map(({ musculo, ejercicios }) => `
        <button class="bat-opcion" data-bat-musculo="${musculo}">
          <span class="bat-opcion-nombre">${escapar(nombreMusculo(musculo))}</span>
          <span class="bat-opcion-nota">${ejercicios === 1 ? "1 ejercicio" : `${ejercicios} ejercicios`}</span>
        </button>`).join("")}</div>`;
  } else if (b.modo === "ejercicio") {
    opciones = `<div class="bat-lista">${d.ejercicios.map((e) => `
        <button class="bat-opcion fila" data-bat-ejercicio="${escapar(e.id)}">
          <span class="bat-opcion-nombre">${escapar(e.nombre)}</span>
          <span class="bat-opcion-flecha" aria-hidden="true">›</span>
        </button>`).join("")}</div>`;
  } else {
    const n = d.ejercicios.length;
    opciones = `
      <div class="tarjeta bat-todo">
        <p class="accion-nota">Se comparan ${n === 1 ? "el ejercicio que tienen" : `los ${n} ejercicios que tienen`} en común. Gana quien gane más.</p>
        <button class="boton" data-bat="todo">¡A pelear!</button>
      </div>`;
  }
  return `
    <p class="confirmar-titulo bat-titulo">Batalla</p>
    <div class="bat-duelo" aria-label="Tú contra ${escapar(d.b.nombre)}">
      <span class="bat-chico a">${inicial(d.a.nombre)}</span>
      <span class="bat-duelo-nombre">Tú</span>
      <span class="bat-duelo-vs">${ICONO_BATALLA}</span>
      <span class="bat-duelo-nombre">${escapar(d.b.nombre)}</span>
      <span class="bat-chico b">${inicial(d.b.nombre)}</span>
    </div>
    <div class="bat-pestanas" role="group" aria-label="Comparar por">
      ${pestana("musculo", "Por músculo")}${pestana("ejercicio", "Por ejercicio")}${pestana("todo", "Todo")}
    </div>
    ${opciones}
    <p class="accion-nota bat-regla">Se compara la mejor serie de cada quien en todo su historial. Gana quien levanta más en proporción a su peso corporal.</p>`;
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

function celda(e: EjercicioBatalla, lado: Lado, gana: Lado | null): string {
  const m = e[lado];
  const rm = m.unoRm !== null ? `<span class="bat-rm">1RM ≈ ${m.unoRm} kg</span>` : "";
  return `
    <div class="bat-celda${gana === lado ? " gana" : ""}">
      <span class="bat-serie">${escapar(textoSerie(e, m))}</span>
      ${rm}
      ${gana === lado ? `<span class="bat-gana">Gana</span>` : ""}
    </div>`;
}

function vistaResultado(b: EstadoBatalla, d: DatosBatalla): string {
  const r = resolverBatalla(ejerciciosDe(d, b.eleccion!));
  const { titulo, detalle } = textoResultado(r, d);
  const filas = r.filas.map(({ ejercicio: e, gana }) => `
    <div class="bat-fila">
      <p class="bat-fila-nombre">${escapar(e.nombre)}${e.pesoPorMancuerna ? ` <span class="bat-fila-nota">por mancuerna</span>` : ""}${gana === null ? ` <span class="bat-empate">Empate</span>` : ""}</p>
      <div class="bat-celdas">${celda(e, "a", gana)}${celda(e, "b", gana)}</div>
    </div>`).join("");
  const clase = `${r.ganador === null ? "empate" : r.ganador}${b.mostrado ? "" : " entrando"}`;
  b.mostrado = true;
  return `
    <div class="tarjeta bat-resultado ${clase}">
      <p class="bat-resultado-tema">${escapar(tituloEleccion(b.eleccion!, d))}</p>
      <p class="bat-resultado-titulo">${escapar(titulo)}</p>
      <div class="bat-marcador">
        <span class="bat-marcador-lado a${r.ganador === "a" ? " gana" : ""}"><span>Tú</span><strong>${r.victorias.a}</strong></span>
        <span class="bat-marcador-guion" aria-hidden="true">–</span>
        <span class="bat-marcador-lado b${r.ganador === "b" ? " gana" : ""}"><strong>${r.victorias.b}</strong><span>${escapar(d.b.nombre)}</span></span>
      </div>
      <p class="bat-resultado-detalle">${escapar(detalle)}</p>
    </div>
    <div class="tarjeta bat-tabla">
      <div class="bat-celdas bat-encabezado" aria-hidden="true"><span>Tú</span><span>${escapar(d.b.nombre)}</span></div>
      ${filas}
    </div>
    <button class="boton" data-bat="otra">Otra batalla</button>
    <p class="accion-nota bat-regla">Gana cada ejercicio quien levanta más en proporción a su peso corporal, con su mejor serie de todo su historial.</p>`;
}

/** Lo que va dentro de `#comparar` con la batalla abierta. */
export function vistaBatalla(): string {
  const b = batalla;
  if (!b) return "";
  let cuerpo: string;
  if (b.datos.estado === "cargando") {
    cuerpo = `<p class="accion-nota" style="text-align:center">Preparando la batalla…</p>`;
  } else if (b.datos.estado === "error") {
    cuerpo = `<p class="aviso-error">No se pudo cargar la batalla. Revisa tu conexión e intenta otra vez.</p>
      <button class="boton" data-bat="reintentar">Reintentar</button>`;
  } else if (b.eleccion === null || b.inicio === null) {
    cuerpo = vistaElegir(b, b.datos.datos);
  } else if (ahora() - b.inicio < b.duracion) {
    cuerpo = vistaAnimacion(b, b.datos.datos);
  } else {
    cuerpo = vistaResultado(b, b.datos.datos);
  }
  return `${botonAtras(`data-bat="cerrar"`)}<div class="batalla">${cuerpo}</div>`;
}

/**
 * Un toque dentro de la batalla; true si era suyo. Lo llama el listener delegado de
 * `#comparar`, que también recibe los de la comparación.
 */
export function clicBatalla(el: HTMLElement, repintar: () => void, pedir: (nombre: string) => Promise<DatosBatalla>): boolean {
  if (!batalla) return false;
  const d = el.dataset;
  if (d.batModo !== undefined) {
    if (d.batModo === "musculo" || d.batModo === "ejercicio" || d.batModo === "todo") batalla.modo = d.batModo;
    repintar();
    return true;
  }
  if (d.batMusculo !== undefined) { empezar({ modo: "musculo", musculo: d.batMusculo }, repintar); return true; }
  if (d.batEjercicio !== undefined) { empezar({ modo: "ejercicio", ejercicio: d.batEjercicio }, repintar); return true; }
  if (d.bat === undefined) return false;
  if (d.bat === "todo") { empezar({ modo: "todo" }, repintar); return true; }
  if (d.bat === "otra") { batalla.eleccion = null; batalla.inicio = null; repintar(); window.scrollTo(0, 0); return true; }
  if (d.bat === "reintentar") { cargar(pedir, repintar); repintar(); return true; }
  if (d.bat === "cerrar") { reiniciarBatalla(); repintar(); window.scrollTo(0, 0); return true; }
  return false;
}
