import type { Asistencia, Cliente, LogroPersonalOtorgado, MedallaOtorgada } from "./datos";
import type { Tirada } from "./tirada";
import { tarjetaDia } from "./ui/tarjetaDia";
import { tarjetasStats } from "./ui/tarjetasStats";
import { accionDia, hojaDeMotivosAbierta } from "./ui/accionDia";
import { accionHoyNoPuedo, tarjetaRevivir } from "./ui/accionFalta";
import { calendario } from "./ui/calendario";
import { seccionVacia, tarjetaLogrosPersonales, tarjetaMedallas } from "./ui/tarjetaInsignias";
import { tarjetaRanking, type EstadoRanking } from "./ui/tarjetaRanking";

/**
 * Las ventanas de la página y lo que pinta cada una.
 *
 * Es el único lugar que dice qué ventanas existen: el menú lateral se arma de esta lista y
 * `pintar()` en `main.ts` solo pregunta cuál está activa. Agregar una ventana es sumar su id
 * al tipo y una entrada a `VENTANAS`; si necesita datos nuevos, un campo en `DatosCliente` y
 * su listener en `main.ts`. Ver `docs/superpowers/specs/2026-09-24-menu-lateral-ventanas-design.md`.
 */

export type IdVentana = "inicio" | "ranking" | "medallas" | "logros" | "videos" | "ajustes";

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
}

export interface Ventana {
  id: IdVentana;
  titulo: string;
  icono: string;
  /** `pie` se pega al fondo del menú, separado del resto. */
  grupo: "principal" | "pie";
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
 * Lo que hoy es "hoy": el día con sus dos acciones, la racha, revivirla y el calendario, en
 * ese orden. Cada acción vive junto al dato del que habla: cambiar el día y avisar que hoy no
 * se puede van dentro de la tarjeta del día; revivir la racha va debajo de la racha.
 */
function inicio(d: DatosCliente): string {
  const yaAsistioHoy = d.asistencias.some((a) => a.fecha === d.hoy && a.asistio);
  const acciones = `
      ${accionDia(d.cliente, d.hoy, yaAsistioHoy)}
      ${hojaDeMotivosAbierta() ? "" : accionHoyNoPuedo(d.cliente, d.hoy, d.yaAviso)}`;
  return `
      ${tarjetaDia(d.cliente, d.hoy, acciones, d.asistencias)}
      ${tarjetasStats(d.asistencias, d.hoy)}
      ${tarjetaRevivir(d.cliente, d.hoy, d.asistencias, d.tiradaEsteMes, d.tiradaMesAnterior)}
      ${calendario(d.asistencias, d.mesVisible, d.hoy)}
    `;
}

export const VENTANAS: readonly Ventana[] = [
  { id: "inicio", titulo: "Inicio", icono: "🏠", grupo: "principal", pintar: inicio },
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
  { id: "ajustes", titulo: "Ajustes", icono: "⚙️", grupo: "pie", proximamente: true },
];

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
