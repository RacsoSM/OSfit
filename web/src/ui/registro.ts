import type { ConfigGrupos, Ejercicio, EjercicioBanco, Sesion } from "../datos";
import { claveBanco, urlGif, type IndiceBanco } from "../banco";
import { seccionesRegistro } from "../grupos";
import {
  agregarEjercicio,
  agregarSerie,
  cambiarSerie,
  idNuevo,
  leerBorrador,
  nuevoBorrador,
  paraEnviar,
  quitarEjercicio,
  quitarSerie,
  ultimasSeries,
  type Borrador,
  type EjercicioBorrador,
  type Envio,
  type SerieBorrador,
} from "../registro";
import { escapar } from "./tarjetaDia";

/**
 * La ventana Registro: la clienta anota lo que entrenó con su coach en el gym, por
 * **entrenamientos** (decisión del entrenador, 2026-10-10): toca "Iniciar entrenamiento", va
 * agregando ejercicios y al final "Terminar entrenamiento". Cada entrenamiento queda en su
 * historial con su fecha, la hora en que empezó y en que terminó.
 *
 * Vistas dentro de la misma ventana:
 *  - **inicio**: el botón "Iniciar entrenamiento" y la entrada al historial.
 *  - **capturar**: el entrenamiento en curso, con sus ejercicios y las series de peso y reps.
 *    Mientras hay uno abierto, Registro se abre aquí.
 *  - **elegir**: un grid con nombre y GIF, agrupado: primero los grupos que le tocan hoy según
 *    el nombre del día ("Pecho, hombro y tríceps" → Pecho, Hombro, Tríceps), con los
 *    ejercicios que el entrenador configuró para cada uno; luego los demás grupos. Lo que ya
 *    está en el entrenamiento sale en gris y no se puede volver a elegir.
 *  - **historial**: sus entrenamientos guardados, del más nuevo al más viejo.
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
}

type Vista = "inicio" | "historial" | "elegir" | "capturar";

interface Estado {
  vista: Vista;
  borrador: Borrador | null;
  enVuelo: boolean;
  error: string | null;
  guardado: boolean;
  /** El ejercicio recién agregado, para llevarle la vista al pintar. */
  enfocar: number | null;
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
};

/** Solo para los tests: poner la ventana en una vista y con un borrador dados. */
export function ponerEstadoRegistro(parcial: Partial<Pick<Estado, "vista" | "borrador" | "error">>): void {
  Object.assign(estado, { guardado: false, enVuelo: false, error: null }, parcial);
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
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">${escapar(enPalabras(s.fecha))}</p>
      <p class="registro-hist-horario">${escapar(cuando ? `${cuando} · ${cuantos}` : cuantos)}</p>
      <ul class="registro-hist">${filas}</ul>
    </div>`;
}

function vistaInicio(d: DatosRegistro): string {
  const aviso = estado.guardado ? `<p class="aviso-ok">¡Entrenamiento guardado! 💪</p>` : "";
  const ultima = d.sesiones?.[0];
  const total = d.sesiones?.length ?? 0;
  const historial = d.sesiones === null
    ? `<p class="accion-nota" style="text-align:center">Cargando tu historial…</p>`
    : total === 0
      ? `<p class="accion-nota" style="text-align:center">Aquí se van a ir guardando tus entrenamientos.</p>`
      : `<button class="tarjeta registro-ir-historial" data-accion="historial">
           <span>
             <span class="tarjeta-titulo">Tu historial</span>
             <span class="registro-ir-detalle">Último: ${escapar(enPalabras(ultima!.fecha))} · ${total === 1 ? "1 entrenamiento" : `${total} entrenamientos`}</span>
           </span>
           <span aria-hidden="true">›</span>
         </button>`;
  return `
    ${aviso}
    <div class="tarjeta registro-iniciar">
      <div class="vacio-emoji">🏋️</div>
      <p class="confirmar-titulo">¿Lista para entrenar?</p>
      <p class="accion-nota">Inicia tu entrenamiento y ve anotando cada ejercicio que hagas.</p>
      <button class="boton" data-accion="iniciar" style="margin-top:14px">▶ Iniciar entrenamiento</button>
    </div>
    ${historial}`;
}

function vistaHistorial(d: DatosRegistro): string {
  const lista = d.sesiones === null
    ? `<p class="accion-nota" style="text-align:center">Cargando tu historial…</p>`
    : d.sesiones.length === 0
      ? `<p class="accion-nota" style="text-align:center">Todavía no tienes entrenamientos guardados.</p>`
      : d.sesiones.map((s) => tarjetaSesion(s, d.banco)).join("");
  return `
    <button class="boton-texto registro-volver" data-accion="volver">← Volver</button>
    <p class="confirmar-titulo" style="margin-bottom:12px">Tu historial</p>
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
  const peso = e.tipo === "tiempo" ? "" : `
    <label class="registro-campo">
      <input inputmode="decimal" data-ej="${i}" data-serie="${j}" data-campo="peso"
             value="${escapar(s.peso)}" placeholder="${e.tipo === "corporal" ? "+0" : "0"}" aria-label="Serie ${j + 1}, kilos">
      <span>kg</span>
    </label>
    <span class="registro-por" aria-hidden="true">×</span>`;
  return `
    <div class="registro-serie">
      <span class="registro-serie-num">${j + 1}</span>
      ${peso}${reps}
      <button class="registro-quitar" data-quitar-serie="${i}:${j}" aria-label="Quitar serie ${j + 1}">✕</button>
    </div>`;
}

