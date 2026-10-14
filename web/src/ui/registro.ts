import type { ConfigGrupos, Ejercicio, EjercicioBanco, Sesion } from "../datos";
import { claveBanco, urlGif, urlVideo, type IndiceBanco } from "../banco";
import { seccionesRegistro } from "../grupos";
import {
  agregarEjercicio,
  agregarSerie,
  borradorDeSesion,
  borradorGuiado,
  cambiarSerie,
  cambiarUnidad,
  idNuevo,
  leerBorrador,
  nombresDeSesion,
  nuevoBorrador,
  paraEnviar,
  quitarEjercicio,
  quitarSerie,
  repsDudosas,
  resumenSemana,
  resumenSeries,
  ultimasSeries,
  type Borrador,
  type EjercicioBorrador,
  type Envio,
  type SerieBorrador,
} from "../registro";
import { rechazoDefinitivo } from "../cola";
import { escapar } from "./tarjetaDia";
import { aterrizar, despegar } from "./vueloRegistro";
import { conectarDeslizar } from "./deslizarRegistro";

/**
 * La ventana Registro: la clienta anota lo que entrenó con su coach en el gym, por
 * **entrenamientos** (decisión del entrenador, 2026-10-10): toca "Iniciar entrenamiento", va
 * agregando ejercicios y al final "Terminar entrenamiento". Cada entrenamiento queda en su
 * historial con su fecha, la hora en que empezó y en que terminó.
 *
 * Vistas dentro de la misma ventana:
 *  - **inicio**: su semana (días que vino, entrenamientos, tiempo y series), el botón
 *    "Iniciar entrenamiento" con el día que le toca, y sus entrenamientos recientes.
 *  - **capturar**: el entrenamiento en curso. Un ejercicio a la vez en grande (GIF, series de
 *    peso y reps, "+ Serie", Anterior/Siguiente); los anteriores comprimidos arriba y los
 *    siguientes abajo, y al tocar uno su GIF vuela y crece hasta el lugar del activo.
 *    Mientras hay un entrenamiento abierto, Registro se abre aquí.
 *  - **elegir**: un grid con nombre y GIF, agrupado: primero los grupos que le tocan hoy según
 *    el nombre del día ("Pecho, hombro y tríceps" → Pecho, Hombro, Tríceps), con los
 *    ejercicios que el entrenador configuró para cada uno; luego los demás grupos. Lo que ya
 *    está en el entrenamiento sale en gris y no se puede volver a elegir.
 *  - **historial**: sus entrenamientos guardados, del más nuevo al más viejo. Cada uno se
 *    puede corregir ("Editar": se abre en la misma pantalla de captura con `borradorDeSesion`
 *    y al guardar va a `editarSesion`, que le respeta fecha y horas) o borrar ("Eliminar").
 *
 * Los GIF van aquí y no en la tarjeta de Inicio (decisión del entrenador, 2026-10-10): sirven
 * para reconocer qué ejercicio hizo, no para leer la rutina.
 *
 * El estado vive en el módulo y no en `main.ts`, como en `accionFalta.ts`: un snapshot que
 * repinta a destiempo no debe sacarla de la vista donde estaba. El entrenamiento en curso además
 * se guarda en el navegador en cada cambio, para que cerrar la pestaña o quedarse sin señal no
 * le borre lo que lleva anotado.
 */

export interface DatosRegistro {
  hoy: string;
  /** El día que le toca hoy según su rutina, o null (fin de semana, descanso, sin rutina). */
  dia: { nombreDia: string; ejercicios: Ejercicio[] } | null;
  banco: readonly EjercicioBanco[];
  indice: IndiceBanco;
  /** null mientras no llegan. */
  sesiones: Sesion[] | null;
  /** Los ejercicios que el entrenador puso en cada grupo; null si no ha configurado ninguno. */
  config: ConfigGrupos | null;
  /** Entrenamientos terminados sin internet que esperan a mandarse (`cola.ts`). */
  pendientes?: number;
}

type Vista = "inicio" | "historial" | "elegir" | "capturar";

interface Estado {
  vista: Vista;
  borrador: Borrador | null;
  enVuelo: boolean;
  error: string | null;
  /** Se acaba de terminar uno: "enviado" llegó al servidor; "en-telefono", se guardó sin internet. */
  guardado: false | "enviado" | "en-telefono";
  /** El ejercicio recién agregado, para llevarle la vista al pintar. */
  enfocar: number | null;
  /** El GIF que va volando del grid a su tarjeta (ver `vueloRegistro.ts`); null si no hay. */
  vuelo: HTMLElement | null;
  /**
   * El ejercicio abierto en grande en el entrenamiento; los demás van comprimidos arriba y
   * abajo. null = el último agregado.
   */
  activo: number | null;
  /** Mensaje de que algo salió bien en el historial ("Cambios guardados"); null si no hay. */
  aviso: string | null;
  /** El id del entrenamiento que se está borrando, para deshabilitar sus botones. */
  borrando: string | null;
  /** Hacia dónde se movió la última vez: la tarjeta entra desde abajo al avanzar, desde arriba al volver. */
  avanzando: boolean;
  /** El último cambio fue deslizando de lado: la tarjeta nueva entra de lado y no de abajo. */
  lateral: boolean;
}

const LLAVE_BORRADOR = "osfit:registro-borrador";

const estado: Estado = {
  vista: "inicio",
  borrador: (() => {
    try { return leerBorrador(localStorage.getItem(LLAVE_BORRADOR)); } catch { return null; }
  })(),
  enVuelo: false,
  error: null,
  guardado: false,
  enfocar: null,
  vuelo: null,
  activo: null,
  aviso: null,
  borrando: null,
  avanzando: true,
  lateral: false,
};

