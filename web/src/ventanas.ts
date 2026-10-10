import type { Asistencia, Cliente, EjercicioBanco, LogroPersonalOtorgado, MedallaOtorgada, Sesion } from "./datos";
import type { IdEstilo } from "./estilo";
import type { Tirada } from "./tirada";
import { recordatorioPago } from "./pago";
import { diaDeHoy, tarjetaDia } from "./ui/tarjetaDia";
import { ventanaRegistro, type DatosRegistro } from "./ui/registro";
import type { IndiceBanco } from "./banco";
import { tarjetaRecordatorioPago } from "./ui/tarjetaRecordatorioPago";
import { tarjetasStats } from "./ui/tarjetasStats";
import { accionDia, hojaDeMotivosAbierta } from "./ui/accionDia";
import { accionHoyNoPuedo, tarjetaRevivir } from "./ui/accionFalta";
import { calendario } from "./ui/calendario";
import { seccionVacia, tarjetaLogrosPersonales, tarjetaMedallas } from "./ui/tarjetaInsignias";
import { tarjetaRanking, type EstadoRanking } from "./ui/tarjetaRanking";
import { tarjetaAjustes } from "./ui/tarjetaAjustes";
import { invitacionNotificaciones, seccionNotificaciones } from "./ui/tarjetaNotificaciones";
import type { EstadoNotificaciones } from "./notificaciones";
import { tarjetaMusculos, type EstadoSvg } from "./ui/mapaMuscular";

/**
 * Las ventanas de la página y lo que pinta cada una.
 *
 * Es el único lugar que dice qué ventanas existen: el menú lateral se arma de esta lista y
 * `pintar()` en `main.ts` solo pregunta cuál está activa. Agregar una ventana es sumar su id
 * al tipo y una entrada a `VENTANAS`; si necesita datos nuevos, un campo en `DatosCliente` y
 * su listener en `main.ts`. Ver `docs/superpowers/specs/2026-09-24-menu-lateral-ventanas-design.md`.
 */

export type IdVentana =
  | "inicio" | "musculos" | "registro"
  | "ranking" | "medallas" | "logros" | "videos" | "ajustes";

/** Todo lo que los listeners de Firestore tienen a mano en cada repintado. */
export interface DatosCliente {
  cliente: Cliente;
  hoy: string;
  asistencias: Asistencia[];
  mesVisible: string;
  yaAviso: boolean;
  medallas: MedallaOtorgada[];
  logros: LogroPersonalOtorgado[];
  tiradaEsteMes: Tirada | null;
  tiradaMesAnterior: Tirada | null;
  /** Lo último que devolvió `obtenerRanking`; lo carga `main.ts` al entrar a la ventana. */
  ranking: EstadoRanking;
  /** El estilo elegido en Ajustes. No viene de Firestore: lo guarda el navegador. */
  estilo: IdEstilo;
  /** Qué ofrecerle sobre notificaciones; lo calcula `main.ts` en cada repintado. */
  notificaciones: EstadoNotificaciones;
  /** Si ya dijo "Ahora no" a la invitación de Inicio. Lo guarda el navegador. */
  invitacionDescartada: boolean;
  /** Mientras el permiso y el registro están en curso: el botón se deshabilita. */
  activandoNotificaciones: boolean;
  /** Los SVG del mapa muscular por archivo; los pide `main.ts` al entrar a Músculos. */
  mapas: Readonly<Record<string, EstadoSvg>>;
  /** El banco de ejercicios; vacío mientras no llega. */
  banco: readonly EjercicioBanco[];
  indiceBanco: IndiceBanco;
  /** Sus últimas sesiones registradas; null mientras no llegan. */
  sesiones: Sesion[] | null;
}

/** Lo que necesita Registro, armado de lo que hay en cada repintado. Lo usa también `main.ts`. */
export function datosRegistro(d: DatosCliente): DatosRegistro {
  return {
    hoy: d.hoy,
    dia: diaDeHoy(d.cliente, d.hoy, d.asistencias),
    banco: d.banco,
    indice: d.indiceBanco,
    sesiones: d.sesiones,
  };
}

