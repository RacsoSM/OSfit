import type { EjercicioBanco, SerieSesion, Sesion } from "./datos";

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
  const series: SerieBorrador[] = previas && previas.length > 0
    ? previas.map((s) => ({ reps: String(s.reps), peso: s.peso === null ? "" : String(s.peso) }))
    : Array.from({ length: Math.min(Math.max(seriesRutina ?? 1, 1), 10) }, () => ({ ...SERIE_VACIA }));
  return {
    ...b,
    ejercicios: [
      ...b.ejercicios,
      { ejercicioId: e.id, nombre: e.nombre, tipo: e.tipo, gifRuta: e.gifRuta ?? null, series },
    ],
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

export function quitarEjercicio(b: Borrador, iEj: number): Borrador {
  return { ...b, ejercicios: b.ejercicios.filter((_, i) => i !== iEj) };
}

function numero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : NaN;
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
      const peso = e.tipo === "tiempo" ? null : numero(s.peso);
      if (peso !== null && Number.isNaN(peso)) return { ok: false, error: `${donde}: el peso no es un número.` };
      if (e.tipo === "peso" && peso === null) return { ok: false, error: `${donde}: falta el peso.` };
      series.push({ reps, peso });
    }
    if (series.length > 0) ejercicios.push({ ejercicioId: e.ejercicioId, series });
  }
  if (ejercicios.length === 0) return { ok: false, error: "Anota al menos una serie antes de guardar." };
  const datos: Envio = { id: b.id, ejercicios };
  if (typeof b.iniciado === "number") datos.iniciadaEn = b.iniciado;
  return { ok: true, datos };
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
