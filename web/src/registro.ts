import type { Ejercicio, EjercicioBanco, SerieSesion, Sesion } from "./datos";
import { claveBanco, type IndiceBanco } from "./banco";
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

/** Una bajada de un dropset, como se escribe (ver `SerieBorrador`). */
export interface CaidaBorrador { reps: string; peso: string; }

/**
 * `caidas`: las bajadas del dropset de esa serie, en orden. Se agregan tocando el número de la
 * serie (decisión del entrenador, 2026-10-15). Ausente en una serie normal.
 */
export interface SerieBorrador {
  reps: string;
  peso: string;
  caidas?: CaidaBorrador[];
  /** Solo en cardio, donde `reps` son los minutos (ver la spec de cardio). */
  inclinacion?: string;
  velocidad?: string;
}

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
  /**
   * Lo que le pide su rutina ("4 × 10-12 · 30 kg"), solo en el entrenamiento guiado: se
   * muestra junto a sus series para que sepa qué le toca sin volver a Inicio.
   */
  objetivo?: string;
  /**
   * Los dos ejercicios de una biserie llevan la misma marca ("b1") y van seguidos, el A
   * primero. Sus series van a la par: la serie j de los dos es la ronda j. Ausente = suelto.
   */
  biserie?: string;
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
  /**
   * El entrenamiento guiado (backlog 2, punto 7): se empezó con "▶ Empezar" desde la tarjeta
   * del día y trae ya cargados los ejercicios que le recomienda su rutina. Se guarda con
   * `origen: "guiado"`. Ausente = uno de Registro, armado a mano.
   */
  guiado?: { nombreDia: string; sinLigar: string[] };
  /**
   * Cuándo escribió por última vez una serie (ms): la hora con que se cierra solo si se queda
   * abierto (`cierreAutomatico`). Opcional: los borradores de antes no la traen.
   */
  anotado?: number;
  ejercicios: EjercicioBorrador[];
}

/** Lo que recibe `registrarSesion`. */
export interface Envio {
  id: string;
  /** Hora de inicio del entrenamiento; el servidor la descarta si no es razonable. */
  iniciadaEn?: number;
  /**
   * El día y la hora en que tocó "Terminar entrenamiento". Importan cuando se manda tarde,
   * hecho sin internet (`cola.ts`): el servidor los usa en vez de cuándo llegó.
   */
  fecha?: string;
  terminadaEn?: number;
  /** Solo en el guiado; sin él, el servidor lo guarda como "manual". */
  origen?: "guiado";
  ejercicios: { ejercicioId: string; series: SerieSesion[]; biserie?: string }[];
}

const SERIE_VACIA: SerieBorrador = { reps: "", peso: "" };

/** Bajadas por serie y series por ejercicio: los mismos topes que `registrarSesion`. */
export const MAX_CAIDAS = 5;
const MAX_SERIES = 20;

/** La anotación de una máquina de cardio, con lo de la última vez si lo hay. */
function serieCardio(previa: SerieSesion | null): SerieBorrador {
  const texto = (n: number | undefined) => (n === undefined ? "" : String(n));
  return previa
    ? { reps: String(previa.reps), peso: "", inclinacion: texto(previa.inclinacion), velocidad: texto(previa.velocidad) }
    : { reps: "", peso: "", inclinacion: "", velocidad: "" };
}

/** Lo que se escribe de una máquina de cardio (ver la spec de cardio). */
export interface CamposCardio { minutos: string; inclinacion: string; velocidad: string; }

/**
 * Agrega una máquina de cardio con lo que anotó, o le cambia lo anotado si ya estaba: "Registrar
 * cardio" con un entrenamiento abierto (ver la spec de cardio).
 */
