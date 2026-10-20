import type { ConfigGrupos, Ejercicio, EjercicioBanco, SerieSesion, Sesion } from "../datos";
import { RANGOS, nombreRango, type FuerzaMusculo } from "../fuerza";
import { armarResumen, sesionDeEnvio, type Resumen } from "../resumen";
import { insigniaRango } from "./insigniaRango";
import { claveBanco, urlGif, urlVideo, type IndiceBanco } from "../banco";
import { modoSinDatos } from "../sinDatos";
import { seccionesRegistro } from "../grupos";
import {
  MAX_CAIDAS,
  agregarBiserie,
  agregarCaida,
  agregarEjercicio,
  agregarRonda,
  agregarSerie,
  borradorDeSesion,
  borradorGuiado,
  cambiarCaida,
  cambiarSerie,
  cambiarUnidad,
  idNuevo,
  leerBorrador,
  nombresDeSesion,
  nuevoBorrador,
  paraEnviar,
  cierreAutomatico,
  agregarCardio,
  envioCardio,
  entrenamientoDelDia,
  sumarCardio,
  textoCardio,
  type CamposCardio,
  HORAS_CIERRE,
  quitarBloque,
  quitarCaida,
  quitarEjercicio,
  quitarRonda,
  quitarSerie,
  repsDudosas,
  resumenSemana,
  resumenSeries,
  ultimasSeries,
  unidades,
  type Borrador,
  type CaidaBorrador,
  type EjercicioBorrador,
  type Envio,
  type SerieBorrador,
} from "../registro";
import { rechazoDefinitivo } from "../cola";
import { escapar } from "./tarjetaDia";
import { aterrizar, despegar } from "./vueloRegistro";
import { conectarDeslizar } from "./deslizarRegistro";
import { cronometro } from "./cronometro";
import { botonAtras } from "./botonAtras";

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
  /** El día que le toca hoy según su rutina, o null (descanso o sin rutina). */
  dia: { nombreDia: string; ejercicios: Ejercicio[] } | null;
  banco: readonly EjercicioBanco[];
  indice: IndiceBanco;
  /** null mientras no llegan. */
  sesiones: Sesion[] | null;
  /** Los ejercicios que el entrenador puso en cada grupo; null si no ha configurado ninguno. */
  config: ConfigGrupos | null;
  /** Entrenamientos terminados sin internet que esperan a mandarse (`cola.ts`). */
  pendientes?: number;
  /**
   * Minutos promedio por sesión, de sus asistencias (`promedioMinutos`); null sin sesiones
   * medidas. Estaba en Inicio y se cambió de lugar con el "n / 5" (entrenador, 2026-10-14).
   */
  promedioMinutos?: number | null;
  /**
   * Su fuerza por músculo con esas sesiones (`fuerzaDelCliente`), para el resumen al terminar:
   * se calcula sin y con el entrenamiento recién hecho para ver qué subió de rango. Vacío si
   * le falta sexo o peso.
   */
  fuerza?: (sesiones: readonly Sesion[]) => Record<string, FuerzaMusculo>;
  sexo?: "H" | "M" | null;
}

export type Vista = "inicio" | "historial" | "elegir" | "capturar" | "resumen" | "cardio" | "cardio-datos";

interface Estado {
  vista: Vista;
  borrador: Borrador | null;
  enVuelo: boolean;
  error: string | null;
  /** Se acaba de terminar uno: "enviado" llegó al servidor; "en-telefono", se guardó sin internet. */
  guardado: false | "enviado" | "en-telefono";
  /** Se cerró solo por llevar más de 3 horas abierto (`cerrarSiVencido`): con lo completo, o descartado. */
  cierreAuto: "enviado" | "descartado" | null;
  /** "Registrar cardio": la máquina elegida y lo que lleva escrito (ver la spec de cardio). */
  cardio: ({ id: string } & CamposCardio) | null;
  /** "🏃 Cardio guardado: Caminadora, 25 min", en el inicio de Registro después de guardarlo solo. */
  avisoCardio: string | null;
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
  /** El entrenamiento recién terminado, para su pantalla de resumen; null fuera de ella. */
  resumen: (Resumen & { dia: string | null }) | null;
  /**
   * "¿Qué ejercicio hiciste?": uno suelto (lo normal, y como abre siempre) o los dos de una
   * biserie (decisión del entrenador, 2026-10-15).
   */
  modoElegir: "uno" | "biserie";
  /** En modo biserie, los ids elegidos en orden: el primero es la A. */
  seleccion: string[];
  /** La serie cuyo número se tocó ("ej:serie"): debajo sale "↓ Agregar bajada". */
  menuSerie: string | null;
}

const LLAVE_BORRADOR = "osfit:registro-borrador";

/**
 * Hasta dónde había bajado en "¿Qué ejercicio hiciste?" la última vez: al volver a entrar se
 * queda ahí y no arriba del todo (decisión del entrenador, 2026-10-15), porque suele seguir con
 * el grupo que estaba viendo. Vuelve a 0 con cada entrenamiento nuevo.
 */
let posicionElegir = 0;

/** Se llama justo antes de salir de "elegir", por donde sea. */
function recordarPosicionElegir(): void {
  if (estado.vista === "elegir") posicionElegir = window.scrollY;
}

const estado: Estado = {
  vista: "inicio",
  borrador: (() => {
    try { return leerBorrador(localStorage.getItem(LLAVE_BORRADOR)); } catch { return null; }
  })(),
  enVuelo: false,
  error: null,
  guardado: false,
  cierreAuto: null,
  cardio: null,
  avisoCardio: null,
  enfocar: null,
  vuelo: null,
  activo: null,
  aviso: null,
  borrando: null,
  avanzando: true,
  lateral: false,
  resumen: null,
  modoElegir: "uno",
  seleccion: [],
  menuSerie: null,
};

const VISTAS: readonly Vista[] = ["inicio", "historial", "elegir", "capturar", "resumen", "cardio", "cardio-datos"];

/**
 * La pantalla que dice el historial, al hacer "atrás" (`alRetrocederSub` de `navegacion.ts`).
 * null es la de entrada: inicio, o el entrenamiento si hay uno abierto (`ventanaRegistro`).
 */
export function vistaDesdeHistorial(vista: string | null): void {
  recordarPosicionElegir();
  estado.vista = VISTAS.includes(vista as Vista) ? (vista as Vista) : "inicio";
  estado.error = null;
}

/** Solo para los tests: poner la ventana en una vista y con un borrador dados. */
export function ponerEstadoRegistro(
  parcial: Partial<Pick<Estado, "vista" | "borrador" | "error" | "activo" | "resumen" | "modoElegir" | "seleccion" | "menuSerie" | "cardio">>
): void {
  Object.assign(estado, {
    guardado: false, cierreAuto: null, cardio: null, avisoCardio: null, enVuelo: false, error: null, activo: null, aviso: null, borrando: null, resumen: null,
    modoElegir: "uno", seleccion: [], menuSerie: null,
  }, parcial);
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
  estado.cierreAuto = null;
  estado.error = null;
  estado.aviso = null;
  if (estado.borrador) {
    estado.vista = "capturar";
    return false;
  }
  if (!d.dia) return false;
  guardarBorrador(borradorGuiado(idNuevo(), d.hoy, ahora, d.dia, d.indice, d.sesiones ?? []));
  posicionElegir = 0;
  estado.vista = "capturar";
  estado.activo = 0;
  estado.avanzando = true;
  estado.lateral = false;
  return true;
}