export interface Ventana {
  id: IdVentana;
  titulo: string;
  icono: string;
  /**
   * `pie` se pega al fondo del menú, separado del resto. `barra` no sale en el menú: vive solo
   * en la barra de abajo (ver `BARRA`).
   */
  grupo: "principal" | "pie" | "barra";
  /** Se puede abrir, pero todavía muestra "Muy pronto". */
  proximamente?: boolean;
  /** Lo que va dentro de `#contenido`. */
  pintar?: (d: DatosCliente) => string;
  /**
   * La ventana vive en un contenedor fuera del repintado. Hoy solo los videos: el `<video>`
   * tiene estado propio que `innerHTML` destruiría (ver `pintarVideos` en `main.ts`).
   */
  contenedorPropio?: "videos";
}

/**
 * Lo que hoy es "hoy": el recordatorio de pago (si toca), el día con sus dos acciones, la
 * invitación a activar las notificaciones (si toca), la racha, revivirla y el calendario, en
 * ese orden. El recordatorio va primero porque es lo único
 * de la página con fecha límite; abajo del calendario nadie lo vería. Cada acción vive junto al
 * dato del que habla: cambiar el día y avisar que hoy no se puede van dentro de la tarjeta del
 * día; revivir la racha va debajo de la racha.
 */
function inicio(d: DatosCliente): string {
  const yaAsistioHoy = d.asistencias.some((a) => a.fecha === d.hoy && a.asistio);
  const acciones = `
      ${accionDia(d.cliente, d.hoy, yaAsistioHoy)}
      ${hojaDeMotivosAbierta() ? "" : accionHoyNoPuedo(d.cliente, d.hoy, d.yaAviso)}`;
  return `
      ${tarjetaRecordatorioPago(recordatorioPago(d.cliente, d.hoy))}
      ${tarjetaDia(d.cliente, d.hoy, acciones, d.asistencias)}
      ${invitacionNotificaciones(d.notificaciones, d.invitacionDescartada)}
      ${tarjetasStats(d.asistencias, d.hoy)}
      ${tarjetaRevivir(d.cliente, d.hoy, d.asistencias, d.tiradaEsteMes, d.tiradaMesAnterior)}
      ${calendario(d.asistencias, d.mesVisible, d.hoy)}
    `;
}

export const VENTANAS: readonly Ventana[] = [
  { id: "inicio", titulo: "Inicio", icono: "🏠", grupo: "principal", pintar: inicio },
  {
    id: "musculos", titulo: "Músculos", icono: "💪", grupo: "barra",
    pintar: (d) => tarjetaMusculos(d.cliente.sexo, d.mapas),
  },
  {
    id: "registro", titulo: "Registro", icono: "📝", grupo: "barra",
    pintar: (d) => ventanaRegistro(datosRegistro(d)),
  },
  {
    id: "ranking", titulo: "Ranking", icono: "🏆", grupo: "principal",
    pintar: (d) => tarjetaRanking(d.ranking),
  },
  {
    id: "medallas", titulo: "Medallas", icono: "🏅", grupo: "principal",
    pintar: (d) => tarjetaMedallas(d.medallas),
  },
  {
    id: "logros", titulo: "Logros personales", icono: "⭐", grupo: "principal",
    pintar: (d) => tarjetaLogrosPersonales(d.logros),
  },
  { id: "videos", titulo: "Videos", icono: "🎬", grupo: "principal", contenedorPropio: "videos" },
  {
    id: "ajustes", titulo: "Ajustes", icono: "⚙️", grupo: "pie",
    pintar: (d) => tarjetaAjustes(d.estilo) + seccionNotificaciones(d.notificaciones, d.activandoNotificaciones),
  },
];

/**
 * Lo que va en la barra de abajo, en ese orden. Es lo fuerte de la app y por eso está a la
 * vista y no en el menú. Entrenar (el modo guiado) no va aquí: se abre desde la tarjeta del
 * día de Inicio, que ya sabe qué día toca.
 */
export const BARRA: readonly IdVentana[] = ["inicio", "musculos", "registro"];

/** Un id que no está en el registro (un `history.state` viejo, por ejemplo) cae en Inicio. */
export function ventana(id: IdVentana): Ventana {
  return VENTANAS.find((v) => v.id === id) ?? VENTANAS[0];
}

/** Lo que va en `#contenido`. Vacío para las ventanas con contenedor propio. */
export function contenidoDe(v: Ventana, d: DatosCliente): string {
  if (v.pintar) return v.pintar(d);
  if (v.proximamente) {
    return seccionVacia(v.titulo, v.icono, "Muy pronto", "Estamos preparando esta sección.");
  }
  return "";
}
