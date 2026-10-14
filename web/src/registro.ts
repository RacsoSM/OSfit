import type { EjercicioBanco, SerieSesion, Sesion } from "./datos";
import { lunesDe } from "./dia";
import { barrasAKg, kgABarras, unidadPorDefecto, type Unidad } from "./barras";

/**
 * El borrador de Registro: lo que la clienta va anotando en el gym, ejercicio por ejercicio,
 * hasta que toca "Guardar". Puro, para probarlo sin DOM; la pantalla vive en `ui/registro.ts`.
 *
 * Registro es para lo que el coach le dice en persona: no sigue a fuerza la rutina de la app.
 * Por eso el borrador no sabe de días ni de rutinas, solo de ejercicios del banco.
 *
 * Las series se guardan como TEXTO, tal como se escriben: convertir en cada tecla haría que
 * "42," se volviera "42" y la coma desapareciera bajo el dedo. Se convierten una sola vez, en
 * `paraEnviar`.
 */

export interface SerieBorrador { reps: string; peso: string; }

export interface EjercicioBorrador {
  ejercicioId: string;
  nombre: string;
  tipo: EjercicioBanco["tipo"];
  gifRuta: string | null;
  series: SerieBorrador[];
  /**
   * En qué anota el peso: kg, o barras en las máquinas de placas (ver `barras.ts`). Se envía
   * siempre en kg. Ausente en los borradores de antes del selector: kg.
   */
  unidad?: Unidad;
}

export interface Borrador {
  /** Será el id del documento: guardar dos veces el mismo borrador no duplica la sesión. */
  id: string;
  /** Cuándo se empezó, solo para la pantalla; la fecha de la sesión la pone el servidor. */
  fecha: string;
  /**
   * Cuándo tocó "Iniciar entrenamiento" (ms). Opcional: los borradores de antes de los
   * entrenamientos con inicio no lo traen.
   */
  iniciado?: number;
  /**
   * true cuando el borrador es la corrección de un entrenamiento ya guardado (el historial
   * lo abre con `borradorDeSesion`): al guardar va a `editarSesion`, que conserva su fecha y
   * sus horas, y no a `registrarSesion`, que le pondría la fecha de hoy.
   */
  edicion?: boolean;
  ejercicios: EjercicioBorrador[];
}

/** Lo que recibe `registrarSesion`. */
export interface Envio {
  id: string;
  /** Hora de inicio del entrenamiento; el servidor la descarta si no es razonable. */
  iniciadaEn?: number;
  ejercicios: { ejercicioId: string; series: SerieSesion[] }[];
}

const SERIE_VACIA: SerieBorrador = { reps: "", peso: "" };

/** Un entrenamiento recién iniciado, todavía sin ejercicios. */
export function nuevoBorrador(id: string, fecha: string, iniciado?: number): Borrador {
  return iniciado === undefined ? { id, fecha, ejercicios: [] } : { id, fecha, iniciado, ejercicios: [] };
}