/** Solo para los tests: poner la ventana en una vista y con un borrador dados. */
export function ponerEstadoRegistro(parcial: Partial<Pick<Estado, "vista" | "borrador" | "error" | "activo">>): void {
  Object.assign(estado, { guardado: false, enVuelo: false, error: null, activo: null, aviso: null, borrando: null }, parcial);
}

/**
 * Qué hay abierto en Registro, para el botón de la tarjeta del día: "nuevo" es un
 * entrenamiento en curso (se continúa), "edicion" la corrección de uno pasado.
 */
export function entrenamientoAbierto(): "nuevo" | "edicion" | null {
  const b = estado.borrador;
  return !b ? null : b.edicion ? "edicion" : "nuevo";
}

/**
 * "▶ Empezar" en la tarjeta del día (backlog 2, punto 7): abre la misma pantalla de captura
 * de Registro con los ejercicios que le recomienda su rutina ya cargados, el primero en grande.
 * Con un entrenamiento ya abierto no arma otro: la deja en el que lleva. Devuelve si empezó
 * uno nuevo, para que quien la llama marque la asistencia como con "Iniciar entrenamiento".
 */
export function empezarGuiado(d: DatosRegistro, ahora = Date.now()): boolean {
  estado.guardado = false;
  estado.error = null;
  estado.aviso = null;
  if (estado.borrador) {
    estado.vista = "capturar";
    return false;
  }
  if (!d.dia) return false;
  guardarBorrador(borradorGuiado(idNuevo(), d.hoy, ahora, d.dia, d.indice, d.sesiones ?? []));
  estado.vista = "capturar";
  estado.activo = 0;
  estado.avanzando = true;
  estado.lateral = false;
  return true;
}

function guardarBorrador(b: Borrador | null): void {
  estado.borrador = b;
  try {
    if (b) localStorage.setItem(LLAVE_BORRADOR, JSON.stringify(b));
    else localStorage.removeItem(LLAVE_BORRADOR);
  } catch { /* sin almacenamiento se pierde el respaldo, no el registro en curso */ }
}

function enPalabras(fecha: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
  }).format(new Date(`${fecha}T12:00:00Z`));
}

function hora(t: { toDate(): Date } | null | undefined): string | null {
  if (!t) return null;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mazatlan", hour: "numeric", minute: "2-digit",
  }).format(t.toDate());
}

function horaDeMs(ms: number | undefined): string | null {
  return ms === undefined ? null : hora({ toDate: () => new Date(ms) });
}

function gif(ruta: string | null | undefined, clase: string, lado: number): string {
  const url = urlGif(ruta);
  // `alt` vacío: el nombre va justo al lado y un lector de pantalla lo diría dos veces.
  return url
    ? `<img class="${clase}" src="${escapar(url)}" alt="" width="${lado}" height="${lado}" loading="lazy" decoding="async">`
    : `<span class="${clase} registro-sin-gif" aria-hidden="true">🏋️</span>`;
}

/** Los términos del dataset piden el crédito junto a las animaciones, donde se muestren. */
const CREDITO = `<p class="registro-credito">Animaciones © Gym visual</p>`;

/**
 * El aviso cuando escribe muchas reps (backlog 2, punto 15.4), con las palabras del
 * entrenador. Va en `body` y no dentro de `#registro`: no se repinta con la ventana.
 */
export function avisoReps(reps: number): string {
  return `
    <div class="reps-velo" id="reps-velo">
      <div class="reps-aviso tarjeta" role="alertdialog" aria-modal="true" aria-labelledby="reps-titulo">
        <p class="reps-titulo" id="reps-titulo">¿Estás seguro que hiciste ${reps} reps?</p>
        <p class="reps-texto">No es que desconfíe de ti o algo, pero son muchas.</p>
        <button type="button" class="boton secundario" data-reps="corregir">No, me equivoqué</button>
        <button type="button" class="boton" data-reps="seguir">Sí, continuar</button>
      </div>
    </div>`;
}

/** Las reps que ya confirmó ("ej:serie:reps"), para no volver a preguntar por las mismas. */
const repsConfirmadas = new Set<string>();

// ── Inicio e historial ───────────────────────────────────────────────────────

function textoSerie(s: { reps: number; peso: number | null }, tipo: "tiempo" | "otro"): string {
  if (tipo === "tiempo") return `${s.reps} s`;
  return s.peso === null ? `× ${s.reps}` : `${s.peso} kg × ${s.reps}`;
}

/** "10:32 a. m. – 11:20 a. m. · 48 min", o solo la hora de fin si no se sabe cuándo empezó. */
function horario(s: Sesion): string {
  const fin = hora(s.creada);
  const inicio = hora(s.iniciada);
  if (!fin) return "";
  if (!inicio || !s.iniciada || !s.creada) return `Terminado a las ${fin}`;
  const minutos = Math.round((s.creada.toDate().getTime() - s.iniciada.toDate().getTime()) / 60_000);
  return `${inicio} – ${fin}${minutos > 0 ? ` · ${minutos} min` : ""}`;
}

