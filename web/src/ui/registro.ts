import type { Ejercicio, EjercicioBanco, Sesion } from "../datos";
import { buscarEnBanco, claveBanco, delBanco, urlGif, type IndiceBanco } from "../banco";
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
 * La ventana Registro: la clienta anota lo que entrenó con su coach en el gym.
 *
 * Tres vistas dentro de la misma ventana:
 *  - **historial**: sus sesiones guardadas y el botón "Agregar ejercicio".
 *  - **elegir**: un grid con nombre y GIF. Arriba, los ejercicios de su día de hoy; abajo, un
 *    buscador del banco completo, porque el coach puede ponerle algo que no está en su rutina.
 *  - **capturar**: los ejercicios que va agregando, cada uno con sus series de peso y reps.
 *    Desde ahí vuelve al grid por el siguiente, hasta que toca "Guardar".
 *
 * Los GIF van aquí y no en la tarjeta de Inicio (decisión del entrenador, 2026-10-10): sirven
 * para reconocer qué ejercicio hizo, no para leer la rutina.
 *
 * El estado vive en el módulo y no en `main.ts`, como en `accionFalta.ts`: un snapshot que
 * repinta a destiempo no debe sacarla de la vista donde estaba. El borrador además se guarda en
 * el navegador en cada cambio, para que cerrar la pestaña o quedarse sin señal no le borre lo
 * que lleva anotado.
 */

export interface DatosRegistro {
  hoy: string;
  /** El día que le toca hoy según su rutina, o null (fin de semana, descanso, sin rutina). */
  dia: { nombreDia: string; ejercicios: Ejercicio[] } | null;
  banco: readonly EjercicioBanco[];
  indice: IndiceBanco;
  /** null mientras no llegan. */
  sesiones: Sesion[] | null;
}

type Vista = "historial" | "elegir" | "capturar";

interface Estado {
  vista: Vista;
  busqueda: string;
  borrador: Borrador | null;
  enVuelo: boolean;
  error: string | null;
  guardado: boolean;
  /** El ejercicio recién agregado, para llevarle la vista al pintar. */
  enfocar: number | null;
}

const LLAVE_BORRADOR = "osfit:registro-borrador";

const estado: Estado = {
  vista: "historial",
  busqueda: "",
  borrador: (() => {
    try { return leerBorrador(localStorage.getItem(LLAVE_BORRADOR)); } catch { return null; }
  })(),
  enVuelo: false,
  error: null,
  guardado: false,
  enfocar: null,
};