export function agregarCardio(b: Borrador, e: EjercicioBanco, c: CamposCardio): Borrador {
  const serie: SerieBorrador = { reps: c.minutos, peso: "", inclinacion: c.inclinacion, velocidad: c.velocidad };
  const ya = b.ejercicios.findIndex((x) => x.ejercicioId === e.id);
  if (ya >= 0) return conSeries(b, ya, () => [serie]);
  return {
    ...b,
    ejercicios: [...b.ejercicios, { ejercicioId: e.id, nombre: e.nombre, tipo: e.tipo, gifRuta: e.gifRuta ?? null, series: [serie] }],
  };
}

/**
 * "Registrar cardio" sin entrenamiento abierto: un entrenamiento propio con solo esa máquina,
 * que empezó hace los minutos que anotó y terminó ahora. O el error en palabras de la clienta.
 */
export function envioCardio(
  e: EjercicioBanco, c: CamposCardio, id: string, hoy: string, ahora: number
): { ok: true; datos: Envio } | { ok: false; error: string } {
  // Sin nada escrito, `paraEnviar` lo saltaría como una serie en blanco: aquí faltan los minutos.
  if (c.minutos.trim() === "") return { ok: false, error: `${e.nombre}: faltan los minutos.` };
  const envio = paraEnviar(agregarCardio(nuevoBorrador(id, hoy), e, c));
  if (!envio.ok) return envio;
  const minutos = envio.datos.ejercicios[0]?.series[0]?.reps ?? 0;
  return { ok: true, datos: { ...envio.datos, iniciadaEn: ahora - minutos * 60_000, fecha: hoy, terminadaEn: ahora } };
}

/**
 * Un entrenamiento ya guardado, como se le vuelve a mandar al servidor: mismo id (lo reescribe
 * en vez de crear otro), su día, sus horas y su origen. Para agregarle el cardio de ese día.
 */
export function envioDeSesion(s: Sesion): Envio {
  const ms = (t: Sesion["creada"]) => (t ? t.toDate().getTime() : undefined);
  const iniciadaEn = ms(s.iniciada), terminadaEn = ms(s.creada);
  return {
    id: s.id,
    fecha: s.fecha,
    ...(iniciadaEn !== undefined ? { iniciadaEn } : {}),
    ...(terminadaEn !== undefined ? { terminadaEn } : {}),
    ...(s.origen === "guiado" ? { origen: "guiado" as const } : {}),
    ejercicios: s.ejercicios.map((e) => ({ ejercicioId: e.ejercicioId, series: e.series, ...(e.biserie ? { biserie: e.biserie } : {}) })),
  };
}

/**
 * Le agrega el cardio a un entrenamiento de ese mismo día (entrenador, 2026-10-20: "si hay un
 * entrenamiento registrado en ese día, que se agregue a ese"). Si ya traía esa máquina, se suman
 * los minutos y se queda la inclinación y la velocidad nuevas. Termina ahora: el cardio fue lo
 * último que hizo.
 */
export function sumarCardio(base: Envio, cardio: Envio["ejercicios"][number], ahora: number): Envio {
  const nueva = cardio.series[0];
  const ya = base.ejercicios.findIndex((e) => e.ejercicioId === cardio.ejercicioId);
  const ejercicios = ya < 0
    ? [...base.ejercicios, cardio]
    : base.ejercicios.map((e, i) => {
      if (i !== ya) return e;
      const vieja = e.series[0];
      return { ...e, series: [{ ...vieja, ...nueva, reps: (vieja?.reps ?? 0) + nueva.reps }] };
    });
  return { ...base, ejercicios, terminadaEn: Math.max(base.terminadaEn ?? 0, ahora) };
}

/**
 * El entrenamiento de hoy al que se le agrega el cardio, ya listo para reenviar: el que espera en
 * la cola del teléfono (el más reciente), o el último guardado de hoy. null si no hay, o si trae un
 * ejercicio que ya no está en el banco: el servidor lo rechazaría y con él se perdería el cardio,
 * así que ahí el cardio va solo.
 */
