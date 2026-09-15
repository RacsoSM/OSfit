import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { PaletaWeb } from "./paleta";

export interface Ejercicio { nombre: string; series: number; repeticiones: string; pesoONota: string; }
/**
 * Envuelve la lista porque Firestore no admite arreglos anidados: un `Ejercicio[][]` no se
 * puede guardar, un arreglo de mapas sí. Espejo de `VariacionDia` en Kotlin.
 */
export interface VariacionDia { ejercicios: Ejercicio[]; }

export interface DiaRutina {
  nombreDia: string;
  ejercicios: Ejercicio[];
  /**
   * Invariante: exactamente una de las dos listas está llena. Vacía o ausente → manda
   * `ejercicios`, que es el estado de todo lo anterior al 2026-09-15 y de toda plantilla
   * compartida. Opcional por la misma razón que los campos de `Asistencia`: Firestore omite
   * los que nunca se escribieron.
   */
  variaciones?: VariacionDia[];
}
export interface Rutina { id: string; nombre: string; dias: DiaRutina[]; }

export interface Cliente {
  nombre: string;
  activo: boolean;
  rutinaAsignada: Rutina | null;
  ultimoDia: number | null;
  ultimoDiaFecha: string | null;
  ultimoDiaEsAncla: boolean;
  /**
   * La paleta que el entrenador le eligió desde la app. Opcional: una clienta a la que nunca
   * se le asignó una no tiene el campo, y entonces la página se queda con el morado de :root.
   */
  paletaWeb?: PaletaWeb;
}

export interface Asistencia {
  fecha: string;
  asistio: boolean;
  justificada: boolean;
  /**
   * La justificó el cliente desde la web. Solo estas gastan su cupo mensual.
   *
   * Opcional a propósito: Firestore omite los campos que nunca se escribieron, así que
   * toda asistencia anterior a esta etapa llega sin él. Ver el commit bf5463c.
   */
  justificadaPorCliente?: boolean;
  /**
   * Opcional por la misma razon que `justificadaPorCliente`: las asistencias anteriores al
   * cronometro (commit 473220e) nunca lo escribieron y llegan sin el campo.
   */
  duracionMinutos?: number | null;
  /**
   * Qué variación del día se hizo. Opcional por la misma razón que los dos de arriba: nada
   * anterior al 2026-09-15 la escribió, así que llega `undefined` y no `null`. Vale 0, que es
   * lo correcto: cuando esas asistencias se guardaron no había variaciones que preservar.
   */
  variacionRealizada?: number | null;
  diaRutinaRealizado?: number | null;
}

export function observarCliente(clienteId: string, alCambiar: (c: Cliente | null) => void) {
  return onSnapshot(doc(db, "clientes", clienteId), (snap) => {
    alCambiar(snap.exists() ? (snap.data() as Cliente) : null);
  });
}

/**
 * La query filtra por clienteId porque las reglas validan documento por documento: sin el
 * filtro, Firestore rechaza la consulta entera en vez de devolver solo lo permitido.
 */
export function observarAsistencias(clienteId: string, alCambiar: (a: Asistencia[]) => void) {
  const consulta = query(collection(db, "asistencias"), where("clienteId", "==", clienteId));
  return onSnapshot(consulta, (snap) => {
    alCambiar(snap.docs.map((d) => d.data() as Asistencia));
  });
}

/**
 * Si el cliente ya avisó que hoy no viene. Se observa en vez de guardarse solo en memoria
 * para que el botón siga escondido si recarga la página o la abre en otro dispositivo: el
 * aviso es del día, no de la pestaña.
 */
export function observarAvisoFalta(
  clienteId: string,
  hoy: string,
  alCambiar: (yaAviso: boolean) => void
) {
  return onSnapshot(doc(db, "avisosFalta", `${clienteId}_${hoy}`), (snap) => {
    alCambiar(snap.exists());
  });
}

/**
 * Lo que ya se le otorgó, no el catálogo: el catálogo es solo del entrenador y ahí vive la
 * imagen original. Por eso `imagenUrl` viaja copiada dentro de cada otorgada, igual que el
 * nombre, y es opcional: lo otorgado antes de que existieran las insignias llega sin campo.
 */
export interface MedallaOtorgada {
  rangoInicio: string;
  medallaId: string;
  nombreMedalla: string;
  encabezadoRango: string;
  fueAjustadaManualmente: boolean;
  imagenUrl?: string | null;
}

export interface LogroPersonalOtorgado {
  id: string;
  rangoInicio: string;
  logroId: string;
  nombreLogro: string;
  mensaje: string;
  encabezadoRango: string;
  orden: number;
  imagenUrl?: string | null;
}

/**
 * El video de resumen de una quincena. Guarda la RUTA en Storage, no la URL: a diferencia
 * de las insignias, el video es personal, así que la URL de descarga se pide al SDK recién
 * al pintar (ver `tarjetaVideos`), y solo la sesión de esa clienta puede pedirla.
 */
export interface VideoResumen {
  rangoInicio: string;
  encabezadoRango: string;
  rutaStorage: string;
  duracionSegundos: number;
}

export function observarVideos(clienteId: string, alCambiar: (v: VideoResumen[]) => void) {
  return onSnapshot(collection(db, "clientes", clienteId, "videos"), (snap) => {
    alCambiar(snap.docs.map((d) => d.data() as VideoResumen));
  });
}

export function observarMedallas(clienteId: string, alCambiar: (m: MedallaOtorgada[]) => void) {
  return onSnapshot(collection(db, "clientes", clienteId, "medallas"), (snap) => {
    alCambiar(snap.docs.map((d) => d.data() as MedallaOtorgada));
  });
}

export function observarLogrosPersonales(
  clienteId: string,
  alCambiar: (l: LogroPersonalOtorgado[]) => void
) {
  return onSnapshot(collection(db, "clientes", clienteId, "logrosPersonales"), (snap) => {
    // El id no se guarda dentro del documento; se rellena al leer, como en la app.
    alCambiar(snap.docs.map((d) => ({ ...(d.data() as LogroPersonalOtorgado), id: d.id })));
  });
}