function tarjetaSesion(s: Sesion, banco: readonly EjercicioBanco[]): string {
  const filas = s.ejercicios.map((e) => {
    const tipo = banco.find((x) => x.id === e.ejercicioId)?.tipo === "tiempo" ? "tiempo" : "otro";
    return `
      <li class="registro-hist-ej">
        <span class="registro-hist-nombre">${escapar(e.nombre)}</span>
        <span class="registro-hist-series">${e.series.map((x) => escapar(textoSerie(x, tipo))).join(" · ")}</span>
      </li>`;
  }).join("");
  const cuando = horario(s);
  const cuantos = s.ejercicios.length === 1 ? "1 ejercicio" : `${s.ejercicios.length} ejercicios`;
  const off = estado.borrando === s.id ? "disabled" : "";
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">${escapar(enPalabras(s.fecha))}</p>
      <p class="registro-hist-horario">${escapar(cuando ? `${cuando} · ${cuantos}` : cuantos)}</p>
      <ul class="registro-hist">${filas}</ul>
      <div class="registro-hist-acciones">
        <button class="registro-hist-accion" data-editar="${escapar(s.id)}" ${off}>Editar</button>
        <button class="registro-hist-accion peligro" data-borrar="${escapar(s.id)}" ${off}>${estado.borrando === s.id ? "Eliminando…" : "Eliminar"}</button>
      </div>
    </div>`;
}

/** "1 h 41", "52 min". */
function duracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const resto = minutos % 60;
  return `${Math.floor(minutos / 60)} h${resto ? ` ${String(resto).padStart(2, "0")}` : ""}`;
}

const DIA_CORTO = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

/** Una fila de "Recientes": toda la fila lleva al historial, que es donde se ven las series. */
function filaReciente(s: Sesion): string {
  const fecha = new Date(`${s.fecha}T12:00:00Z`);
  const series = s.ejercicios.reduce((n, e) => n + e.series.length, 0);
  const cuando = horario(s);
  const detalle = [cuando, series === 1 ? "1 serie" : `${series} series`].filter(Boolean).join(" · ");
  return `
    <button class="tarjeta registro-reciente" data-accion="historial">
      <span class="registro-reciente-fecha" aria-hidden="true">
        <span>${DIA_CORTO[fecha.getUTCDay()]}</span>
        <strong>${fecha.getUTCDate()}</strong>
      </span>
      <span class="registro-reciente-texto">
        <span class="registro-reciente-titulo">${escapar(nombresDeSesion(s))}</span>
        <span class="registro-reciente-detalle"><span class="sr-solo">${escapar(enPalabras(s.fecha))} · </span>${escapar(detalle)}</span>
      </span>
      <span class="registro-reciente-flecha" aria-hidden="true">›</span>
    </button>`;
}

/**
 * Inicio de Registro: su semana (los días que vino, cuántos entrenamientos, tiempo y series),
 * el botón para empezar y sus entrenamientos recientes. Todo sale de lo que ella anotó; de la
 * rutina solo se toma el nombre del día que le toca, para el botón.
 */
/**
 * Los entrenamientos que se buscan por semana: el "2 / 5" del resumen. El mismo para todas,
 * tenga su rutina los días que tenga (decisión del entrenador, 2026-10-14).
 */
const OBJETIVO_SEMANAL = 5;

function vistaInicio(d: DatosRegistro): string {
  const n = d.pendientes ?? 0;
  // Guardado sin internet y ya se mandó (la cola quedó vacía): es un guardado normal.
  const aviso = estado.guardado === "en-telefono" && n > 0
    ? `<p class="aviso-ok">¡Entrenamiento guardado en tu teléfono! 📱 Se enviará solo en cuanto tengas internet.</p>`
    : estado.guardado ? `<p class="aviso-ok">¡Entrenamiento guardado! 💪</p>`
    : n > 0 ? `<p class="registro-pendientes">📤 ${n === 1 ? "1 entrenamiento espera" : `${n} entrenamientos esperan`} internet para enviarse.</p>`
    : "";
  const sesiones = d.sesiones ?? [];
  const semana = resumenSemana(sesiones, d.hoy);

  const dias = semana.dias.map((x) => {
    const clase = x.entreno ? " hecho" : x.esHoy ? " es-hoy" : "";
    const estadoDia = x.entreno ? "entrenaste" : x.esHoy ? "hoy" : "sin entrenamiento";
    return `
      <li class="registro-semana-dia">
        <span class="registro-semana-letra" aria-hidden="true">${x.letra}</span>
        <span class="registro-semana-num${clase}" aria-label="${escapar(`${enPalabras(x.fecha)}, ${estadoDia}`)}">${x.numero}</span>
      </li>`;
  }).join("");

  const meta = `<span class="registro-dato-de"> / ${OBJETIVO_SEMANAL}</span>`;
  const datos = `
    <div class="registro-datos">
      <div class="registro-dato"><strong>${semana.entrenamientos}${meta}</strong><span>entrenamientos</span></div>
      <div class="registro-dato"><strong>${semana.minutos === null ? "—" : duracion(semana.minutos)}</strong><span>entrenando</span></div>
      <div class="registro-dato"><strong>${semana.series}</strong><span>series</span></div>
    </div>`;

  const nombreDia = d.dia?.nombreDia.trim();
  const boton = `<button class="boton registro-boton-iniciar" data-accion="iniciar">▶ Iniciar entrenamiento${nombreDia ? ` · ${escapar(nombreDia)}` : ""}</button>`;

  const recientes = d.sesiones === null
    ? `<p class="accion-nota" style="text-align:center">Cargando tu historial…</p>`
    : sesiones.length === 0
      ? `<p class="accion-nota" style="text-align:center">Aquí se van a ir guardando tus entrenamientos.</p>`
      : `
        <div class="registro-recientes-cabecera">
          <p class="registro-recientes-titulo">Recientes</p>
          <button class="boton-texto" data-accion="historial">Ver todo · ${sesiones.length === 1 ? "1 entrenamiento" : `${sesiones.length} entrenamientos`}</button>
        </div>
        ${sesiones.slice(0, 3).map(filaReciente).join("")}`;

  return `
    ${aviso}
    <p class="confirmar-titulo registro-semana-titulo">Tu semana</p>
    <div class="tarjeta registro-semana">
      <ol class="registro-semana-dias">${dias}</ol>
      ${datos}
    </div>
    ${boton}
    ${recientes}`;
}

function vistaHistorial(d: DatosRegistro): string {
  const lista = d.sesiones === null
    ? `<p class="accion-nota" style="text-align:center">Cargando tu historial…</p>`
    : d.sesiones.length === 0
      ? `<p class="accion-nota" style="text-align:center">Todavía no tienes entrenamientos guardados.</p>`
      : d.sesiones.map((s) => tarjetaSesion(s, d.banco)).join("");
  const aviso = estado.aviso ? `<p class="aviso-ok">${escapar(estado.aviso)}</p>` : "";
  const error = estado.error ? `<p class="aviso-error" style="margin:0 0 12px">${escapar(estado.error)}</p>` : "";
  return `
    <button class="boton-texto registro-volver" data-accion="volver">← Volver</button>
    <p class="confirmar-titulo" style="margin-bottom:12px">Tu historial</p>
    ${aviso}${error}
    ${lista}`;
}

// ── Elegir ───────────────────────────────────────────────────────────────────

/**
 * Una tarjeta del grid. Lo que ya está en el entrenamiento sale en gris y deshabilitado: ya lo
 * eligió, y sus series se capturan en la pantalla del entrenamiento.
 */
function opcion(e: EjercicioBanco): string {
  const ya = estado.borrador?.ejercicios.some((x) => x.ejercicioId === e.id) ?? false;
  return `
    <button class="registro-opcion${ya ? " agregado" : ""}" data-agregar="${escapar(e.id)}"
            ${ya ? `disabled aria-label="${escapar(e.nombre)}, ya está en tu entrenamiento"` : ""}>
      ${gif(e.gifRuta, "registro-opcion-gif", 160)}
      <span class="registro-opcion-nombre">${escapar(e.nombre)}</span>
      ${ya ? `<span class="registro-opcion-ya">✓ Ya en tu entrenamiento</span>` : ""}
    </button>`;
}

function vistaElegir(d: DatosRegistro): string {
  if (d.banco.length === 0) {
    return `
      <button class="boton-texto registro-volver" data-accion="volver">← Volver</button>
      <p class="accion-nota">Cargando ejercicios…</p>`;
  }
  const secciones = seccionesRegistro(d.dia?.nombreDia ?? null, d.banco, d.config);
  const hayDelDia = secciones.some((x) => x.delDia);
  let separado = false;
  const cuerpo = secciones.map((x) => {
    // Un rótulo entre lo de hoy y lo demás, para que se note dónde termina su día.
    let antes = "";
    if (hayDelDia && !x.delDia && !separado) {
      separado = true;
      antes = `<p class="registro-separador">Más ejercicios</p>`;
    }
    return `${antes}
      <p class="registro-grupo${x.delDia ? " del-dia" : ""}">${escapar(x.titulo)}</p>
      <div class="registro-grid">${x.ejercicios.map(opcion).join("")}</div>`;
  }).join("");
  const hoy = d.dia && hayDelDia
    ? `<p class="accion-nota" style="margin:2px 2px 0">Hoy te toca ${escapar(d.dia.nombreDia.trim())}</p>`
    : "";
  return `
    <button class="boton-texto registro-volver" data-accion="volver">← Volver</button>
    <p class="confirmar-titulo">¿Qué ejercicio hiciste?</p>
    ${hoy}
    ${cuerpo}
    ${CREDITO}`;
}

// ── Capturar ─────────────────────────────────────────────────────────────────

function filaSerie(e: EjercicioBorrador, i: number, s: SerieBorrador, j: number): string {
  const reps = `
    <label class="registro-campo">
      <input inputmode="numeric" data-ej="${i}" data-serie="${j}" data-campo="reps"
             value="${escapar(s.reps)}" placeholder="0" aria-label="Serie ${j + 1}, ${e.tipo === "tiempo" ? "segundos" : "repeticiones"}">
      <span>${e.tipo === "tiempo" ? "seg" : "reps"}</span>
    </label>`;
  const enBarras = e.unidad === "barras";
  const peso = e.tipo === "tiempo" ? "" : `
    <label class="registro-campo">
      <input inputmode="decimal" data-ej="${i}" data-serie="${j}" data-campo="peso"
             value="${escapar(s.peso)}" placeholder="${e.tipo === "corporal" ? "+0" : "0"}" aria-label="Serie ${j + 1}, ${enBarras ? "barras" : "kilos"}">
      <span>${enBarras ? "barras" : "kg"}</span>
    </label>
    <span class="registro-por" aria-hidden="true">×</span>`;
  return `
    <div class="registro-serie">
      <span class="registro-serie-num">${j + 1}</span>
      ${peso}${reps}
      <button class="registro-quitar" data-quitar-serie="${i}:${j}" aria-label="Quitar serie ${j + 1}">✕</button>
    </div>`;
}

/** El índice del ejercicio abierto en grande, dentro de rango. */
function indiceActivo(b: Borrador): number {
  const ultimo = b.ejercicios.length - 1;
  return Math.min(Math.max(estado.activo ?? ultimo, 0), ultimo);
}

/**
 * Lo que se ve en grande: el video en bucle si el ejercicio lo tiene, si no el GIF. Mudo,
 * en bucle, en línea y solo: así lo deja reproducir iOS sin que la clienta toque nada. El
 * GIF va de póster para que no haya un hueco mientras el video carga.
 *
 * Las rutas se toman del banco vivo y no de la copia del borrador: un video subido con el
 * entrenamiento ya abierto aparece sin tener que empezar otro.
 */
function medioGrande(e: EjercicioBorrador, delBanco: EjercicioBanco | undefined): string {
  const gifRuta = delBanco?.gifRuta ?? e.gifRuta;
  const video = urlVideo(delBanco?.videoRuta);
  if (!video) return gif(gifRuta, "registro-ej-gif", 180);
  const poster = urlGif(gifRuta);
  return `<video class="registro-ej-gif registro-ej-video" src="${escapar(video)}"
      ${poster ? `poster="${escapar(poster)}"` : ""} width="260" height="260"
      autoplay muted loop playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video>`;
}

/**
 * El ejercicio activo, en grande: el GIF a lo ancho, sus series y cómo moverse al anterior o
 * al siguiente. Es el único con campos: los demás solo muestran su resumen.
 */
function tarjetaActiva(e: EjercicioBorrador, i: number, total: number, delBanco?: EjercicioBanco): string {
  // Los estándares de fuerza de mancuernas cuentan una sola (`docs/estandares-fuerza/`).
  const enBarras = e.unidad === "barras";
  const nota = e.tipo === "corporal"
    ? `<p class="accion-nota">Con tu peso corporal. En kg, solo si agregaste peso extra.</p>`
    : enBarras
      ? `<p class="accion-nota">Cuántas barras de la máquina pusiste.</p>`
      : delBanco?.pesoPorMancuerna
        ? `<p class="accion-nota">En kg, el peso de una mancuerna.</p>`
        : "";
  // Barras o kg, solo en los de peso. Las máquinas de placas abren en barras (`barras.ts`).
  const unidad = e.tipo !== "peso" ? "" : `
      <div class="registro-unidad" role="group" aria-label="Unidad del peso">
        <button data-unidad="${i}:barras" aria-pressed="${enBarras}" class="${enBarras ? "activa" : ""}">Barras</button>
        <button data-unidad="${i}:kg" aria-pressed="${!enBarras}" class="${enBarras ? "" : "activa"}">Kg</button>
      </div>`;
  const nav = total > 1 ? `
      <div class="registro-nav">
        <button class="registro-nav-boton" data-activar="${i - 1}" ${i === 0 ? "disabled" : ""}>‹ Anterior</button>
        <span class="registro-nav-cuenta">${i + 1} de ${total}<span class="registro-nav-pista">desliza ‹ ›</span></span>
        <button class="registro-nav-boton" data-activar="${i + 1}" ${i === total - 1 ? "disabled" : ""}>Siguiente ›</button>
      </div>` : "";
  return `
    <div class="tarjeta registro-ejercicio activo" data-indice="${i}">
      <div class="registro-activo-gif">
        ${medioGrande(e, delBanco)}
        <button class="registro-quitar registro-quitar-ej" data-quitar-ej="${i}" aria-label="Quitar ${escapar(e.nombre)}">✕</button>
      </div>
      <p class="registro-activo-nombre">${escapar(e.nombre)}</p>
      ${e.objetivo ? `<p class="registro-objetivo">Tu rutina: ${escapar(e.objetivo)}</p>` : ""}
      ${unidad}
      ${nota}
      ${e.series.map((s, j) => filaSerie(e, i, s, j)).join("")}
      <button class="registro-mas-serie" data-agregar-serie="${i}">+ Serie</button>
      ${nav}
    </div>`;
}

/** Un ejercicio que no es el activo: una fila delgada que al tocarse se abre en grande. */
function filaCompacta(e: EjercicioBorrador, i: number): string {
  return `
    <button class="registro-compacto" data-activar="${i}" aria-label="Abrir ${escapar(e.nombre)}">
      ${gif(e.gifRuta, "registro-compacto-gif", 44)}
      <span class="registro-compacto-texto">
        <span class="registro-compacto-nombre">${escapar(e.nombre)}</span>
        <span class="registro-compacto-resumen">${escapar(resumenSeries(e))}</span>
      </span>
      <span class="registro-compacto-flecha" aria-hidden="true">›</span>
    </button>`;
}

/** Arriba los anteriores comprimidos, en medio el activo en grande, abajo los siguientes. */
function ejerciciosDelEntrenamiento(b: Borrador, banco: readonly EjercicioBanco[]): string {
  const a = indiceActivo(b);
  const arriba = b.ejercicios.slice(0, a).map((e, i) => filaCompacta(e, i)).join("");
  const abajo = b.ejercicios.slice(a + 1).map((e, k) => filaCompacta(e, a + 1 + k)).join("");
  return `
    ${arriba ? `<div class="registro-compactos">${arriba}</div>` : ""}
    ${tarjetaActiva(b.ejercicios[a], a, b.ejercicios.length, banco.find((x) => x.id === b.ejercicios[a].ejercicioId))}
    ${abajo ? `<div class="registro-compactos">${abajo}</div>` : ""}`;
}

function vistaCapturar(d: DatosRegistro): string {
  const b = estado.borrador;
  if (!b) return "";
  const error = estado.error ? `<p class="aviso-error" style="margin:0 0 12px">${escapar(estado.error)}</p>` : "";
  const hay = b.ejercicios.length > 0;
  const vacio = hay ? "" : `
    <div class="tarjeta vacio">
      <p><strong>Agrega tu primer ejercicio</strong></p>
      <p style="color: var(--texto-tenue); font-size: 14px">Elige el que te puso tu coach y anota tus series.</p>
    </div>`;
  // Los de su rutina que no están en el banco no se pueden guardar: se le dice cuáles, para
  // que elija el más parecido del grid si quiere anotarlos.
  const faltan = b.guiado?.sinLigar ?? [];
  const sinLigar = faltan.length === 0 ? "" : `
    <p class="accion-nota registro-sin-ligar">${faltan.length === 1 ? "Este ejercicio de tu rutina no está" : "Estos ejercicios de tu rutina no están"} en la lista: ${escapar(faltan.join(", "))}. Si los haces, agrega el más parecido con "+ Agregar ejercicio".</p>`;
  const off = estado.enVuelo ? "disabled" : "";
  return `
    ${hay ? ejerciciosDelEntrenamiento(b, d.banco) : ""}
    ${vacio}
    ${sinLigar}
    ${error}
    <button class="boton${hay ? " secundario" : ""}" data-accion="agregar" ${off}>+ Agregar ejercicio</button>
    ${hay ? `<button class="boton" data-accion="guardar" ${off}>${estado.enVuelo ? "Guardando…" : b.edicion ? "Guardar cambios" : "Terminar entrenamiento"}</button>` : ""}
    ${hay ? CREDITO : ""}
    <button class="boton-texto registro-eliminar" data-accion="descartar" ${off}>${b.edicion ? "Cancelar cambios" : "Eliminar entrenamiento"}</button>`;
}

/**
 * Lo que va en la cabecera, junto al ☰, con un entrenamiento abierto: "Entrenamiento en curso"
 * y desde cuándo. Arriba y no dentro del contenido, a pedido del entrenador (2026-10-10): así
 * el espacio de abajo es del ejercicio. Null en las demás vistas: la cabecera queda vacía.
 * Se llama después de `ventanaRegistro`, que es la que decide en qué vista se queda.
 */
export function cabeceraRegistro(): { titulo: string; detalle: string } | null {
  const b = estado.borrador;
  if (estado.vista !== "capturar" || !b) return null;
  if (b.edicion) return { titulo: "Editando entrenamiento", detalle: enPalabras(b.fecha) };
  const desde = horaDeMs(b.iniciado);
  return {
    titulo: b.guiado?.nombreDia ? `Entrenando · ${b.guiado.nombreDia}` : "Entrenamiento en curso",
    detalle: `${enPalabras(b.fecha)}${desde ? ` · desde las ${desde}` : ""}`,
  };
}

/** Lo que va en `#contenido` con Registro abierto. */
export function ventanaRegistro(d: DatosRegistro): string {
  // Con un entrenamiento abierto, Registro se abre en él; sin uno, no hay qué capturar ni elegir.
  if (estado.vista === "inicio" && estado.borrador) estado.vista = "capturar";
  if ((estado.vista === "capturar" || estado.vista === "elegir") && !estado.borrador) estado.vista = "inicio";
  const cuerpo = estado.vista === "elegir" ? vistaElegir(d)
    : estado.vista === "capturar" ? vistaCapturar(d)
    : estado.vista === "historial" ? vistaHistorial(d)
    : vistaInicio(d);
  return `<div id="registro" class="registro">${cuerpo}</div>`;
}

// ── Conectar ─────────────────────────────────────────────────────────────────

function seriesDeLaRutina(d: DatosRegistro, e: EjercicioBanco): number | null {
  const enRutina = d.dia?.ejercicios.find((x) => d.indice.get(claveBanco(x.nombre))?.id === e.id);
  return enRutina && enRutina.series > 0 ? enRutina.series : null;
}

export interface AccionesRegistro {
  /** Guarda un entrenamiento nuevo (`registrarSesion`). */
  guardar: (envio: Envio) => Promise<unknown>;
  /** Guarda la corrección de uno ya guardado (`editarSesion`). */
  editar: (envio: Envio) => Promise<unknown>;
  /** Borra uno del historial (`borrarSesion`). */
  borrar: (id: string) => Promise<unknown>;
  /** Guarda en el teléfono uno nuevo que no se pudo mandar, para mandarlo después (`cola.ts`). */
  encolar?: (envio: Envio) => void;
  /** Al iniciar un entrenamiento nuevo: marca su asistencia de hoy (`marcarAsistencia`). */
  alIniciar?: () => void;
}

/**
 * Cuelga los eventos de la vista recién pintada. Uno solo, delegado en `#registro`: el
 * contenido se rehace con cada repintado, y uno por botón obligaría a recolgarlos todos.
 *
 * Escribir en un campo NO repinta: solo actualiza el borrador. Repintar en cada tecla
 * reconstruiría el input y el teclado del teléfono se cerraría bajo el dedo.
 */
export function conectarRegistro(
  d: DatosRegistro,
  repintar: () => void,
  acciones: AccionesRegistro
): void {
  const raiz = document.querySelector<HTMLElement>("#registro");
  if (!raiz) return;

  const ir = (vista: Vista) => {
    estado.vista = vista;
    estado.error = null;
    if (vista !== "historial") estado.aviso = null;
    repintar();
    window.scrollTo(0, 0);
  };

  /**
   * Abre en grande otro ejercicio del entrenamiento: tocando su fila comprimida, con
   * Anterior/Siguiente o deslizando la tarjeta (`lateral`). Su GIF chico vuela y crece hasta
   * el lugar del activo.
   */
  const activar = (i: number, lateral: boolean) => {
    const b = estado.borrador;
    if (!b) return;
    const actual = indiceActivo(b);
    if (!Number.isInteger(i) || i < 0 || i >= b.ejercicios.length || i === actual) return;
    const origen = raiz.querySelector<HTMLElement>(`.registro-compacto[data-activar="${i}"] .registro-compacto-gif`);
    estado.vuelo?.remove();
    estado.vuelo = despegar(origen);
    estado.avanzando = i > actual;
    estado.lateral = lateral;
    estado.activo = i;
    estado.enfocar = i;
    repintar();
  };

  raiz.addEventListener("click", (ev) => {
    // El aviso de reps sale al soltar el campo, que puede ser justo al tocar un botón
    // ("Terminar entrenamiento"): ese toque no cuenta hasta que conteste.
    if (document.querySelector("#reps-velo")) return;
    const el = (ev.target as HTMLElement).closest<HTMLElement>("button");
    if (!el || el.hasAttribute("disabled")) return;
    const b = estado.borrador;

    const accion = el.dataset.accion;
    if (accion === "iniciar") {
      estado.guardado = false;
      if (!b) {
        guardarBorrador(nuevoBorrador(idNuevo(), d.hoy, Date.now()));
        acciones.alIniciar?.();
      }
      ir("capturar");
      return;
    }
    if (accion === "agregar" && b) { ir("elegir"); return; }
    if (accion === "historial") { estado.guardado = false; estado.aviso = null; ir("historial"); return; }
    // Volver siempre lleva al entrenamiento si hay uno abierto, y si no, al inicio de Registro.
    if (accion === "volver") { ir(b ? "capturar" : "inicio"); return; }
    if (accion === "descartar") {
      if (b?.edicion) {
        if (!confirm("¿Salir sin guardar los cambios? El entrenamiento se queda como estaba.")) return;
        guardarBorrador(null);
        ir("historial");
        return;
      }
      if (b && b.ejercicios.length > 0 && !confirm("¿Eliminar este entrenamiento y lo que llevas anotado?")) return;
      guardarBorrador(null);
      ir("inicio");
      return;
    }
    if (accion === "guardar" && b) {
      const envio = paraEnviar(b);
      if (!envio.ok) { estado.error = envio.error; repintar(); return; }
      const edicion = b.edicion === true;
      // Uno nuevo lleva su día y la hora en que terminó: si se manda tarde, valen esos.
      const datos: Envio = edicion ? envio.datos : { ...envio.datos, fecha: b.fecha, terminadaEn: Date.now() };
      /** Sin internet: se queda en el teléfono y se manda solo cuando vuelva la señal. */
      const enTelefono = (): void => {
        acciones.encolar?.(datos);
        estado.enVuelo = false;
        guardarBorrador(null);
        estado.guardado = "en-telefono";
        ir("inicio");
      };
      const puedeEsperar = !edicion && acciones.encolar !== undefined;
      // Si el teléfono ya sabe que no hay red, ni se intenta: sería esperar a que falle.
      if (puedeEsperar && navigator.onLine === false) { enTelefono(); return; }
      estado.enVuelo = true;
      estado.error = null;
      repintar();
      (edicion ? acciones.editar : acciones.guardar)(datos).then(
        () => {
          estado.enVuelo = false;
          guardarBorrador(null);
          if (edicion) {
            // Antes de `ir`: al llegar al historial, el aviso ya tiene que estar.
            estado.vista = "historial";
            estado.aviso = "Cambios guardados ✓";
            ir("historial");
          } else {
            estado.guardado = "enviado";
            ir("inicio");
          }
        },
        (error) => {
          if (puedeEsperar && !rechazoDefinitivo(error)) { enTelefono(); return; }
          // El borrador se queda: con señal de vuelta, "Guardar" reescribe la misma sesión.
          estado.enVuelo = false;
          estado.error = "No se pudo guardar. Revisa tu conexión e intenta otra vez; lo que anotaste sigue aquí.";
          repintar();
        }
      );
      return;
    }

    // Historial: corregir o borrar un entrenamiento ya guardado.
    if (el.dataset.editar !== undefined) {
      const s = d.sesiones?.find((x) => x.id === el.dataset.editar);
      if (!s) return;
      // Hay un solo borrador: si tiene uno en curso, primero que lo termine o lo descarte.
      if (b) {
        alert(b.edicion
          ? "Ya estás editando otro entrenamiento. Guarda o cancela esos cambios primero."
          : "Tienes un entrenamiento en curso. Termínalo o descártalo antes de editar uno pasado.");
        return;
      }
      guardarBorrador(borradorDeSesion(s, d.banco));
      estado.activo = 0;
      estado.aviso = null;
      ir("capturar");
      return;
    }
    if (el.dataset.borrar !== undefined) {
      const id = el.dataset.borrar;
      const s = d.sesiones?.find((x) => x.id === id);
      if (!s || estado.borrando) return;
      if (!confirm(`¿Eliminar tu entrenamiento del ${enPalabras(s.fecha)}? No se puede deshacer.`)) return;
      estado.borrando = id;
      estado.error = null;
      estado.aviso = null;
      repintar();
      acciones.borrar(id).then(
        () => { estado.borrando = null; estado.aviso = "Entrenamiento eliminado"; repintar(); },
        () => {
          estado.borrando = null;
          estado.error = "No se pudo eliminar. Revisa tu conexión e intenta otra vez.";
          repintar();
        }
      );
      return;
    }

    // Abrir en grande otro ejercicio del entrenamiento: tocando su fila comprimida o con
    // Anterior/Siguiente. Su GIF chico vuela y crece hasta el lugar del activo.
    if (el.dataset.activar !== undefined) {
      activar(Number(el.dataset.activar), false);
      return;
    }

    const id = el.dataset.agregar;
    if (id && b) {
      const e = d.banco.find((x) => x.id === id);
      if (!e) return;
      const ya = b.ejercicios.findIndex((x) => x.ejercicioId === id);
      if (ya < 0) {
        guardarBorrador(agregarEjercicio(b, e, ultimasSeries(d.sesiones ?? [], id), seriesDeLaRutina(d, e)));
      }
      estado.enfocar = ya < 0 ? (estado.borrador?.ejercicios.length ?? 1) - 1 : ya;
      // El que acaba de elegir pasa a ser el activo, en grande.
      estado.activo = estado.enfocar;
      estado.avanzando = true;
      estado.lateral = false;
      // Antes de repintar: el grid desaparece en el repintado y el clon tiene que medirse aquí.
      estado.vuelo?.remove();
      estado.vuelo = despegar(el.querySelector<HTMLElement>(".registro-opcion-gif"));
      estado.vista = "capturar";
      estado.error = null;
      repintar();
      return;
    }
    if (!b) return;
    if (el.dataset.quitarEj !== undefined) {
      const quitado = Number(el.dataset.quitarEj);
      const actual = indiceActivo(b);
      guardarBorrador(quitarEjercicio(b, quitado));
      // Queda abierto el que estaba debajo (o el anterior si era el último).
      estado.activo = quitado < actual ? actual - 1 : actual;
      repintar();
      return;
    }
    if (el.dataset.unidad !== undefined) {
      const [i, unidad] = el.dataset.unidad.split(":");
      if (unidad !== "kg" && unidad !== "barras") return;
      guardarBorrador(cambiarUnidad(b, Number(i), unidad));
      repintar();
      return;
    }
    if (el.dataset.agregarSerie !== undefined) {
      guardarBorrador(agregarSerie(b, Number(el.dataset.agregarSerie)));
      repintar();
      return;
    }
    if (el.dataset.quitarSerie !== undefined) {
      const [i, j] = el.dataset.quitarSerie.split(":").map(Number);
      guardarBorrador(quitarSerie(b, i, j));
      repintar();
    }
  });

  raiz.addEventListener("input", (ev) => {
    const input = ev.target as HTMLInputElement;
    const { ej, serie, campo } = input.dataset;
    if (!estado.borrador || ej === undefined || serie === undefined) return;
    if (campo !== "reps" && campo !== "peso") return;
    guardarBorrador(cambiarSerie(estado.borrador, Number(ej), Number(serie), campo, input.value));
  });

  /**
   * Al tocar un campo de peso o reps se selecciona lo que ya tiene, para teclear el número
   * nuevo encima en vez de borrarlo a mano. En iOS un `select()` dentro del `focus` se pierde
   * con el toque que lo enfocó, así que se repite después de ese toque (`setTimeout`).
   */
  raiz.addEventListener("focusin", (ev) => {
    const input = ev.target as HTMLElement;
    if (!(input instanceof HTMLInputElement) || !input.dataset.campo) return;
    const seleccionar = () => {
      if (document.activeElement === input) input.setSelectionRange(0, input.value.length);
    };
    seleccionar();
    setTimeout(seleccionar, 0);
  });

  /**
   * Más de 20 reps: al soltar el campo pregunta si de verdad fueron tantas. "No, me equivoqué"
   * la regresa al campo con el número seleccionado para corregirlo; "Sí, continuar" lo deja.
   */
  raiz.addEventListener("focusout", (ev) => {
    const input = ev.target as HTMLElement;
    if (!(input instanceof HTMLInputElement) || input.dataset.campo !== "reps") return;
    if (document.querySelector("#reps-velo")) return;
    const { ej, serie } = input.dataset;
    const tipo = estado.borrador?.ejercicios[Number(ej)]?.tipo;
    if (tipo === undefined) return;
    const reps = repsDudosas(input.value, tipo);
    const clave = `${ej}:${serie}:${reps}`;
    if (reps === null || repsConfirmadas.has(clave)) return;

    document.body.insertAdjacentHTML("beforeend", avisoReps(reps));
    const velo = document.querySelector<HTMLElement>("#reps-velo");
    if (!velo) return;
    velo.querySelector<HTMLElement>('[data-reps="seguir"]')?.focus();
    velo.addEventListener("click", (e) => {
      const boton = (e.target as HTMLElement).closest<HTMLElement>("[data-reps]");
      if (!boton) return;
      velo.remove();
      if (boton.dataset.reps === "seguir") {
        repsConfirmadas.add(clave);
        return;
      }
      document
        .querySelector<HTMLInputElement>(`#registro input[data-ej="${ej}"][data-serie="${serie}"][data-campo="reps"]`)
        ?.focus();
    });
  });

  if (estado.vista === "capturar" && estado.enfocar !== null) {
    const tarjeta = raiz.querySelector<HTMLElement>(`.registro-ejercicio[data-indice="${estado.enfocar}"]`);
    const clon = estado.vuelo;
    estado.enfocar = null;
    estado.vuelo = null;
    aterrizar(clon, tarjeta, estado.avanzando, estado.lateral);
  }

  if (estado.vista === "capturar" && estado.borrador) {
    const a = indiceActivo(estado.borrador);
    conectarDeslizar(
      raiz.querySelector<HTMLElement>(".registro-ejercicio.activo"),
      (hacia) => activar(hacia === "siguiente" ? a + 1 : a - 1, true)
    );
  }
}