export function entrenamientoDelDia(
  sesiones: readonly Sesion[], pendientes: readonly Envio[], hoy: string, banco: readonly EjercicioBanco[]
): Envio | null {
  const enCola = pendientes
    .filter((p) => p.fecha === hoy)
    .sort((a, b) => (b.terminadaEn ?? 0) - (a.terminadaEn ?? 0))[0];
  // Llegan de la más nueva a la más vieja.
  const guardado = sesiones.find((s) => s.fecha === hoy);
  const base = enCola ?? (guardado ? envioDeSesion(guardado) : null);
  if (!base) return null;
  const ids = new Set(banco.map((b) => b.id));
  return base.ejercicios.every((e) => ids.has(e.ejercicioId)) ? base : null;
}

/** "25 min · inclinación 8 · 5.5 km/h": una anotación de cardio, para el historial. */
export function textoCardio(s: { reps: number; inclinacion?: number; velocidad?: number }, ejercicioId?: string): string {
  return [
    `${s.reps} min`,
    s.inclinacion !== undefined ? `inclinación ${s.inclinacion}` : null,
    s.velocidad !== undefined ? (ejercicioId === "caminadora" ? `${s.velocidad} km/h` : `velocidad ${s.velocidad}`) : null,
  ].filter(Boolean).join(" · ");
}

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
  const series: SerieBorrador[] = e.tipo === "cardio"
    ? [serieCardio(previas?.[0] ?? null)]
    : previas && previas.length > 0
    ? previas.map((s) => ({
      reps: String(s.reps),
      peso: pesoPrevio(s.peso),
      ...(s.caidas?.length ? { caidas: s.caidas.map((c) => ({ reps: String(c.reps), peso: pesoPrevio(c.peso) })) } : {}),
    }))
    : Array.from({ length: Math.min(Math.max(seriesRutina ?? 1, 1), 10) }, () => ({ ...SERIE_VACIA }));
  return {
    ...b,
    ejercicios: [
      ...b.ejercicios,
      { ejercicioId: e.id, nombre: e.nombre, tipo: e.tipo, gifRuta: e.gifRuta ?? null, series, unidad },
    ],
  };
}

/** "4 × 10-12 · 30 kg": lo que dice la rutina de un ejercicio, en una línea. */
export function objetivoDeRutina(e: Ejercicio): string {
  const series = e.series > 0 ? `${e.series} × ` : "";
  const reps = (e.repeticiones ?? "").trim();
  const nota = (e.pesoONota ?? "").trim();
  return [`${series}${reps}`.trim().replace(/ ×$/, " series"), nota].filter(Boolean).join(" · ");
}

/**
 * El entrenamiento guiado: los ejercicios del día que le toca, en el orden de su rutina, ya
 * agregados como en Registro (prellenados con lo de la última vez, o con tantas filas como
 * series diga la rutina). Los que no se encuentran en el banco no se pueden guardar
 * (`registrarSesion` los rechaza), así que se quedan fuera y se listan en `sinLigar` para
 * avisarle. Un ejercicio repetido en la rutina entra una sola vez.
 */