function tarjetaCaptura(e: EjercicioBorrador, i: number): string {
  const nota = e.tipo === "corporal"
    ? `<p class="accion-nota">Con tu peso corporal. En kg, solo si agregaste peso extra.</p>`
    : "";
  return `
    <div class="tarjeta registro-ejercicio" data-indice="${i}">
      <div class="registro-ej-cabecera">
        ${gif(e.gifRuta, "registro-ej-gif", 64)}
        <strong class="registro-ej-nombre">${escapar(e.nombre)}</strong>
        <button class="registro-quitar" data-quitar-ej="${i}" aria-label="Quitar ${escapar(e.nombre)}">✕</button>
      </div>
      ${nota}
      ${e.series.map((s, j) => filaSerie(e, i, s, j)).join("")}
      <button class="registro-mas-serie" data-agregar-serie="${i}">+ Serie</button>
    </div>`;
}

function vistaCapturar(): string {
  const b = estado.borrador;
  if (!b) return "";
  const error = estado.error ? `<p class="aviso-error" style="margin:0 0 12px">${escapar(estado.error)}</p>` : "";
  const desde = horaDeMs(b.iniciado);
  const hay = b.ejercicios.length > 0;
  const vacio = hay ? "" : `
    <div class="tarjeta vacio">
      <p><strong>Agrega tu primer ejercicio</strong></p>
      <p style="color: var(--texto-tenue); font-size: 14px">Elige el que te puso tu coach y anota tus series.</p>
    </div>`;
  const off = estado.enVuelo ? "disabled" : "";
  return `
    <div class="registro-en-curso">
      <p class="confirmar-titulo">Entrenamiento en curso</p>
      <p class="accion-nota" style="margin:2px 0 12px">${escapar(enPalabras(b.fecha))}${desde ? ` · desde las ${escapar(desde)}` : ""}</p>
    </div>
    ${b.ejercicios.map(tarjetaCaptura).join("")}
    ${vacio}
    ${error}
    <button class="boton${hay ? " secundario" : ""}" data-accion="agregar" ${off}>+ Agregar ejercicio</button>
    ${hay ? `<button class="boton" data-accion="guardar" ${off}>${estado.enVuelo ? "Guardando…" : "Terminar entrenamiento"}</button>` : ""}
    <button class="boton-texto" data-accion="descartar" ${off}>Descartar entrenamiento</button>
    ${hay ? CREDITO : ""}`;
}

/** Lo que va en `#contenido` con Registro abierto. */
export function ventanaRegistro(d: DatosRegistro): string {
  // Con un entrenamiento abierto, Registro se abre en él; sin uno, no hay qué capturar ni elegir.
  if (estado.vista === "inicio" && estado.borrador) estado.vista = "capturar";
  if ((estado.vista === "capturar" || estado.vista === "elegir") && !estado.borrador) estado.vista = "inicio";
  const cuerpo = estado.vista === "elegir" ? vistaElegir(d)
    : estado.vista === "capturar" ? vistaCapturar()
    : estado.vista === "historial" ? vistaHistorial(d)
    : vistaInicio(d);
  return `<div id="registro" class="registro">${cuerpo}</div>`;
}

// ── Conectar ─────────────────────────────────────────────────────────────────

function seriesDeLaRutina(d: DatosRegistro, e: EjercicioBanco): number | null {
  const enRutina = d.dia?.ejercicios.find((x) => d.indice.get(claveBanco(x.nombre))?.id === e.id);
  return enRutina && enRutina.series > 0 ? enRutina.series : null;
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
  guardar: (envio: Envio) => Promise<unknown>
): void {
  const raiz = document.querySelector<HTMLElement>("#registro");
  if (!raiz) return;

  const ir = (vista: Vista) => {
    estado.vista = vista;
    estado.error = null;
    repintar();
    window.scrollTo(0, 0);
  };

  raiz.addEventListener("click", (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>("button");
    if (!el || el.hasAttribute("disabled")) return;
    const b = estado.borrador;

    const accion = el.dataset.accion;
    if (accion === "iniciar") {
      estado.guardado = false;
      if (!b) guardarBorrador(nuevoBorrador(idNuevo(), d.hoy, Date.now()));
      ir("capturar");
      return;
    }
    if (accion === "agregar" && b) { ir("elegir"); return; }
    if (accion === "historial") { estado.guardado = false; ir("historial"); return; }
    // Volver siempre lleva al entrenamiento si hay uno abierto, y si no, al inicio de Registro.
    if (accion === "volver") { ir(b ? "capturar" : "inicio"); return; }
    if (accion === "descartar") {
      if (b && b.ejercicios.length > 0 && !confirm("¿Descartar este entrenamiento y lo que llevas anotado?")) return;
      guardarBorrador(null);
      ir("inicio");
      return;
    }
    if (accion === "guardar" && b) {
      const envio = paraEnviar(b);
      if (!envio.ok) { estado.error = envio.error; repintar(); return; }
      estado.enVuelo = true;
      estado.error = null;
      repintar();
      guardar(envio.datos).then(
        () => {
          estado.enVuelo = false;
          estado.guardado = true;
          guardarBorrador(null);
          ir("inicio");
        },
        () => {
          // El borrador se queda: con señal de vuelta, "Guardar" reescribe la misma sesión.
          estado.enVuelo = false;
          estado.error = "No se pudo guardar. Revisa tu conexión e intenta otra vez; lo que anotaste sigue aquí.";
          repintar();
        }
      );
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
      estado.vista = "capturar";
      estado.error = null;
      repintar();
      return;
    }
    if (!b) return;
    if (el.dataset.quitarEj !== undefined) {
      guardarBorrador(quitarEjercicio(b, Number(el.dataset.quitarEj)));
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

  if (estado.vista === "capturar" && estado.enfocar !== null) {
    const tarjeta = raiz.querySelector<HTMLElement>(`.registro-ejercicio[data-indice="${estado.enfocar}"]`);
    estado.enfocar = null;
    tarjeta?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}
