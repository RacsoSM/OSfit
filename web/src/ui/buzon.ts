import type { EntradaBuzon } from "../datos";
import { escapar } from "./tarjetaDia";

/**
 * El apartado Notificaciones: todos los avisos que el entrenador le mandó, del más nuevo al más
 * viejo, con su fecha. Los guarda la función `enviarNotificacion` en `clientes/{id}/buzon` al
 * mandarlos; aquí solo se leen. Al tocar una notificación del teléfono la página abre aquí, con
 * ese aviso marcado (`resaltarAviso`).
 *
 * Si el aviso decía adónde llevar (el del resumen del mes), la tarjeta trae el botón para ir.
 */

/** El aviso que se tocó en el teléfono. Vive aquí y no en el DOM: cada snapshot repinta. */
let resaltado: string | null = null;
/** Ya se llevó la vista al aviso marcado: no se vuelve a mover el scroll en cada repintado. */
let yaSeMostro = false;

export function resaltarAviso(id: string | null): void {
  resaltado = id;
  yaSeMostro = false;
}

// ── Sin leer ────────────────────────────────────────────────────────────────────

/**
 * Hasta qué aviso ya vio (la fecha del más nuevo, en ms), guardado en el teléfono: abrir
 * Notificaciones las marca todas como leídas. Por teléfono y no en Firestore: la clienta no
 * escribe en su documento, y para el numerito de la campana basta.
 */
const LLAVE_VISTO = "osfit:buzon-visto";

const ms = (e: EntradaBuzon) => (e.fecha ? e.fecha.toDate().getTime() : Date.now());

export function leerVisto(almacen: Pick<Storage, "getItem"> | null): number {
  try {
    const n = Number(almacen?.getItem(LLAVE_VISTO));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Marca como vistas las que hay ahora; devuelve hasta cuándo quedó. */
export function marcarVistas(entradas: readonly EntradaBuzon[], almacen: Pick<Storage, "setItem"> | null, visto: number): number {
  const ultima = entradas.reduce((m, e) => Math.max(m, ms(e)), visto);
  if (ultima > visto) {
    try { almacen?.setItem(LLAVE_VISTO, String(ultima)); } catch { /* sin almacenamiento, el número vuelve al recargar */ }
  }
  return ultima;
}

/** Cuántas llegaron después de la última vez que abrió Notificaciones. */
export function sinLeer(entradas: readonly EntradaBuzon[] | null, visto: number): number {
  return entradas ? entradas.filter((e) => ms(e) > visto).length : 0;
}

/** Qué dice el botón según adónde lleva. Una ventana sin texto propio usa "Abrir". */
const ACCION: Readonly<Record<string, string>> = {
  resumenMensual: "Ver mi resumen",
  inicio: "Ir a Inicio",
  musculos: "Ver mis músculos",
  registro: "Ir a Registro",
  estadisticas: "Ver mis estadísticas",
  ranking: "Ver el ranking",
};

const ZONA = "America/Mazatlan";
const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d);

function restarDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * "Hoy · 9:05 a.m.", "Ayer · 6:30 p.m." o "lunes 3 de noviembre · 9:05 a.m." (con el año si no
 * es el de `hoy`). En hora de Mazatlán, como el resto de la página.
 */
export function fechaAviso(fecha: Date, hoy: string): string {
  const hora = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA, hour: "numeric", minute: "2-digit" }).format(fecha);
  const suDia = dia(fecha);
  if (suDia === hoy) return `Hoy · ${hora}`;
  if (suDia === restarDia(hoy)) return `Ayer · ${hora}`;
  const conAnio = suDia.slice(0, 4) !== hoy.slice(0, 4);
  const texto = new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA, weekday: "long", day: "numeric", month: "long", ...(conAnio ? { year: "numeric" } : {}),
  }).format(fecha);
  return `${texto} · ${hora}`;
}

function tarjeta(e: EntradaBuzon, hoy: string, marcado: string | null): string {
  const fecha = e.fecha ? fechaAviso(e.fecha.toDate(), hoy) : "Ahora";
  const ir = e.abrir
    ? `<button type="button" class="boton secundario aviso-ir" data-abrir-ventana="${escapar(e.abrir.ventana)}"
               data-abrir-mes="${escapar(e.abrir.mes ?? "")}">${escapar(ACCION[e.abrir.ventana] ?? "Abrir")}</button>`
    : "";
  return `
    <article class="tarjeta aviso${e.id === marcado ? " marcado" : ""}" data-aviso="${escapar(e.id)}">
      <p class="aviso-fecha">${escapar(fecha)}</p>
      <p class="aviso-titulo">${escapar(e.titulo)}</p>
      <p class="aviso-texto">${escapar(e.texto)}</p>
      ${ir}
    </article>`;
}

/** `null` mientras llegan. */
export function ventanaBuzon(entradas: readonly EntradaBuzon[] | null, hoy: string, marcado: string | null = resaltado): string {
  if (entradas === null) return `<p class="accion-nota" style="text-align:center">Cargando tus notificaciones…</p>`;
  if (entradas.length === 0) {
    return `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">🔔</div>
        <p><strong>Todavía no tienes notificaciones</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">Aquí se van a guardar los avisos de tus coaches.</p>
      </div>`;
  }
  return `<div class="buzon">${entradas.map((e) => tarjeta(e, hoy, marcado)).join("")}</div>`;
}

/** Los botones de "ir" y, la primera vez, la vista sobre el aviso tocado. */
export function conectarBuzon(abrir: (ventana: string, mes: string | null) => void): void {
  document.querySelectorAll<HTMLElement>("#contenido [data-abrir-ventana]").forEach((b) =>
    b.addEventListener("click", () => abrir(b.dataset.abrirVentana ?? "", b.dataset.abrirMes || null))
  );
  if (resaltado && !yaSeMostro) {
    const el = document.querySelector<HTMLElement>(`#contenido .aviso.marcado`);
    if (el) {
      yaSeMostro = true;
      el.scrollIntoView({ block: "center" });
    }
  }
}