export function borradorGuiado(
  id: string,
  fecha: string,
  iniciado: number,
  dia: { nombreDia: string; ejercicios: readonly Ejercicio[] },
  indice: IndiceBanco,
  sesiones: readonly Sesion[]
): Borrador {
  let b: Borrador = { ...nuevoBorrador(id, fecha, iniciado), guiado: { nombreDia: dia.nombreDia.trim(), sinLigar: [] } };
  const sinLigar: string[] = [];
  for (const x of dia.ejercicios) {
    const e = indice.get(claveBanco(x.nombre ?? ""));
    if (!e) {
      if ((x.nombre ?? "").trim() !== "") sinLigar.push(x.nombre.trim());
      continue;
    }
    const antes = b.ejercicios.length;
    b = agregarEjercicio(b, e, ultimasSeries(sesiones, e.id), x.series > 0 ? x.series : null);
    if (b.ejercicios.length > antes) {
      const objetivo = objetivoDeRutina(x);
      if (objetivo) b.ejercicios[antes] = { ...b.ejercicios[antes], objetivo };
    }
  }
  return { ...b, guiado: { nombreDia: dia.nombreDia.trim(), sinLigar } };
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
        series: e.series.map((x) => ({
          reps: String(x.reps),
          peso: x.peso === null ? "" : String(x.peso),
          ...(x.caidas?.length
            ? { caidas: x.caidas.map((c) => ({ reps: String(c.reps), peso: c.peso === null ? "" : String(c.peso) })) }
            : {}),
        })),
        ...(e.biserie ? { biserie: e.biserie } : {}),
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

/**
 * La serie nueva copia la anterior: casi siempre se repite el peso y cambia poco más. Las
 * bajadas no: el drop suele ser solo de la última.
 */
export function agregarSerie(b: Borrador, iEj: number): Borrador {
  return conSeries(b, iEj, (series) => {
    if (series.length >= MAX_SERIES) return series;
    const { reps, peso } = series[series.length - 1] ?? SERIE_VACIA;
    return [...series, { reps, peso }];
  });
}

/** Quitar la única serie la deja en blanco: para sacar el ejercicio está `quitarEjercicio`. */
export function quitarSerie(b: Borrador, iEj: number, iSerie: number): Borrador {
  return conSeries(b, iEj, (series) => {
    const quedan = series.filter((_, i) => i !== iSerie);
    return quedan.length > 0 ? quedan : [{ ...SERIE_VACIA }];
  });
}

/** Una bajada más al final del dropset de esa serie, en blanco. */
export function agregarCaida(b: Borrador, iEj: number, iSerie: number): Borrador {
  return conSeries(b, iEj, (series) => series.map((s, i) => {
    if (i !== iSerie) return s;
    const caidas = s.caidas ?? [];
    return caidas.length >= MAX_CAIDAS ? s : { ...s, caidas: [...caidas, { reps: "", peso: "" }] };
  }));
}

export function cambiarCaida(
  b: Borrador, iEj: number, iSerie: number, iCaida: number, campo: keyof CaidaBorrador, valor: string
): Borrador {
  return conSeries(b, iEj, (series) => series.map((s, i) => (i !== iSerie || !s.caidas ? s : {
    ...s,
    caidas: s.caidas.map((c, k) => (k === iCaida ? { ...c, [campo]: valor } : c)),
  })));
}

/** Sin bajadas, la serie vuelve a ser normal: no se queda con una lista vacía. */
export function quitarCaida(b: Borrador, iEj: number, iSerie: number, iCaida: number): Borrador {
  return conSeries(b, iEj, (series) => series.map((s, i) => {
    if (i !== iSerie || !s.caidas) return s;
    const caidas = s.caidas.filter((_, k) => k !== iCaida);
    if (caidas.length > 0) return { ...s, caidas };
    const { reps, peso } = s;
    return { reps, peso };
  }));
}

// ── Biseries ─────────────────────────────────────────────────────────────────

/**
 * El otro ejercicio de la biserie de `i`, o null si va suelto. Van seguidos (`agregarBiserie`
 * los pone así y nada los separa), así que es el de al lado con la misma marca.
 */
export function companero(b: Borrador, i: number): number | null {
  const marca = b.ejercicios[i]?.biserie;
  if (!marca) return null;
  if (b.ejercicios[i - 1]?.biserie === marca) return i - 1;
  if (b.ejercicios[i + 1]?.biserie === marca) return i + 1;
  return null;
}

/**
 * Los ejercicios del entrenamiento como se ven en la pantalla: cada suelto es una unidad y
 * cada biserie, una sola con sus dos (el A primero).
 */
export function unidades(b: Borrador): number[][] {
  const salida: number[][] = [];
  for (let i = 0; i < b.ejercicios.length; i++) {
    const otro = companero(b, i);
    if (otro === i + 1) { salida.push([i, i + 1]); i++; } else salida.push([i]);
  }
  return salida;
}

/**
 * Agrega los dos ejercicios de una biserie, seguidos y con la misma marca, prellenados como
 * `agregarEjercicio` e igualados en series: cada serie es una ronda de los dos. Si alguno ya
 * está en el entrenamiento no hace nada (el selector no deja elegirlo).
 */
export function agregarBiserie(
  b: Borrador,
  a: { e: EjercicioBanco; previas: readonly SerieSesion[] | null; seriesRutina: number | null },
  c: { e: EjercicioBanco; previas: readonly SerieSesion[] | null; seriesRutina: number | null }
): Borrador {
  if (a.e.id === c.e.id || b.ejercicios.some((x) => x.ejercicioId === a.e.id || x.ejercicioId === c.e.id)) return b;
  const conDos = agregarEjercicio(agregarEjercicio(b, a.e, a.previas, a.seriesRutina), c.e, c.previas, c.seriesRutina);
  const usadas = new Set(b.ejercicios.map((x) => x.biserie));
  let n = 1;
  while (usadas.has(`b${n}`)) n++;
  const marca = `b${n}`;
  const rondas = Math.max(...conDos.ejercicios.slice(-2).map((x) => x.series.length));
  return {
    ...conDos,
    ejercicios: conDos.ejercicios.map((x, i) => {
      if (i < b.ejercicios.length) return x;
      const faltan = Array.from({ length: rondas - x.series.length }, () => ({ ...SERIE_VACIA }));
      return { ...x, biserie: marca, series: [...x.series, ...faltan] };
    }),
  };
}

/** Una ronda más: una serie a cada uno de la biserie, copiando la anterior de cada quien. */
export function agregarRonda(b: Borrador, iEj: number): Borrador {
  const otro = companero(b, iEj);
  const conUna = agregarSerie(b, iEj);
  return otro === null ? conUna : agregarSerie(conUna, otro);
}

/** Quita la ronda j de los dos ejercicios de la biserie. */
export function quitarRonda(b: Borrador, iEj: number, j: number): Borrador {
  const otro = companero(b, iEj);
  const sinUna = quitarSerie(b, iEj, j);
  return otro === null ? sinUna : quitarSerie(sinUna, otro, j);
}

/** Saca del entrenamiento el ejercicio y, si es de una biserie, también su compañero. */
export function quitarBloque(b: Borrador, iEj: number): Borrador {
  const otro = companero(b, iEj);
  return { ...b, ejercicios: b.ejercicios.filter((_, i) => i !== iEj && i !== otro) };
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
      ? {
        ...x,
        unidad,
        series: x.series.map((s) => ({
          ...s,
          peso: convertir(s.peso),
          ...(s.caidas ? { caidas: s.caidas.map((c) => ({ ...c, peso: convertir(c.peso) })) } : {}),
        })),
      }
      : x)),
  };
}