/**
 * Cierra el entrenamiento abierto si lleva más de `HORAS_CIERRE` (entrenador, 2026-10-20): lo
 * manda por la cola con lo completo, o lo descarta si no tiene nada completo. El entrenamiento
 * vive solo en el teléfono, así que esto lo revisa la página (`main.ts`: al abrir, al volver y
 * cada minuto); no hay servidor que pueda cerrarlo. Devuelve si cerró algo, para repintar.
 */
export function cerrarSiVencido(
  acciones: Pick<AccionesRegistro, "encolar" | "enviarAhora">,
  ahora = Date.now()
): boolean {
  const r = cierreAutomatico(estado.borrador, ahora);
  if (!r) return false;
  if (r.tipo === "enviar") {
    acciones.encolar?.(r.datos);
    acciones.enviarAhora?.();
  }
  guardarBorrador(null);
  Object.assign(estado, {
    vista: "inicio", resumen: null, error: null, guardado: false, activo: null, menuSerie: null,
    cierreAuto: r.tipo === "enviar" ? "enviado" : "descartado",
  });
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

/**
 * Al terminar un entrenamiento con el modo sin datos puesto (pedido del entrenador,
 * 2026-10-20): queda en el teléfono y no sale hasta que lo quite, así que se le dice en una
 * ventana y no solo en la nota del resumen, que se puede pasar por alto. Mismo velo que el de
 * las reps; "Quitar el modo" solo se ofrece si hay quien lo apague.
 */
export function avisoTerminadoSinDatos(puedeApagar: boolean): string {
  return `
    <div class="reps-velo" id="sin-datos-velo">
      <div class="reps-aviso tarjeta" role="alertdialog" aria-modal="true" aria-labelledby="sin-datos-titulo" aria-describedby="sin-datos-texto">
        <p class="reps-titulo" id="sin-datos-titulo">📱 Tu entrenamiento quedó guardado en tu teléfono</p>
        <p class="reps-texto" id="sin-datos-texto">Para mandarlo al servidor se necesita conexión a internet. Te recomendamos que, cuando tengas conexión, quites el modo sin datos en Ajustes: se enviará solo.</p>
        ${puedeApagar ? `<button type="button" class="boton secundario" data-sin-datos-fin="apagar">Ya tengo internet: quitar el modo</button>` : ""}
        <button type="button" class="boton" data-sin-datos-fin="entendido">Entendido</button>
      </div>
    </div>`;
}

function mostrarTerminadoSinDatos(apagar: (() => void) | undefined): void {
  if (document.querySelector("#sin-datos-velo")) return;
  document.body.insertAdjacentHTML("beforeend", avisoTerminadoSinDatos(apagar !== undefined));
  const velo = document.querySelector<HTMLElement>("#sin-datos-velo");
  if (!velo) return;
  velo.querySelector<HTMLElement>('[data-sin-datos-fin="entendido"]')?.focus();
  velo.addEventListener("click", (e) => {
    const boton = (e.target as HTMLElement).closest<HTMLElement>("[data-sin-datos-fin]");
    if (!boton) return;
    velo.remove();
    if (boton.dataset.sinDatosFin === "apagar") apagar?.();
  });
}

/** Las reps que ya confirmó ("ej:serie:reps"), para no volver a preguntar por las mismas. */
const repsConfirmadas = new Set<string>();

// ── Inicio e historial ───────────────────────────────────────────────────────

function textoSerie(s: SerieSesion, tipo: "tiempo" | "cardio" | "otro", ejercicioId?: string): string {
  if (tipo === "cardio") return textoCardio(s, ejercicioId);
  const una = (x: { reps: number; peso: number | null }) => tipo === "tiempo"
    ? `${x.reps} s`
    : x.peso === null ? `× ${x.reps}` : `${x.peso} kg × ${x.reps}`;
  // Las bajadas del dropset, pegadas a su serie: "40 kg × 10 ↓ 30 kg × 8".
  return [s, ...(s.caidas ?? [])].map(una).join(" ↓ ");
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
  const filas = s.ejercicios.map((e, i) => {
    const delBanco = banco.find((x) => x.id === e.ejercicioId)?.tipo;
    const tipo = delBanco === "tiempo" || delBanco === "cardio" ? delBanco : "otro";
    // En una biserie, el primero de los dos es la A.
    const letra = !e.biserie ? null : s.ejercicios[i - 1]?.biserie === e.biserie ? "B" : "A";
    const marca = letra ? `<span class="registro-letra" aria-label="Biserie, ejercicio ${letra}">${letra}</span>` : "";
    return `
      <li class="registro-hist-ej${letra === "B" ? " biserie-b" : ""}">
        <span class="registro-hist-nombre">${marca}${escapar(e.nombre)}</span>
        <span class="registro-hist-series">${e.series.map((x) => escapar(textoSerie(x, tipo, e.ejercicioId))).join(" · ")}</span>
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
/** Cuándo sale lo que espera en la cola: con el modo sin datos, hasta que lo apague. */
function cuandoSeEnvia(): string {
  return modoSinDatos() ? "cuando desactives el modo sin datos" : "solo en cuanto tengas internet";
}

function vistaInicio(d: DatosRegistro): string {
  const n = d.pendientes ?? 0;
  // Recién terminado y todavía en la cola (sin internet, o mandándose por detrás): se dice que
  // está en el teléfono. Cuando la cola queda vacía es un guardado normal.
  const aviso = estado.avisoCardio
    ? `<p class="aviso-ok">${escapar(estado.avisoCardio)}</p>`
    : estado.cierreAuto === "enviado"
    ? `<p class="aviso-ok">⏰ Tu entrenamiento llevaba más de ${HORAS_CIERRE} horas abierto: lo cerramos solo y lo guardamos con las series que completaste.</p>`
    : estado.cierreAuto === "descartado"
      ? `<p class="registro-pendientes">⏰ Tu entrenamiento llevaba más de ${HORAS_CIERRE} horas abierto y no tenía ninguna serie completa, así que lo descartamos.</p>`
    : estado.guardado && n > 0
    ? `<p class="aviso-ok">¡Entrenamiento guardado en tu teléfono! 📱 Se enviará ${cuandoSeEnvia()}.</p>`
    : estado.guardado ? `<p class="aviso-ok">¡Entrenamiento guardado! 💪</p>`
    : n > 0 ? `<p class="registro-pendientes">📤 ${n === 1 ? "1 entrenamiento espera" : `${n} entrenamientos esperan`} ${modoSinDatos() ? "a que desactives el modo sin datos" : "internet"} para enviarse.</p>`
    : "";
  const sesiones = d.sesiones ?? [];
  const semana = resumenSemana(sesiones, d.hoy, d.banco);

  const dias = semana.dias.map((x) => {
    const clase = x.entreno ? " hecho" : x.esHoy ? " es-hoy" : "";
    const estadoDia = x.entreno ? "entrenaste" : x.esHoy ? "hoy" : "sin entrenamiento";
    return `
      <li class="registro-semana-dia">
        <span class="registro-semana-letra" aria-hidden="true">${x.letra}</span>
        <span class="registro-semana-num${clase}" aria-label="${escapar(`${enPalabras(x.fecha)}, ${estadoDia}`)}">${x.numero}</span>
      </li>`;
  }).join("");

  const promedio = d.promedioMinutos ?? null;
  const datos = `
    <div class="registro-datos">
      <div class="registro-dato"><strong>${promedio === null ? "—" : duracion(promedio)}</strong><span>promedio por sesión</span></div>
      <div class="registro-dato"><strong>${semana.minutos === null ? "—" : duracion(semana.minutos)}</strong><span>entrenando</span></div>
      <div class="registro-dato"><strong>${semana.series}</strong><span>series</span></div>
    </div>
    ${semana.minutosCardio > 0 ? `<p class="registro-semana-cardio">🏃 ${duracion(semana.minutosCardio)} de cardio esta semana</p>` : ""}`;

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
    ${hayCardio(d) ? `<button class="boton secundario registro-boton-cardio" data-accion="cardio">🏃 Registrar cardio</button>` : ""}
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
    ${botonAtras(`data-accion="volver"`)}
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
  // En modo biserie, tocar marca (A o B) en vez de agregar.
  const biserie = estado.modoElegir === "biserie";
  const k = biserie ? estado.seleccion.indexOf(e.id) : -1;
  const letra = k === 0 ? "A" : k === 1 ? "B" : null;
  const accion = biserie ? `data-biserie-elegir="${escapar(e.id)}" aria-pressed="${letra !== null}"` : `data-agregar="${escapar(e.id)}"`;
  return `
    <button class="registro-opcion${ya ? " agregado" : ""}${letra ? " marcada" : ""}" ${accion}
            ${ya ? `disabled aria-label="${escapar(e.nombre)}, ya está en tu entrenamiento"` : ""}>
      ${letra ? `<span class="registro-marca" aria-label="Ejercicio ${letra}">${letra}</span>` : ""}
      ${gif(e.gifRuta, "registro-opcion-gif", 160)}
      <span class="registro-opcion-nombre">${escapar(e.nombre)}</span>
      ${ya ? `<span class="registro-opcion-ya">✓ Ya en tu entrenamiento</span>` : ""}
    </button>`;
}

/**
 * El cronómetro arriba del entrenamiento en curso, desde que lo inició. No en una corrección
 * (ya terminó) ni en los borradores de antes de guardar la hora de inicio.
 */
function cronometroDelBorrador(): string {
  const b = estado.borrador;
  return b && !b.edicion && typeof b.iniciado === "number" ? cronometro(b.iniciado) : "";
}

/**
 * Un solo renglón pegado arriba al hacer scroll: el grupo muscular que se está viendo y el
 * cronómetro a la derecha. Pegada, se corre a la derecha de la flecha fija y las tres cosas
 * quedan en un renglón (decisión del entrenador, 2026-10-15; antes el cronómetro, la flecha y
 * la banda del grupo se pegaban cada uno a una altura). El nombre lo cambia `seguirGrupo` al
 * pasar por debajo cada banda.
 */
function barraElegir(titulo: string, delDia: boolean): string {
  return `
    <div class="registro-barra${delDia ? " del-dia" : ""}" id="registro-barra"
         data-grupo="${escapar(titulo)}"${delDia ? " data-del-dia" : ""}>
      <span class="registro-barra-grupo">${escapar(titulo)}</span>
      ${cronometroDelBorrador()}
    </div>`;
}

/**
 * Pone en la barra el grupo cuya banda ya pasó por debajo de ella (o el primero, que no tiene
 * banda), y la marca `pegada` cuando llega arriba. Un solo listener de scroll para toda la
 * página: sin barra en pantalla no hace nada.
 */
function seguirGrupo(): void {
  const barra = document.querySelector<HTMLElement>("#registro-barra");
  if (!barra) return;
  const caja = barra.getBoundingClientRect();
  const tope = parseFloat(getComputedStyle(barra).top) || 0;
  barra.classList.toggle("pegada", caja.top <= tope + 1);
  let titulo = barra.dataset.grupo ?? "";
  let delDia = barra.dataset.delDia !== undefined;
  for (const banda of document.querySelectorAll<HTMLElement>("#registro .registro-grupo")) {
    if (banda.getBoundingClientRect().top >= caja.bottom) break;
    titulo = banda.textContent ?? "";
    delDia = banda.classList.contains("del-dia");
  }
  const nombre = barra.querySelector<HTMLElement>(".registro-barra-grupo");
  if (nombre && nombre.textContent !== titulo) nombre.textContent = titulo;
  barra.classList.toggle("del-dia", delDia);
}
let siguiendoGrupo = false;

/**
 * Abajo, en modo biserie: lo elegido (A y B) y "Agregar biserie", que se habilita con los dos.
 * Fija sobre la barra de abajo, para no tener que bajar hasta el final del grid.
 */
function barraBiserie(banco: readonly EjercicioBanco[]): string {
  const nombre = (k: number) => banco.find((x) => x.id === estado.seleccion[k])?.nombre;
  const [a, c] = [nombre(0), nombre(1)];
  const texto = !a ? "Toca el ejercicio <strong>A</strong>"
    : `<span><strong>A</strong> ${escapar(a)}</span><span>${c ? `<strong>B</strong> ${escapar(c)}` : "Ahora toca el <strong>B</strong>"}</span>`;
  return `
    <div class="registro-espacio-biserie" aria-hidden="true"></div>
    <div class="registro-barra-biserie">
      <span class="registro-barra-biserie-texto">${texto}</span>
      <button class="boton" data-accion="agregar-biserie" ${a && c ? "" : "disabled"}>Agregar biserie</button>
    </div>`;
}

function vistaElegir(d: DatosRegistro): string {
  if (d.banco.length === 0) {
    return `
      ${cronometroDelBorrador()}
      ${botonAtras(`data-accion="volver"`)}
      <p class="accion-nota">Cargando ejercicios…</p>`;
  }
  const secciones = seccionesRegistro(d.dia?.nombreDia ?? null, d.banco, d.config);
  const hayDelDia = secciones.some((x) => x.delDia);
  let separado = false;
  const cuerpo = secciones.map((x, i) => {
    // Un rótulo entre lo de hoy y lo demás, para que se note dónde termina su día.
    let antes = "";
    if (hayDelDia && !x.delDia && !separado) {
      separado = true;
      antes = `<p class="registro-separador">Más ejercicios</p>`;
    }
    // El primer grupo no lleva su banda: la barra de arriba ocupa su lugar y ya lo nombra.
    const banda = i === 0 ? barraElegir(x.titulo, x.delDia)
      : `<p class="registro-grupo${x.delDia ? " del-dia" : ""}">${escapar(x.titulo)}</p>`;
    return `${antes}
      ${banda}
      <div class="registro-grid">${x.ejercicios.map(opcion).join("")}</div>`;
  }).join("");
  const hoy = d.dia && hayDelDia
    ? `<p class="accion-nota" style="margin:2px 2px 0">Hoy te toca ${escapar(d.dia.nombreDia.trim())}</p>`
    : "";
  const biserie = estado.modoElegir === "biserie";
  const modo = `
    <div class="registro-modo" role="group" aria-label="Qué vas a agregar">
      <button data-modo="uno" aria-pressed="${!biserie}" class="${biserie ? "" : "activa"}">Un ejercicio</button>
      <button data-modo="biserie" aria-pressed="${biserie}" class="${biserie ? "activa" : ""}">Biserie</button>
    </div>`;
  return `
    ${botonAtras(`data-accion="volver"`)}
    <p class="confirmar-titulo">¿Qué ejercicio hiciste?</p>
    ${modo}
    ${biserie ? `<p class="accion-nota registro-modo-nota">Elige los dos ejercicios, en el orden en que los haces.</p>` : hoy}
    ${cuerpo}
    ${biserie ? barraBiserie(d.banco) : ""}
    ${CREDITO}`;
}

// ── Capturar ─────────────────────────────────────────────────────────────────

/** Los campos de peso y reps de una serie o de una bajada (`k`). */
function camposSerie(e: EjercicioBorrador, i: number, j: number, s: CaidaBorrador, donde: string, k?: number): string {
  const caida = k === undefined ? "" : ` data-caida="${k}"`;
  const reps = `
    <label class="registro-campo">
      <input inputmode="numeric" data-ej="${i}" data-serie="${j}"${caida} data-campo="reps"
             value="${escapar(s.reps)}" placeholder="0" aria-label="${escapar(donde)}, ${e.tipo === "tiempo" ? "segundos" : "repeticiones"}">
      <span>${e.tipo === "tiempo" ? "seg" : "reps"}</span>
    </label>`;
  const enBarras = e.unidad === "barras";
  const peso = e.tipo === "tiempo" ? "" : `
    <label class="registro-campo">
      <input inputmode="decimal" data-ej="${i}" data-serie="${j}"${caida} data-campo="peso"
             value="${escapar(s.peso)}" placeholder="${e.tipo === "corporal" ? "+0" : "0"}" aria-label="${escapar(donde)}, ${enBarras ? "barras" : "kilos"}">
      <span>${enBarras ? "barras" : "kg"}</span>
    </label>
    <span class="registro-por" aria-hidden="true">×</span>`;
  return `${peso}${reps}`;
}

/**
 * Una serie con sus bajadas. En los de peso el número de la serie se puede tocar: abre
 * "↓ Agregar bajada" para anotar un dropset (decisión del entrenador, 2026-10-15: un botón en
 * cada serie ocupaba demasiado). En una biserie el número es la letra (A o B) y la serie no
 * lleva ✕: se quita la ronda entera.
 */
function filaSerie(e: EjercicioBorrador, i: number, s: SerieBorrador, j: number, letra?: "A" | "B"): string {
  const donde = letra ? `${e.nombre}, ronda ${j + 1}` : `Serie ${j + 1}`;
  const rotulo = letra ?? String(j + 1);
  const abierto = estado.menuSerie === `${i}:${j}`;
  const clase = `registro-serie-num${letra ? " letra" : ""}`;
  const num = e.tipo === "peso"
    ? `<button class="${clase} tocable${abierto ? " abierto" : ""}" data-menu-serie="${i}:${j}" aria-expanded="${abierto}"
              aria-label="${escapar(donde)}: agregar un drop">${rotulo}</button>`
    : `<span class="${clase}">${rotulo}</span>`;
  const quitar = letra ? "" : `<button class="registro-quitar" data-quitar-serie="${i}:${j}" aria-label="Quitar serie ${j + 1}">✕</button>`;
  const caidas = (s.caidas ?? []).map((c, k) => `
    <div class="registro-serie registro-caida">
      <span class="registro-serie-num caida" aria-hidden="true">↓</span>
      ${camposSerie(e, i, j, c, `${donde}, bajada ${k + 1}`, k)}
      <button class="registro-quitar" data-quitar-caida="${i}:${j}:${k}" aria-label="Quitar bajada ${k + 1} de ${escapar(donde)}">✕</button>
    </div>`).join("");
  const lleno = (s.caidas?.length ?? 0) >= MAX_CAIDAS;
  const menu = !abierto ? "" : `
    <div class="registro-menu-serie">
      ${lleno ? `<span class="accion-nota">Ya tiene ${MAX_CAIDAS} bajadas.</span>`
        : `<button class="registro-menu-opcion" data-agregar-caida="${i}:${j}">↓ Agregar bajada (drop)</button>`}
      <button class="registro-menu-opcion tenue" data-menu-serie="">Cancelar</button>
    </div>`;
  return `
    <div class="registro-serie">
      ${num}
      ${camposSerie(e, i, j, s, donde)}
      ${quitar}
    </div>${menu}${caidas}`;
}

const LLAVE_PISTA_DROP = "osfit:pista-drop";

/**
 * "Toca el número de una serie…", hasta que agregue su primer drop: tocar el número no se
 * adivina, pero una vez aprendido el aviso sobra.
 */
function pistaDrop(): string {
  try { if (localStorage.getItem(LLAVE_PISTA_DROP)) return ""; } catch { /* sin almacenamiento, se muestra */ }
  return `<p class="accion-nota registro-pista-drop">Toca el número de una serie para agregarle un drop.</p>`;
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
  // Sin datos, el GIF: el video no se guarda en el teléfono y bajarlo es justo lo que se evita.
  if (!video || modoSinDatos()) return gif(gifRuta, "registro-ej-gif", 180);
  const poster = urlGif(gifRuta);
  return `<video class="registro-ej-gif registro-ej-video" src="${escapar(video)}"
      ${poster ? `poster="${escapar(poster)}"` : ""} width="260" height="260"
      autoplay muted loop playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video>`;
}

/** La nota de cómo se anota el peso, si hace falta. */
function notaPeso(e: EjercicioBorrador, delBanco: EjercicioBanco | undefined): string {
  // Los estándares de fuerza de mancuernas cuentan una sola (`docs/estandares-fuerza/`).
  return e.tipo === "corporal"
    ? `<p class="accion-nota">Con tu peso corporal. En kg, solo si agregaste peso extra.</p>`
    : e.unidad === "barras"
      ? `<p class="accion-nota">Cuántas barras de la máquina pusiste.</p>`
      : delBanco?.notaPeso
        ? `<p class="accion-nota">${escapar(delBanco.notaPeso)}</p>`
        : delBanco?.pesoPorMancuerna
          ? `<p class="accion-nota">En kg, el peso de una mancuerna.</p>`
          : "";
}

/** Barras o kg, solo en los de peso. Las máquinas de placas abren en barras (`barras.ts`). */
function selectorUnidad(e: EjercicioBorrador, i: number): string {
  if (e.tipo !== "peso") return "";
  const enBarras = e.unidad === "barras";
  return `
      <div class="registro-unidad" role="group" aria-label="Unidad del peso${escapar(` de ${e.nombre}`)}">
        <button data-unidad="${i}:barras" aria-pressed="${enBarras}" class="${enBarras ? "activa" : ""}">Barras</button>
        <button data-unidad="${i}:kg" aria-pressed="${!enBarras}" class="${enBarras ? "" : "activa"}">Kg</button>
      </div>`;
}

/**
 * Anterior/Siguiente entre lo que se ve en grande: un ejercicio suelto o una biserie entera
 * (`unidades`). Cada botón lleva al primer ejercicio de la unidad de al lado.
 */
function navUnidades(us: readonly number[][], ua: number): string {
  if (us.length <= 1) return "";
  const antes = us[ua - 1]?.[0];
  const despues = us[ua + 1]?.[0];
  return `
      <div class="registro-nav">
        <button class="registro-nav-boton" data-activar="${antes ?? ""}" ${antes === undefined ? "disabled" : ""}>‹ Anterior</button>
        <span class="registro-nav-cuenta">${ua + 1} de ${us.length}<span class="registro-nav-pista">desliza ‹ ›</span></span>
        <button class="registro-nav-boton" data-activar="${despues ?? ""}" ${despues === undefined ? "disabled" : ""}>Siguiente ›</button>
      </div>`;
}

/**
 * El ejercicio activo, en grande: el GIF a lo ancho, sus series y cómo moverse al anterior o
 * al siguiente. Es el único con campos: los demás solo muestran su resumen.
 */
function tarjetaActiva(e: EjercicioBorrador, i: number, nav: string, delBanco?: EjercicioBanco): string {
  if (e.tipo === "cardio") {
    const s = e.series[0] ?? { reps: "", peso: "" };
    const campo = (c: "reps" | "inclinacion" | "velocidad", valor: string | undefined) =>
      `data-ej="${i}" data-serie="0" data-campo="${c}" value="${escapar(valor ?? "")}"`;
    return `
    <div class="tarjeta registro-ejercicio activo" data-indice="${i}">
      <div class="registro-activo-gif">
        ${medioGrande(e, delBanco)}
        <button class="registro-quitar registro-quitar-ej" data-quitar-ej="${i}" aria-label="Quitar ${escapar(e.nombre)}">✕</button>
      </div>
      <p class="registro-activo-nombre">${escapar(e.nombre)}</p>
      ${camposCardio(e.ejercicioId, campo("reps", s.reps), campo("inclinacion", s.inclinacion), campo("velocidad", s.velocidad))}
      ${nav}
    </div>`;
  }
  return `
    <div class="tarjeta registro-ejercicio activo" data-indice="${i}">
      <div class="registro-activo-gif">
        ${medioGrande(e, delBanco)}
        <button class="registro-quitar registro-quitar-ej" data-quitar-ej="${i}" aria-label="Quitar ${escapar(e.nombre)}">✕</button>
      </div>
      <p class="registro-activo-nombre">${escapar(e.nombre)}</p>
      ${e.objetivo ? `<p class="registro-objetivo">Tu rutina: ${escapar(e.objetivo)}</p>` : ""}
      ${selectorUnidad(e, i)}
      ${notaPeso(e, delBanco)}
      ${e.tipo === "peso" ? pistaDrop() : ""}
      ${e.series.map((s, j) => filaSerie(e, i, s, j)).join("")}
      <button class="registro-mas-serie" data-agregar-serie="${i}">+ Serie</button>
      ${nav}
    </div>`;
}

/**
 * Una biserie abierta en grande: los dos ejercicios lado a lado (A y B) y sus series por
 * rondas, A y luego B (decisión del entrenador, 2026-10-15). Las rondas se agregan y se quitan
 * para los dos a la vez; la ✕ de arriba saca la biserie entera.
 */
function tarjetaBiserie(b: Borrador, iA: number, iB: number, nav: string, banco: readonly EjercicioBanco[]): string {
  const par = [iA, iB].map((i) => ({ i, e: b.ejercicios[i], delBanco: banco.find((x) => x.id === b.ejercicios[i].ejercicioId) }));
  const ejercicios = par.map(({ i, e, delBanco }, k) => `
      <div class="registro-biserie-ej">
        ${gif(delBanco?.gifRuta ?? e.gifRuta, "registro-ej-gif", 160)}
        <p class="registro-biserie-nombre"><span class="registro-letra">${k === 0 ? "A" : "B"}</span>${escapar(e.nombre)}</p>
        ${notaPeso(e, delBanco)}
        ${selectorUnidad(e, i)}
      </div>`).join("");
  const [a, c] = par.map((x) => x.e);
  const rondas = Array.from({ length: Math.max(a.series.length, c.series.length) }, (_, j) => `
      <div class="registro-ronda">
        <div class="registro-ronda-cab">
          <span>Ronda ${j + 1}</span>
          <button class="registro-quitar" data-quitar-ronda="${iA}:${j}" aria-label="Quitar ronda ${j + 1}">✕</button>
        </div>
        ${a.series[j] ? filaSerie(a, iA, a.series[j], j, "A") : ""}
        ${c.series[j] ? filaSerie(c, iB, c.series[j], j, "B") : ""}
      </div>`).join("");
  return `
    <div class="tarjeta registro-ejercicio registro-biserie activo" data-indice="${iA}">
      <div class="registro-biserie-cab">
        <span>Biserie</span>
        <button class="registro-quitar" data-quitar-biserie="${iA}" aria-label="Quitar la biserie de ${escapar(a.nombre)} y ${escapar(c.nombre)}">✕</button>
      </div>
      <div class="registro-biserie-ejs">${ejercicios}</div>
      ${a.tipo === "peso" || c.tipo === "peso" ? pistaDrop() : ""}
      ${rondas}
      <button class="registro-mas-serie" data-agregar-ronda="${iA}">+ Ronda</button>
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

/** Una biserie que no es la activa: sus dos nombres y cuántas rondas lleva anotadas. */
function filaCompactaBiserie(a: EjercicioBorrador, c: EjercicioBorrador, iA: number): string {
  const llenas = (e: EjercicioBorrador) => e.series.filter((s) => s.reps.trim() !== "" || s.peso.trim() !== "").length;
  const n = Math.max(llenas(a), llenas(c));
  const nombres = `${a.nombre} + ${c.nombre}`;
  return `
    <button class="registro-compacto" data-activar="${iA}" aria-label="Abrir la biserie ${escapar(nombres)}">
      ${gif(a.gifRuta, "registro-compacto-gif", 44)}
      <span class="registro-compacto-texto">
        <span class="registro-compacto-nombre">${escapar(nombres)}</span>
        <span class="registro-compacto-resumen">Biserie · ${n === 0 ? "Sin anotar" : n === 1 ? "1 ronda" : `${n} rondas`}</span>
      </span>
      <span class="registro-compacto-flecha" aria-hidden="true">›</span>
    </button>`;
}

/** Arriba los anteriores comprimidos, en medio el activo en grande, abajo los siguientes. */
function ejerciciosDelEntrenamiento(b: Borrador, banco: readonly EjercicioBanco[]): string {
  const us = unidades(b);
  const a = indiceActivo(b);
  const ua = Math.max(0, us.findIndex((u) => u.includes(a)));
  const compacta = (u: number[]) => u.length === 2
    ? filaCompactaBiserie(b.ejercicios[u[0]], b.ejercicios[u[1]], u[0])
    : filaCompacta(b.ejercicios[u[0]], u[0]);
  const arriba = us.slice(0, ua).map(compacta).join("");
  const abajo = us.slice(ua + 1).map(compacta).join("");
  const nav = navUnidades(us, ua);
  const u = us[ua];
  const activa = u.length === 2
    ? tarjetaBiserie(b, u[0], u[1], nav, banco)
    : tarjetaActiva(b.ejercicios[u[0]], u[0], nav, banco.find((x) => x.id === b.ejercicios[u[0]].ejercicioId));
  return `
    ${arriba ? `<div class="registro-compactos">${arriba}</div>` : ""}
    ${activa}
    ${abajo ? `<div class="registro-compactos">${abajo}</div>` : ""}`;
}

// ── Cardio ───────────────────────────────────────────────────────────────────

/** El orden de las máquinas en "¿En qué hiciste cardio?"; las que se agreguen después van al final. */
const ORDEN_CARDIO = ["caminadora", "escaladora", "eliptica", "bicicleta"];

function maquinasCardio(d: DatosRegistro): EjercicioBanco[] {
  const pos = (id: string) => (ORDEN_CARDIO.indexOf(id) + 1 || 99);
  return d.banco.filter((b) => b.tipo === "cardio").sort((a, b) => pos(a.id) - pos(b.id) || a.nombre.localeCompare(b.nombre, "es"));
}

/** Sin máquinas en el banco (antes de cargarlas), el botón no sale: no habría qué elegir. */
function hayCardio(d: DatosRegistro): boolean {
  return d.banco.some((b) => b.tipo === "cardio");
}

/** Si el cardio va a un entrenamiento de hoy: el abierto, o uno ya guardado hoy. */
function hayDeHoy(d: DatosRegistro): boolean {
  return (estado.borrador !== null && !estado.borrador.edicion) || (d.sesiones ?? []).some((s) => s.fecha === d.hoy);
}

/** La caminadora y la elíptica son las únicas con inclinación. */
const CON_INCLINACION = new Set(["caminadora", "eliptica"]);

/**
 * Los renglones de una máquina: minutos y, opcionales, inclinación y velocidad. `atributos` lleva
 * cómo se liga cada campo (al borrador del entrenamiento o al formulario de "Registrar cardio").
 */
function camposCardio(id: string, minutos: string, inclinacion: string, velocidad: string): string {
  const renglon = (titulo: string, nota: string, atributos: string, modo: "numeric" | "decimal") => `
      <label class="cardio-campo">
        <span>${titulo}${nota ? `<small>${nota}</small>` : ""}</span>
        <input class="cardio-input" ${atributos} inputmode="${modo}" placeholder="0" autocomplete="off">
      </label>`;
  return `
    <div class="cardio-campos">
      ${renglon("Minutos", "", minutos, "numeric")}
      ${CON_INCLINACION.has(id) ? renglon("Inclinación", "opcional", inclinacion, "decimal") : ""}
      ${renglon("Velocidad", id === "caminadora" ? "km/h · opcional" : "opcional", velocidad, "decimal")}
    </div>`;
}

function vistaCardio(d: DatosRegistro): string {
  const tarjetas = maquinasCardio(d).map((m) => `
      <button class="cardio-maquina" data-cardio="${escapar(m.id)}">
        ${gif(m.gifRuta, "cardio-maquina-gif", 160)}
        <span>${escapar(m.nombre)}</span>
      </button>`).join("");
  return `
    <p class="confirmar-titulo cardio-titulo">¿En qué hiciste cardio?</p>
    <div class="cardio-maquinas">${tarjetas}</div>
    <p class="accion-nota">${hayDeHoy(d) ? "Se agrega a tu entrenamiento de hoy." : "Toca una máquina para anotar tu tiempo."}</p>
    ${CREDITO}`;
}

function vistaCardioDatos(d: DatosRegistro): string {
  const c = estado.cardio;
  const m = c ? d.banco.find((b) => b.id === c.id) : undefined;
  if (!c || !m) return vistaCardio(d);
  const campo = (k: keyof CamposCardio) => `data-cardio-campo="${k}" value="${escapar(c[k])}"`;
  const error = estado.error ? `<p class="aviso-error" style="margin:0 0 12px">${escapar(estado.error)}</p>` : "";
  return `
    <div class="tarjeta cardio-cabeza">
      ${gif(m.gifRuta, "cardio-cabeza-gif", 64)}
      <div><p class="registro-activo-nombre">${escapar(m.nombre)}</p><p class="accion-nota">Anota lo que marca la pantalla de la máquina.</p></div>
    </div>
    <div class="tarjeta">${camposCardio(m.id, campo("minutos"), campo("inclinacion"), campo("velocidad"))}</div>
    ${error}
    <button class="boton" data-accion="guardar-cardio">${hayDeHoy(d) ? "Agregar a mi entrenamiento" : "Guardar cardio"}</button>
    ${CREDITO}`;
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
    ${cronometroDelBorrador()}
    ${hay ? ejerciciosDelEntrenamiento(b, d.banco) : ""}
    ${vacio}
    ${sinLigar}
    ${error}
    <button class="boton${hay ? " secundario" : ""}" data-accion="agregar" ${off}>+ Agregar ejercicio</button>
    ${!b.edicion && hayCardio(d) ? `<button class="boton secundario registro-boton-cardio" data-accion="cardio" ${off}>🏃 Agregar cardio</button>` : ""}
    ${hay ? `<button class="boton" data-accion="guardar" ${off}>${estado.enVuelo ? "Guardando…" : b.edicion ? "Guardar cambios" : "Terminar entrenamiento"}</button>` : ""}
    ${hay ? CREDITO : ""}
    <button class="boton-texto registro-eliminar" data-accion="descartar" ${off}>${b.edicion ? "Cancelar cambios" : "Eliminar entrenamiento"}</button>`;
}

// ── Resumen ──────────────────────────────────────────────────────────────────

/**
 * Al terminar un entrenamiento, de Registro o guiado: cuánto duró y cuánto hizo, si algún
 * músculo subió de rango, y los músculos que trabajó. Ver `resumen.ts`.
 */
function vistaResumen(r: Resumen & { dia: string | null }, sexo: "H" | "M"): string {
  const dato = (valor: string, texto: string) =>
    `<div class="registro-dato"><strong>${escapar(valor)}</strong><span>${texto}</span></div>`;
  const datos = `
    <div class="registro-datos resumen-datos">
      ${dato(r.minutos === null ? "—" : duracion(r.minutos), "entrenando")}
      ${dato(String(r.ejercicios), r.ejercicios === 1 ? "ejercicio" : "ejercicios")}
      ${dato(String(r.series), r.series === 1 ? "serie" : "series")}
      ${dato(`${r.kilos.toLocaleString("es-MX")} kg`, "levantados")}
    </div>`;
  const subidas = r.subidas.length === 0 ? "" : `
    <div class="tarjeta resumen-subidas">
      <p class="tarjeta-titulo">${r.subidas.length === 1 ? "¡Subiste de rango!" : "¡Subiste de rango en " + r.subidas.length + " músculos!"}</p>
      ${r.subidas.map((s) => `
        <div class="resumen-subida">
          ${insigniaRango(s.despues, 44, `resumen-${s.musculo}`)}
          <span class="resumen-subida-texto">
            <strong>${escapar(s.nombre)}</strong>
            <span>${s.antes === null ? "" : `${escapar(nombreRango(RANGOS[s.antes].desde, sexo))} → `}${escapar(nombreRango(s.nivel, sexo))}</span>
          </span>
        </div>`).join("")}
    </div>`;
  const musculos = r.musculos.length === 0 ? "" : `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Músculos que trabajaste</p>
      <div class="resumen-musculos">
        ${r.musculos.map((m) => `<span class="resumen-musculo${m.principal ? " principal" : ""}">${escapar(m.nombre)}</span>`).join("")}
      </div>
    </div>`;
  const nota = r.enTelefono
    ? `<p class="registro-pendientes">📱 Se guardó en tu teléfono y se enviará ${cuandoSeEnvia()}.</p>`
    : "";
  return `
    <div class="resumen">
      <p class="resumen-emoji" aria-hidden="true">${r.subidas.length > 0 ? "🏆" : "🎉"}</p>
      <p class="resumen-titulo">¡Entrenamiento terminado!</p>
      ${r.dia ? `<p class="resumen-dia">${escapar(r.dia)}</p>` : ""}
    </div>
    ${nota}
    ${datos}
    ${subidas}
    ${musculos}
    <button class="boton" data-accion="listo">Listo</button>
    <button class="boton secundario resumen-musculos-boton" data-accion="ver-musculos">💪 Ver mis músculos</button>`;
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
  if (estado.vista === "resumen" && !estado.resumen) estado.vista = "inicio";
  const cuerpo = estado.vista === "resumen" && estado.resumen ? vistaResumen(estado.resumen, d.sexo === "M" ? "M" : "H")
    : estado.vista === "elegir" ? vistaElegir(d)
    : estado.vista === "capturar" ? vistaCapturar(d)
    : estado.vista === "historial" ? vistaHistorial(d)
    : estado.vista === "cardio" ? vistaCardio(d)
    : estado.vista === "cardio-datos" ? vistaCardioDatos(d)
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
  /** Manda ya lo que está en la cola, sin esperar al siguiente intento (`enviarCola`). */
  enviarAhora?: () => void;
  /** Al iniciar un entrenamiento nuevo: marca su asistencia de hoy (`marcarAsistencia`). */
  alIniciar?: () => void;
  /**
   * Cada cambio de pantalla, para que el gesto de "atrás" las recorra (`irSub` de
   * `navegacion.ts`). `marcar` anota la pantalla en la que quedó sin moverse.
   */
  navegar?: (vista: Vista, modo: "adelante" | "volver" | "reemplazar" | "marcar") => void;
  /** "Ver mis músculos" del resumen: abre la ventana Músculos. */
  verMusculos?: () => void;
  /** Quita el modo sin datos (`sinDatos.ts`), desde el aviso al terminar con el modo puesto. */
  apagarSinDatos?: () => void;
  /** Los entrenamientos de esta clienta que esperan en la cola, para agregarles el cardio del día. */
  pendientes?: () => Envio[];
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
  if (!siguiendoGrupo) {
    window.addEventListener("scroll", seguirGrupo, { passive: true });
    siguiendoGrupo = true;
  }
  // Cada repintado vuelve a poner el primer grupo: se corrige con lo que ya se bajó.
  seguirGrupo();

  const ir = (vista: Vista, modo: "adelante" | "volver" | "reemplazar" = "volver") => {
    recordarPosicionElegir();
    estado.vista = vista;
    estado.error = null;
    if (vista !== "historial") estado.aviso = null;
    acciones.navegar?.(vista, modo);
    repintar();
    // Cada pantalla arranca arriba, menos "elegir", que vuelve a donde se quedó.
    window.scrollTo(0, vista === "elegir" ? posicionElegir : 0);
  };
  // La pantalla en la que quedó (puede haberla decidido `ventanaRegistro` sola).
  acciones.navegar?.(estado.vista, "marcar");

  /**
   * Abre en grande otro ejercicio del entrenamiento: tocando su fila comprimida, con
   * Anterior/Siguiente o deslizando la tarjeta (`lateral`). Su GIF chico vuela y crece hasta
   * el lugar del activo.
   */
  const activar = (i: number, lateral: boolean) => {
    const b = estado.borrador;
    if (!b) return;
    // Se va de unidad en unidad: una biserie se abre entera, por su primer ejercicio.
    const us = unidades(b);
    const actual = us.findIndex((u) => u.includes(indiceActivo(b)));
    const destino = us.findIndex((u) => u.includes(i));
    if (!Number.isInteger(i) || destino < 0 || destino === actual) return;
    const primero = us[destino][0];
    const origen = raiz.querySelector<HTMLElement>(`.registro-compacto[data-activar="${primero}"] .registro-compacto-gif`);
    estado.vuelo?.remove();
    estado.vuelo = despegar(origen);
    estado.avanzando = destino > actual;
    estado.lateral = lateral;
    estado.activo = primero;
    estado.enfocar = primero;
    estado.menuSerie = null;
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
    if (accion === "cardio") {
      estado.cardio = null;
      estado.avisoCardio = null;
      ir("cardio", "adelante");
      return;
    }
    if (el.dataset.cardio) {
      const id = el.dataset.cardio;
      // Abre con lo de la última vez que la usó: casi siempre repite.
      const previa = ultimasSeries(d.sesiones ?? [], id)?.[0];
      const texto = (n: number | undefined) => (n === undefined ? "" : String(n));
      estado.cardio = previa
        ? { id, minutos: String(previa.reps), inclinacion: texto(previa.inclinacion), velocidad: texto(previa.velocidad) }
        : { id, minutos: "", inclinacion: "", velocidad: "" };
      ir("cardio-datos", "adelante");
      return;
    }
    if (accion === "guardar-cardio" && estado.cardio) {
      const m = d.banco.find((x) => x.id === estado.cardio?.id);
      if (!m) return;
      const ahora = Date.now();
      const r = envioCardio(m, estado.cardio, idNuevo(), d.hoy, ahora);
      if (!r.ok) { estado.error = r.error; repintar(); return; }
      if (b && !b.edicion) {
        // Con un entrenamiento abierto se agrega a ese y se abre en grande.
        const nuevo = agregarCardio(b, m, estado.cardio);
        guardarBorrador({ ...nuevo, anotado: ahora });
        estado.activo = nuevo.ejercicios.findIndex((x) => x.ejercicioId === m.id);
        estado.cardio = null;
        ir("capturar", "reemplazar");
        return;
      }
      // Sin entrenamiento abierto, se agrega al que ya guardó hoy: se reenvía con el mismo id y
      // el servidor lo reescribe. Si hoy no hay ninguno, es uno propio. Las dos van por la cola,
      // así que sirven sin internet.
      const minutos = r.datos.ejercicios[0]?.series[0]?.reps ?? 0;
      const delDia = entrenamientoDelDia(d.sesiones ?? [], acciones.pendientes?.() ?? [], d.hoy, d.banco);
      acciones.encolar?.(delDia ? sumarCardio(delDia, r.datos.ejercicios[0], ahora) : r.datos);
      acciones.enviarAhora?.();
      estado.avisoCardio = delDia
        ? `🏃 Cardio agregado a tu entrenamiento de hoy: ${m.nombre}, ${minutos} min`
        : `🏃 Cardio guardado: ${m.nombre}, ${minutos} min`;
      estado.cardio = null;
      estado.guardado = false;
      estado.cierreAuto = null;
      ir("inicio", "reemplazar");
      return;
    }
    if (accion === "iniciar") {
      estado.avisoCardio = null;
      estado.guardado = false;
      estado.cierreAuto = null;
      if (!b) {
        guardarBorrador(nuevoBorrador(idNuevo(), d.hoy, Date.now()));
        acciones.alIniciar?.();
        posicionElegir = 0;
      }
      ir("capturar", "adelante");
      return;
    }
    if (accion === "agregar" && b) {
      // Siempre abre en "Un ejercicio": la biserie es la excepción.
      estado.modoElegir = "uno";
      estado.seleccion = [];
      estado.menuSerie = null;
      ir("elegir", "adelante");
      return;
    }
    if (accion === "listo" || accion === "ver-musculos") {
      estado.resumen = null;
      estado.guardado = false;
      if (accion === "ver-musculos" && acciones.verMusculos) {
        estado.vista = "inicio";
        acciones.verMusculos();
        return;
      }
      ir("inicio");
      return;
    }
    if (accion === "historial") { estado.guardado = false; estado.aviso = null; ir("historial", "adelante"); return; }
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
      /** El resumen se arma con lo que había antes de guardar: así se ve qué subió de rango. */
      const resumir = (enTelefono: boolean): void => {
        const previas = d.sesiones ?? [];
        const fuerza = d.fuerza ?? (() => ({}));
        estado.resumen = {
          ...armarResumen({
            envio: datos,
            iniciado: b.iniciado,
            terminado: datos.terminadaEn ?? Date.now(),
            banco: d.banco,
            fuerzaAntes: fuerza(previas),
            fuerzaDespues: fuerza([sesionDeEnvio(datos, b.fecha, d.banco), ...previas]),
            enTelefono,
            guiado: b.guiado !== undefined,
          }),
          dia: b.guiado?.nombreDia || null,
        };
      };
      /** Sin internet: se queda en el teléfono y se manda solo cuando vuelva la señal. */
      const enTelefono = (): void => {
        acciones.encolar?.(datos);
        estado.enVuelo = false;
        resumir(true);
        guardarBorrador(null);
        estado.guardado = "en-telefono";
        ir("resumen", "reemplazar");
        if (modoSinDatos()) mostrarTerminadoSinDatos(acciones.apagarSinDatos);
      };
      const puedeEsperar = !edicion && acciones.encolar !== undefined;
      // Si el teléfono ya sabe que no hay red, ni se intenta: sería esperar a que falle.
      if (puedeEsperar && (navigator.onLine === false || modoSinDatos())) { enTelefono(); return; }
      // Uno nuevo no espera al servidor (tarda 1 a 4 s): se guarda en la cola del teléfono, sale
      // el resumen al instante y la cola lo manda por detrás (`enviarAhora`), con sus
      // reintentos. Mandarlo dos veces no lo duplica: el id lo pone el borrador.
      if (puedeEsperar && acciones.enviarAhora) {
        acciones.encolar!(datos);
        resumir(false);
        guardarBorrador(null);
        estado.guardado = "enviado";
        ir("resumen", "reemplazar");
        acciones.enviarAhora();
        return;
      }
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
            resumir(false);
            estado.guardado = "enviado";
            ir("resumen", "reemplazar");
          }
        },
        (error) => {
          if (puedeEsperar && !rechazoDefinitivo(error)) { enTelefono(); return; }
          // El borrador se queda: con señal de vuelta, "Guardar" reescribe la misma sesión.
          estado.enVuelo = false;
          estado.error = modoSinDatos()
            ? "Estás en modo sin datos: desactívalo en Ajustes para guardar los cambios. Lo que anotaste sigue aquí."
            : "No se pudo guardar. Revisa tu conexión e intenta otra vez; lo que anotaste sigue aquí.";
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
      ir("capturar", "adelante");
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
          estado.error = modoSinDatos()
            ? "Estás en modo sin datos: desactívalo en Ajustes para eliminarlo."
            : "No se pudo eliminar. Revisa tu conexión e intenta otra vez.";
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

    // "¿Qué ejercicio hiciste?" en modo biserie: elegir la A y la B, y agregarlas.
    if (el.dataset.modo === "uno" || el.dataset.modo === "biserie") {
      estado.modoElegir = el.dataset.modo;
      estado.seleccion = [];
      repintar();
      return;
    }
    if (el.dataset.biserieElegir !== undefined) {
      const elegido = el.dataset.biserieElegir;
      const sel = estado.seleccion;
      // Tocar uno marcado lo desmarca; con los dos ya elegidos, el nuevo reemplaza a la B.
      estado.seleccion = sel.includes(elegido) ? sel.filter((x) => x !== elegido)
        : sel.length < 2 ? [...sel, elegido] : [sel[0], elegido];
      repintar();
      return;
    }
    if (accion === "agregar-biserie" && b) {
      recordarPosicionElegir();
      const [ea, ec] = estado.seleccion.map((x) => d.banco.find((e) => e.id === x));
      if (!ea || !ec) return;
      const con = (e: EjercicioBanco) => ({ e, previas: ultimasSeries(d.sesiones ?? [], e.id), seriesRutina: seriesDeLaRutina(d, e) });
      const nuevo = agregarBiserie(b, con(ea), con(ec));
      if (nuevo === b) return;
      guardarBorrador(nuevo);
      const iA = nuevo.ejercicios.findIndex((x) => x.ejercicioId === ea.id);
      estado.activo = iA;
      estado.enfocar = iA;
      estado.avanzando = true;
      estado.lateral = false;
      estado.vuelo?.remove();
      estado.vuelo = despegar(raiz.querySelector<HTMLElement>(`[data-biserie-elegir="${ea.id}"] .registro-opcion-gif`));
      estado.modoElegir = "uno";
      estado.seleccion = [];
      estado.vista = "capturar";
      estado.error = null;
      acciones.navegar?.("capturar", "volver");
      repintar();
      return;
    }

    const id = el.dataset.agregar;
    if (id && b) {
      recordarPosicionElegir();
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
      acciones.navegar?.("capturar", "volver");
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
    if (el.dataset.quitarBiserie !== undefined) {
      const iA = Number(el.dataset.quitarBiserie);
      const nombres = [iA, iA + 1].map((i) => b.ejercicios[i]?.nombre).filter(Boolean).join(" y ");
      if (!confirm(`¿Quitar la biserie de ${nombres} y lo que anotaste en ella?`)) return;
      guardarBorrador(quitarBloque(b, iA));
      // Queda abierto lo que estaba debajo (o lo anterior si era lo último).
      estado.activo = iA;
      estado.menuSerie = null;
      repintar();
      return;
    }
    if (el.dataset.agregarRonda !== undefined) {
      guardarBorrador(agregarRonda(b, Number(el.dataset.agregarRonda)));
      repintar();
      return;
    }
    if (el.dataset.quitarRonda !== undefined) {
      const [i, j] = el.dataset.quitarRonda.split(":").map(Number);
      guardarBorrador(quitarRonda(b, i, j));
      estado.menuSerie = null;
      repintar();
      return;
    }
    // Dropset: tocar el número de la serie abre "↓ Agregar bajada"; tocarlo otra vez lo cierra.
    if (el.dataset.menuSerie !== undefined) {
      const serie = el.dataset.menuSerie;
      estado.menuSerie = serie === "" || serie === estado.menuSerie ? null : serie;
      repintar();
      return;
    }
    if (el.dataset.agregarCaida !== undefined) {
      const [i, j] = el.dataset.agregarCaida.split(":").map(Number);
      const nuevo = agregarCaida(b, i, j);
      guardarBorrador(nuevo);
      estado.menuSerie = null;
      // Ya sabe que el número se toca: la pista sobra.
      try { localStorage.setItem(LLAVE_PISTA_DROP, "1"); } catch { /* se seguirá mostrando */ }
      repintar();
      // Directo a escribir el peso de la bajada nueva.
      const k = (nuevo.ejercicios[i]?.series[j]?.caidas?.length ?? 1) - 1;
      document.querySelector<HTMLInputElement>(
        `#registro input[data-ej="${i}"][data-serie="${j}"][data-caida="${k}"][data-campo="${nuevo.ejercicios[i]?.tipo === "tiempo" ? "reps" : "peso"}"]`
      )?.focus();
      return;
    }
    if (el.dataset.quitarCaida !== undefined) {
      const [i, j, k] = el.dataset.quitarCaida.split(":").map(Number);
      guardarBorrador(quitarCaida(b, i, j, k));
      repintar();
      return;
    }
    if (el.dataset.quitarSerie !== undefined) {
      const [i, j] = el.dataset.quitarSerie.split(":").map(Number);
      guardarBorrador(quitarSerie(b, i, j));
      estado.menuSerie = null;
      repintar();
    }
  });

  raiz.addEventListener("input", (ev) => {
    const input = ev.target as HTMLInputElement;
    const { ej, serie, campo, caida } = input.dataset;
    const cardio = input.dataset.cardioCampo;
    if (estado.cardio && (cardio === "minutos" || cardio === "inclinacion" || cardio === "velocidad")) {
      estado.cardio = { ...estado.cardio, [cardio]: input.value };
      return;
    }
    if (!estado.borrador || ej === undefined || serie === undefined) return;
    if (campo !== "reps" && campo !== "peso" && campo !== "inclinacion" && campo !== "velocidad") return;
    const cambiado = caida === undefined
      ? cambiarSerie(estado.borrador, Number(ej), Number(serie), campo, input.value)
      : campo === "reps" || campo === "peso"
        ? cambiarCaida(estado.borrador, Number(ej), Number(serie), Number(caida), campo, input.value)
        : estado.borrador;
    // La hora de su última anotación: con la que se cierra si se olvida de terminarlo.
    guardarBorrador({ ...cambiado, anotado: Date.now() });
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
    const { ej, serie, caida } = input.dataset;
    const tipo = estado.borrador?.ejercicios[Number(ej)]?.tipo;
    if (tipo === undefined) return;
    const reps = repsDudosas(input.value, tipo);
    const clave = `${ej}:${serie}:${caida ?? ""}:${reps}`;
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
        .querySelector<HTMLInputElement>(
          `#registro input[data-ej="${ej}"][data-serie="${serie}"]${caida === undefined ? ":not([data-caida])" : `[data-caida="${caida}"]`}[data-campo="reps"]`
        )
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
    const us = unidades(estado.borrador);
    const ua = us.findIndex((u) => u.includes(indiceActivo(estado.borrador!)));
    conectarDeslizar(
      raiz.querySelector<HTMLElement>(".registro-ejercicio.activo"),
      (hacia) => {
        const destino = us[ua + (hacia === "siguiente" ? 1 : -1)];
        if (destino) activar(destino[0], true);
      }
    );
  }
}