/** Un id que sirve de id de documento (`ID_VALIDO` en `functions/src/registrarSesion.ts`). */
export function idNuevo(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Agrega el ejercicio con sus series prellenadas: lo que hizo la última vez si existe, y si
 * no, tantas filas vacías como series diga su rutina (o una). Si ya estaba, no lo duplica.
 */
export function agregarEjercicio(
  b: Borrador,
  e: EjercicioBanco,
  previas: readonly SerieSesion[] | null,
  seriesRutina: number | null
): Borrador {
  if (b.ejercicios.some((x) => x.ejercicioId === e.id)) return b;
  // Solo los de peso eligen unidad: en los corporales el peso es lastre y va en kg.
  const unidad: Unidad = e.tipo === "peso" ? unidadPorDefecto(e.id) : "kg";
  // Lo de la última vez está guardado en kg; en barras se muestra en barras.
  const pesoPrevio = (kg: number | null) =>
    kg === null ? "" : String(unidad === "barras" ? kgABarras(kg) : kg);
  const series: SerieBorrador[] = previas && previas.length > 0
    ? previas.map((s) => ({ reps: String(s.reps), peso: pesoPrevio(s.peso) }))
    : Array.from({ length: Math.min(Math.max(seriesRutina ?? 1, 1), 10) }, () => ({ ...SERIE_VACIA }));
  return {
    ...b,
    ejercicios: [
      ...b.ejercicios,
      { ejercicioId: e.id, nombre: e.nombre, tipo: e.tipo, gifRuta: e.gifRuta ?? null, series, unidad },
    ],
  };
}

/**
 * Un entrenamiento ya guardado, como borrador para corregirlo. Mismo id (así `editarSesion`
 * sabe cuál es) y siempre en kg, que es como está guardado: pasarlo a barras redondearía. Si un
 * ejercicio ya no está en el banco se queda con su nombre y sin GIF.
 */
export function borradorDeSesion(s: Sesion, banco: readonly EjercicioBanco[]): Borrador {
  return {
    id: s.id,
    fecha: s.fecha,
    edicion: true,
    ejercicios: s.ejercicios.map((e) => {
      const b = banco.find((x) => x.id === e.ejercicioId);
      return {
        ejercicioId: e.ejercicioId,
        nombre: b?.nombre ?? e.nombre,
        tipo: b?.tipo ?? "peso",
        gifRuta: b?.gifRuta ?? null,
        unidad: "kg" as const,
        series: e.series.map((x) => ({ reps: String(x.reps), peso: x.peso === null ? "" : String(x.peso) })),
      };
    }),
  };
}

function conSeries(
  b: Borrador,
  iEj: number,
  cambiar: (s: SerieBorrador[]) => SerieBorrador[]
): Borrador {
  return {
    ...b,
    ejercicios: b.ejercicios.map((e, i) => (i === iEj ? { ...e, series: cambiar(e.series) } : e)),
  };
}

export function cambiarSerie(
  b: Borrador, iEj: number, iSerie: number, campo: keyof SerieBorrador, valor: string
): Borrador {
  return conSeries(b, iEj, (series) =>
    series.map((s, i) => (i === iSerie ? { ...s, [campo]: valor } : s)));
}

/** La serie nueva copia la anterior: casi siempre se repite el peso y cambia poco más. */
export function agregarSerie(b: Borrador, iEj: number): Borrador {
  return conSeries(b, iEj, (series) =>
    series.length >= 20 ? series : [...series, { ...(series[series.length - 1] ?? SERIE_VACIA) }]);
}

/** Quitar la única serie la deja en blanco: para sacar el ejercicio está `quitarEjercicio`. */
export function quitarSerie(b: Borrador, iEj: number, iSerie: number): Borrador {
  return conSeries(b, iEj, (series) => {
    const quedan = series.filter((_, i) => i !== iSerie);
    return quedan.length > 0 ? quedan : [{ ...SERIE_VACIA }];
  });
}

/**
 * Cambia la unidad de un ejercicio y convierte lo que ya escribió, para que el selector no
 * le cambie el peso de fondo: 6 barras pasan a 27 kg, y 27 kg a 6 barras.
 */
export function cambiarUnidad(b: Borrador, iEj: number, unidad: Unidad): Borrador {
  const e = b.ejercicios[iEj];
  if (!e || (e.unidad ?? "kg") === unidad) return b;
  const convertir = (texto: string): string => {
    const n = numero(texto);
    if (n === null || Number.isNaN(n)) return texto;
    return String(unidad === "barras" ? kgABarras(n) : barrasAKg(n));
  };
  return {
    ...b,
    ejercicios: b.ejercicios.map((x, i) => (i === iEj
      ? { ...x, unidad, series: x.series.map((s) => ({ ...s, peso: convertir(s.peso) })) }
      : x)),
  };
}

export function quitarEjercicio(b: Borrador, iEj: number): Borrador {
  return { ...b, ejercicios: b.ejercicios.filter((_, i) => i !== iEj) };
}

function numero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : NaN;
}

/** Arriba de esto se pregunta si de verdad fueron tantas reps (backlog 2, punto 15.4). */
export const REPS_DUDOSAS = 20;

/**
 * Las reps que conviene confirmar, o null. Solo en ejercicios de reps: en los de tiempo el
 * campo son segundos, y 30 o 60 es lo normal.
 */
export function repsDudosas(texto: string, tipo: EjercicioBanco["tipo"]): number | null {
  if (tipo === "tiempo") return null;
  const n = numero(texto);
  return n !== null && n > REPS_DUDOSAS ? n : null;
}

/**
 * Lo que se le manda a `registrarSesion`, o el error en palabras de la clienta. Las series en
 * blanco se saltan (prellenar con más filas de las que hizo no debe obligarla a borrarlas);
 * una a medio llenar sí se reclama, porque probablemente le faltó escribir algo.
 */
export function paraEnviar(b: Borrador): { ok: true; datos: Envio } | { ok: false; error: string } {
  const ejercicios: Envio["ejercicios"] = [];
  for (const e of b.ejercicios) {
    const series: SerieSesion[] = [];
    for (const [i, s] of e.series.entries()) {
      if (s.reps.trim() === "" && s.peso.trim() === "") continue;
      const donde = `${e.nombre}, serie ${i + 1}`;
      const reps = numero(s.reps);
      if (reps === null) return { ok: false, error: `${donde}: faltan las repeticiones.` };
      if (!Number.isInteger(reps) || reps < 1) {
        return { ok: false, error: `${donde}: las repeticiones van en número entero.` };
      }
      const escrito = e.tipo === "tiempo" ? null : numero(s.peso);
      if (escrito !== null && Number.isNaN(escrito)) return { ok: false, error: `${donde}: el peso no es un número.` };
      if (e.tipo === "peso" && escrito === null) {
        return { ok: false, error: `${donde}: ${e.unidad === "barras" ? "faltan las barras" : "falta el peso"}.` };
      }
      // Se guarda siempre en kg: las barras se convierten aquí y en ningún otro lado.
      const peso = escrito !== null && e.unidad === "barras" ? barrasAKg(escrito) : escrito;
      series.push({ reps, peso });
    }
    if (series.length > 0) ejercicios.push({ ejercicioId: e.ejercicioId, series });
  }
  if (ejercicios.length === 0) return { ok: false, error: "Anota al menos una serie antes de guardar." };
  const datos: Envio = { id: b.id, ejercicios };
  if (typeof b.iniciado === "number") datos.iniciadaEn = b.iniciado;
  return { ok: true, datos };
}