/** Quitar uno de una biserie deja al otro suelto: una biserie de uno no existe. */
export function quitarEjercicio(b: Borrador, iEj: number): Borrador {
  const otro = companero(b, iEj);
  return {
    ...b,
    ejercicios: b.ejercicios.filter((_, i) => i !== iEj).map((x) => {
      if (otro === null || x !== b.ejercicios[otro]) return x;
      const { biserie: _marca, ...suelto } = x;
      return suelto;
    }),
  };
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
  if (tipo === "tiempo" || tipo === "cardio") return null;
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
    /** Una serie o una bajada ya en números, o el error. */
    const convertir = (s: CaidaBorrador, donde: string): { reps: number; peso: number | null } | string => {
      const reps = numero(s.reps);
      if (reps === null) return `${donde}: faltan las repeticiones.`;
      if (!Number.isInteger(reps) || reps < 1) return `${donde}: las repeticiones van en número entero.`;
      const escrito = e.tipo === "tiempo" ? null : numero(s.peso);
      if (escrito !== null && Number.isNaN(escrito)) return `${donde}: el peso no es un número.`;
      if (e.tipo === "peso" && escrito === null) {
        return `${donde}: ${e.unidad === "barras" ? "faltan las barras" : "falta el peso"}.`;
      }
      // Se guarda siempre en kg: las barras se convierten aquí y en ningún otro lado.
      return { reps, peso: escrito !== null && e.unidad === "barras" ? barrasAKg(escrito) : escrito };
    };
    if (e.tipo === "cardio") {
      const s = e.series[0];
      const vacio = (t?: string) => (t ?? "").trim() === "";
      if (!s || (vacio(s.reps) && vacio(s.inclinacion) && vacio(s.velocidad))) continue;
      const minutos = numero(s.reps);
      if (minutos === null) return { ok: false, error: `${e.nombre}: faltan los minutos.` };
      if (!Number.isInteger(minutos) || minutos < 1) return { ok: false, error: `${e.nombre}: los minutos van en número entero.` };
      const serie: SerieSesion = { reps: minutos, peso: null };
      for (const [campo, nombre] of [["inclinacion", "la inclinación"], ["velocidad", "la velocidad"]] as const) {
        if (vacio(s[campo])) continue;
        const n = numero(s[campo] ?? "");
        if (n === null || Number.isNaN(n) || n < 0) return { ok: false, error: `${e.nombre}: ${nombre} no es un número.` };
        serie[campo] = n;
      }
      ejercicios.push({ ejercicioId: e.ejercicioId, series: [serie] });
      continue;
    }
    const enBlanco = (s: CaidaBorrador) => s.reps.trim() === "" && s.peso.trim() === "";
    const series: SerieSesion[] = [];
    for (const [i, s] of e.series.entries()) {
      // Una serie en blanco se salta con todo y sus bajadas: prellenadas de la vez pasada, no
      // deben obligarla a borrarlas si hoy no la hizo.
      if (enBlanco(s)) continue;
      const serie = convertir(s, `${e.nombre}, serie ${i + 1}`);
      if (typeof serie === "string") return { ok: false, error: serie };
      const caidas: { reps: number; peso: number | null }[] = [];
      for (const [k, c] of (s.caidas ?? []).entries()) {
        if (enBlanco(c)) continue;
        const caida = convertir(c, `${e.nombre}, serie ${i + 1}, bajada ${k + 1}`);
        if (typeof caida === "string") return { ok: false, error: caida };
        caidas.push(caida);
      }
      series.push(caidas.length > 0 ? { ...serie, caidas } : serie);
    }
    if (series.length > 0) {
      ejercicios.push({ ejercicioId: e.ejercicioId, series, ...(e.biserie ? { biserie: e.biserie } : {}) });
    }
  }
  // Una biserie de la que solo se anotó un ejercicio se guarda como ejercicio suelto.
  for (const e of ejercicios) {
    if (e.biserie && ejercicios.filter((x) => x.biserie === e.biserie).length !== 2) delete e.biserie;
  }
  if (ejercicios.length === 0) return { ok: false, error: "Anota al menos una serie antes de guardar." };
  const datos: Envio = { id: b.id, ejercicios };
  if (typeof b.iniciado === "number") datos.iniciadaEn = b.iniciado;
  if (b.guiado && !b.edicion) datos.origen = "guiado";
  return { ok: true, datos };
}