/** Solo para los tests: poner la ventana en una vista y con un borrador dados. */
export function ponerEstadoRegistro(parcial: Partial<Pick<Estado, "vista" | "borrador" | "busqueda" | "error">>): void {
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

function gif(ruta: string | null | undefined, clase: string, lado: number): string {
  const url = urlGif(ruta);
  // `alt` vacío: el nombre va justo al lado y un lector de pantalla lo diría dos veces.
  return url
    ? `<img class="${clase}" src="${escapar(url)}" alt="" width="${lado}" height="${lado}" loading="lazy" decoding="async">`
    : `<span class="${clase} registro-sin-gif" aria-hidden="true">🏋️</span>`;
}

/** Los términos del dataset piden el crédito junto a las animaciones, donde se muestren. */
const CREDITO = `<p class="registro-credito">Animaciones © Gym visual</p>`;

// ── Historial ────────────────────────────────────────────────────────────────

function textoSerie(s: { reps: number; peso: number | null }, tipo: "tiempo" | "otro"): string {
  if (tipo === "tiempo") return `${s.reps} s`;
  return s.peso === null ? `× ${s.reps}` : `${s.peso} kg × ${s.reps}`;
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
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">${escapar(enPalabras(s.fecha))}</p>
      <ul class="registro-hist">${filas}</ul>
    </div>`;
}

function vistaHistorial(d: DatosRegistro): string {
  const pendientes = estado.borrador?.ejercicios.length ?? 0;
  const aviso = estado.guardado
    ? `<p class="aviso-ok">¡Entrenamiento guardado! 💪</p>`
    : "";
  const continuar = pendientes > 0
    ? `<div class="tarjeta">
         <p class="confirmar-titulo">Tienes un registro sin guardar</p>
         <p class="accion-nota">${pendientes === 1 ? "1 ejercicio anotado" : `${pendientes} ejercicios anotados`}.</p>
         <button class="boton" data-accion="continuar" style="margin-top:12px">Continuar</button>
       </div>`
    : `<button class="boton registro-agregar" data-accion="agregar">+ Agregar ejercicio</button>`;

  let historial: string;
  if (d.sesiones === null) {
    historial = `<p class="accion-nota" style="text-align:center">Cargando tu historial…</p>`;
  } else if (d.sesiones.length === 0) {
    historial = `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">📝</div>
        <p><strong>Todavía no registras nada</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">
          Cuando entrenes, toca “Agregar ejercicio” y anota tus series.
        </p>
      </div>`;
  } else {
    historial = d.sesiones.map((s) => tarjetaSesion(s, d.banco)).join("");
  }
  return `${aviso}${continuar}<p class="accion-subtitulo registro-subtitulo">Tu historial</p>${historial}`;
}

// ── Elegir ───────────────────────────────────────────────────────────────────

function opcion(e: EjercicioBanco): string {
  const ya = estado.borrador?.ejercicios.some((x) => x.ejercicioId === e.id) ?? false;
  return `
    <button class="registro-opcion${ya ? " agregado" : ""}" data-agregar="${escapar(e.id)}">
      ${gif(e.gifRuta, "registro-opcion-gif", 160)}
      <span class="registro-opcion-nombre">${escapar(e.nombre)}</span>
      ${ya ? `<span class="registro-opcion-ya">✓ Agregado</span>` : ""}
    </button>`;
}

function resultados(d: DatosRegistro): string {
  if (estado.busqueda.trim() === "") return "";
  const encontrados = buscarEnBanco(estado.busqueda, d.banco);
  if (encontrados.length === 0) {
    return `<p class="accion-nota">No encontramos “${escapar(estado.busqueda.trim())}”. Prueba con otra palabra.</p>`;
  }
  return `<div class="registro-grid">${encontrados.map(opcion).join("")}</div>`;
}

function vistaElegir(d: DatosRegistro): string {
  const delDia = d.dia ? delBanco(d.dia.ejercicios.map((e) => e.nombre), d.indice) : [];
  const deHoy = d.dia
    ? `<p class="accion-subtitulo registro-subtitulo">De tu día de hoy · ${escapar(d.dia.nombreDia)}</p>
       ${delDia.length > 0
         ? `<div class="registro-grid">${delDia.map(opcion).join("")}</div>`
         : `<p class="accion-nota">Los ejercicios de tu día no están en el catálogo todavía. Búscalos abajo.</p>`}`
    : "";
  const cargando = d.banco.length === 0
    ? `<p class="accion-nota">Cargando ejercicios…</p>`
    : "";
  return `
    <button class="boton-texto registro-volver" data-accion="volver">← Volver</button>
    <p class="confirmar-titulo">¿Qué ejercicio hiciste?</p>
    ${cargando}
    ${deHoy}
    <p class="accion-subtitulo registro-subtitulo">Buscar otro ejercicio</p>
    <input id="registro-buscar" class="campo-libre" type="search" enterkeyhint="search"
           placeholder="Ej. sentadilla, jalón, curl…" value="${escapar(estado.busqueda)}" autocomplete="off">
    <div id="registro-resultados">${resultados(d)}</div>
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
  if (!b || b.ejercicios.length === 0) return "";
  const error = estado.error ? `<p class="aviso-error" style="margin:0 0 12px">${escapar(estado.error)}</p>` : "";
  return `
    <p class="confirmar-titulo" style="margin-bottom:12px">Tu entrenamiento</p>
    ${b.ejercicios.map(tarjetaCaptura).join("")}
    ${error}
    <button class="boton secundario" data-accion="agregar" ${estado.enVuelo ? "disabled" : ""}>+ Agregar otro ejercicio</button>
    <button class="boton" data-accion="guardar" ${estado.enVuelo ? "disabled" : ""}>
      ${estado.enVuelo ? "Guardando…" : "Guardar entrenamiento"}
    </button>
    <button class="boton-texto" data-accion="descartar" ${estado.enVuelo ? "disabled" : ""}>Descartar</button>
    ${CREDITO}`;
}

/** Lo que va en `#contenido` con Registro abierto. */
export function ventanaRegistro(d: DatosRegistro): string {
  // Sin ejercicios no hay nada que capturar: un borrador vacío vuelve al historial.
  if (estado.vista === "capturar" && !estado.borrador?.ejercicios.length) estado.vista = "historial";
  const cuerpo = estado.vista === "elegir" ? vistaElegir(d)
    : estado.vista === "capturar" ? vistaCapturar()
    : vistaHistorial(d);
  return `<div id="registro" class="registro">${cuerpo}</div>`;
}

// ── Conectar ─────────────────────────────────────────────────────────────────

function seriesDeLaRutina(d: DatosRegistro, e: EjercicioBanco): number | null {
  const enRutina = d.dia?.ejercicios.find((x) => d.indice.get(claveBanco(x.nombre))?.id === e.id);
  return enRutina && enRutina.series > 0 ? enRutina.series : null;
}

/**
 * Cuelga los eventos de la vista recién pintada. Uno solo, delegado en `#registro`: el
 * contenido se rehace con cada repintado y los resultados de búsqueda se reemplazan sin
 * repintar, así que colgarle un listener a cada botón obligaría a recolgarlos a mano.
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
    if (accion === "agregar") {
      estado.guardado = false;
      if (!b) guardarBorrador(nuevoBorrador(idNuevo(), d.hoy));
      estado.busqueda = "";
      ir("elegir");
      return;
    }
    if (accion === "continuar") { estado.guardado = false; ir("capturar"); return; }
    if (accion === "volver") { ir(b && b.ejercicios.length > 0 ? "capturar" : "historial"); return; }
    if (accion === "descartar") {
      if (!confirm("¿Descartar lo que llevas anotado?")) return;
      guardarBorrador(null);
      ir("historial");
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
          ir("historial");
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
    if (input.id === "registro-buscar") {
      estado.busqueda = input.value;
      const caja = raiz.querySelector("#registro-resultados");
      if (caja) caja.innerHTML = resultados(d);
      return;
    }
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