/**
 * "2 series · 40 kg × 10, 42.5 kg × 8": lo anotado de un ejercicio, para su fila comprimida
 * cuando no es el activo. Cuenta solo las series con algo escrito.
 */
export function resumenSeries(e: EjercicioBorrador): string {
  const llenas = e.series.filter((s) => s.reps.trim() !== "" || s.peso.trim() !== "");
  if (llenas.length === 0) return "Sin anotar";
  const texto = llenas.map((s) => {
    const reps = s.reps.trim() || "?";
    if (e.tipo === "tiempo") return `${reps} s`;
    const peso = s.peso.trim().replace(",", ".");
    const unidad = e.unidad === "barras" ? (peso === "1" ? "barra" : "barras") : "kg";
    return peso === "" ? `× ${reps}` : `${peso} ${unidad} × ${reps}`;
  });
  return `${llenas.length === 1 ? "1 serie" : `${llenas.length} series`} · ${texto.join(", ")}`;
}

/** Las series de la sesión más reciente que tenga ese ejercicio (llegan de nueva a vieja). */
export function ultimasSeries(sesiones: readonly Sesion[], ejercicioId: string): SerieSesion[] | null {
  for (const s of sesiones) {
    const e = s.ejercicios.find((x) => x.ejercicioId === ejercicioId);
    if (e) return e.series;
  }
  return null;
}

/**
 * Un borrador guardado en el navegador, o null si no hay o no se reconoce (otra versión de la
 * página, datos corruptos). Perder un borrador ilegible es mejor que romper la ventana.
 */
export function leerBorrador(texto: string | null): Borrador | null {
  if (!texto) return null;
  try {
    const b = JSON.parse(texto) as Borrador;
    if (typeof b?.id !== "string" || typeof b.fecha !== "string" || !Array.isArray(b.ejercicios)) return null;
    const ok = b.ejercicios.every((e) =>
      typeof e?.ejercicioId === "string" && typeof e.nombre === "string" && Array.isArray(e.series));
    return ok ? b : null;
  } catch {
    return null;
  }
}

export interface DiaDeLaSemana {
  fecha: string;
  /** "L", "M", "M", "J", "V", "S", "D". */
  letra: string;
  /** Número del día del mes. */
  numero: number;
  entreno: boolean;
  esHoy: boolean;
}

export interface ResumenSemana {
  dias: DiaDeLaSemana[];
  entrenamientos: number;
  /** null si ninguna sesión de la semana sabe cuándo empezó: no se inventa una duración. */
  minutos: number | null;
  series: number;
}

const LETRAS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Lo que lleva entrenado en la semana de [hoy], de lunes a domingo, contado solo con lo que ELLA
 * anotó. De la rutina no sale nada: Registro no sigue la rutina (ver arriba).
 *
 * Las fechas se arman a mediodía UTC, como `lunesDe`, para que la zona del navegador no mueva
 * un día a la semana de al lado.
 */
export function resumenSemana(sesiones: readonly Sesion[], hoy: string): ResumenSemana {
  const lunes = new Date(`${lunesDe(hoy)}T12:00:00Z`);
  const fechas = LETRAS.map((_, i) => {
    const d = new Date(lunes);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const deLaSemana = sesiones.filter((s) => s.fecha >= fechas[0] && s.fecha <= fechas[6]);
  const conHora = deLaSemana.filter((s) => s.iniciada && s.creada);
  const minutos = conHora.length === 0 ? null : conHora.reduce(
    (total, s) => total + Math.max(0, Math.round((s.creada!.toDate().getTime() - s.iniciada!.toDate().getTime()) / 60_000)),
    0
  );
  return {
    dias: fechas.map((fecha, i) => ({
      fecha,
      letra: LETRAS[i],
      numero: Number(fecha.slice(8, 10)),
      entreno: deLaSemana.some((s) => s.fecha === fecha),
      esHoy: fecha === hoy,
    })),
    entrenamientos: deLaSemana.length,
    minutos,
    series: deLaSemana.reduce((total, s) => total + s.ejercicios.reduce((n, e) => n + e.series.length, 0), 0),
  };
}

/** "Sentadilla", "Sentadilla y Prensa", "Sentadilla, Prensa y 3 más". */
export function nombresDeSesion(s: Sesion): string {
  const nombres = s.ejercicios.map((e) => e.nombre);
  if (nombres.length === 0) return "Sin ejercicios";
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  return `${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} más`;
}