/**
 * Las horas que puede quedarse abierto un entrenamiento antes de cerrarse solo (entrenador,
 * 2026-10-20): nadie entrena tres horas seguidas, así que es uno que se olvidó de terminar.
 */
export const HORAS_CIERRE = 3;

/**
 * El borrador sin las series ni las bajadas a medio llenar: las que `paraEnviar` reclamaría.
 * Al cerrarse solo no hay a quién preguntarle qué le faltó, así que se manda lo completo.
 */
export function soloCompletas(b: Borrador): Borrador {
  const completa = (e: EjercicioBorrador, s: SerieBorrador) =>
    paraEnviar({ ...b, ejercicios: [{ ...e, biserie: undefined, series: [{ ...s, caidas: undefined }] }] }).ok;
  return {
    ...b,
    ejercicios: b.ejercicios.map((e) => ({
      ...e,
      series: e.series
        .filter((s) => completa(e, s))
        .map((s) => (s.caidas ? { ...s, caidas: s.caidas.filter((c) => completa(e, c)) } : s)),
    })),
  };
}

/**
 * Si un entrenamiento lleva más de `HORAS_CIERRE` abierto, qué hacer con él: mandarlo con lo
 * completo, terminado a la hora de su última anotación (o a las 3 horas si nunca anotó), o
 * descartarlo si no tiene ninguna serie completa. null si todavía no toca, o si no aplica: una
 * corrección de uno pasado no se cierra sola, y uno sin hora de inicio no se sabe cuánto lleva.
 */
export function cierreAutomatico(
  b: Borrador | null,
  ahora: number
): { tipo: "enviar"; datos: Envio } | { tipo: "descartar" } | null {
  if (!b || b.edicion || typeof b.iniciado !== "number") return null;
  const limite = b.iniciado + HORAS_CIERRE * 3_600_000;
  if (ahora < limite) return null;
  const envio = paraEnviar(soloCompletas(b));
  if (!envio.ok) return { tipo: "descartar" };
  const fin = typeof b.anotado === "number" && b.anotado > b.iniciado ? Math.min(b.anotado, limite) : limite;
  return { tipo: "enviar", datos: { ...envio.datos, fecha: b.fecha, terminadaEn: fin } };
}

/**
 * "2 series · 40 kg × 10, 42.5 kg × 8": lo anotado de un ejercicio, para su fila comprimida
 * cuando no es el activo. Cuenta solo las series con algo escrito.
 */
export function resumenSeries(e: EjercicioBorrador): string {
  if (e.tipo === "cardio") {
    const s = e.series[0];
    if (!s || s.reps.trim() === "") return "Sin anotar";
    const n = (t?: string) => (t && t.trim() !== "" ? Number(t.trim().replace(",", ".")) : undefined);
    return textoCardio({ reps: Number(s.reps.trim()), inclinacion: n(s.inclinacion), velocidad: n(s.velocidad) }, e.ejercicioId);
  }
  const llenas = e.series.filter((s) => s.reps.trim() !== "" || s.peso.trim() !== "");
  if (llenas.length === 0) return "Sin anotar";
  const una = (s: CaidaBorrador) => {
    const reps = s.reps.trim() || "?";
    if (e.tipo === "tiempo") return `${reps} s`;
    const peso = s.peso.trim().replace(",", ".");
    const unidad = e.unidad === "barras" ? (peso === "1" ? "barra" : "barras") : "kg";
    return peso === "" ? `× ${reps}` : `${peso} ${unidad} × ${reps}`;
  };
  const conAlgo = (s: CaidaBorrador) => s.reps.trim() !== "" || s.peso.trim() !== "";
  const texto = llenas.map((s) => [s, ...(s.caidas ?? []).filter(conAlgo)].map(una).join(" ↓ "));
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
  /** Los minutos en las máquinas de cardio (su `reps`); 0 sin banco o sin cardio. */
  minutosCardio: number;
}

const LETRAS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Los entrenamientos que se buscan por semana: el "2 / 5" de la tarjeta de Inicio. El mismo
 * para todas, tenga su rutina los días que tenga (decisión del entrenador, 2026-10-14).
 */
export const OBJETIVO_SEMANAL = 5;

/**
 * Lo que lleva entrenado en la semana de [hoy], de lunes a domingo, contado solo con lo que ELLA
 * anotó. De la rutina no sale nada: Registro no sigue la rutina (ver arriba).
 *
 * Las fechas se arman a mediodía UTC, como `lunesDe`, para que la zona del navegador no mueva
 * un día a la semana de al lado.
 */
export function resumenSemana(
  sesiones: readonly Sesion[], hoy: string, banco: readonly EjercicioBanco[] = []
): ResumenSemana {
  const cardio = new Set(banco.filter((b) => b.tipo === "cardio").map((b) => b.id));
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
    minutosCardio: deLaSemana.reduce((total, s) => total + s.ejercicios
      .filter((e) => cardio.has(e.ejercicioId))
      .reduce((n, e) => n + e.series.reduce((m, x) => m + x.reps, 0), 0), 0),
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
