import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import { actualizarDuracionDelDia, marcarAsistenciaDelDia } from "./asistenciaWeb";

/**
 * Registro: la clienta anota lo que entrenó (los ejercicios que el coach le dijo en el gym,
 * sigan o no la rutina de la app) y esto lo guarda en `clientes/{cid}/sesiones/{id}`.
 *
 * Pasa por una función como todo lo que escribe la página: las reglas la dejan en solo lectura.
 * Ver `docs/superpowers/specs/2026-10-10-mapa-fuerza-entrenamiento-design.md`, "Sesiones".
 */

export interface DelBanco { nombre: string; tipo: "peso" | "corporal" | "tiempo"; }

/**
 * `caidas`: las bajadas de un dropset, hechas sin descanso después de la serie. Se guardan para
 * el historial y el volumen; la fuerza (`fuerza.ts`) solo lee `reps` y `peso` de la serie.
 */
export interface Serie { reps: number; peso: number | null; caidas?: { reps: number; peso: number | null }[]; }
/** `biserie`: los dos ejercicios de una biserie llevan la misma marca y van seguidos. */
export interface EjercicioSesion { ejercicioId: string; nombre: string; series: Serie[]; biserie?: string; }
export interface SesionValida { id: string; ejercicios: EjercicioSesion[]; }

const MAX_EJERCICIOS = 30;
const MAX_SERIES = 20;
const MAX_PESO = 500;
const MAX_REPS = 100;
/** En los de tiempo, `reps` son segundos: una hora de plancha ya es un error de captura. */
const MAX_SEGUNDOS = 3600;
const MAX_CAIDAS = 5;
const BISERIE_VALIDA = /^b[0-9]{1,3}$/;

/**
 * El id lo genera el borrador del navegador y se usa como id del documento. Así, si la
 * respuesta se pierde y la clienta vuelve a tocar "Guardar", se reescribe la misma sesión en
 * vez de duplicarla.
 */
const ID_VALIDO = /^[A-Za-z0-9_-]{8,40}$/;

/** Reps y peso de una serie o de una bajada, sin sus bajadas. */
function marcaValida(s: unknown, tipo: DelBanco["tipo"]): { reps: number; peso: number | null } | null {
  if (typeof s !== "object" || s === null) return null;
  const { reps, peso } = s as { reps?: unknown; peso?: unknown };
  const maxReps = tipo === "tiempo" ? MAX_SEGUNDOS : MAX_REPS;
  if (typeof reps !== "number" || !Number.isInteger(reps) || reps < 1 || reps > maxReps) return null;

  const sinPeso = peso === null || peso === undefined;
  const pesoOk = typeof peso === "number" && Number.isFinite(peso) && peso >= 0 && peso <= MAX_PESO;
  if (tipo === "peso" && !pesoOk) return null;
  // En los corporales el peso es lastre opcional (dominadas con cinturón).
  if (tipo === "corporal" && !sinPeso && !pesoOk) return null;
  if (tipo === "tiempo" && !sinPeso) return null;
  return { reps, peso: pesoOk ? (peso as number) : null };
}

/** Una serie con sus bajadas, si trae. En los de tiempo no hay dropset. */
function serieValida(s: unknown, tipo: DelBanco["tipo"]): Serie | null {
  const serie = marcaValida(s, tipo);
  if (!serie) return null;
  const caidas = (s as { caidas?: unknown }).caidas;
  if (caidas === undefined || caidas === null) return serie;
  if (!Array.isArray(caidas) || caidas.length > MAX_CAIDAS || tipo === "tiempo") return null;
  if (caidas.length === 0) return serie;
  const validas: { reps: number; peso: number | null }[] = [];
  for (const c of caidas) {
    const v = marcaValida(c, tipo);
    if (!v) return null;
    validas.push(v);
  }
  return { ...serie, caidas: validas };
}

/**
 * La sesión lista para guardar, o el código del error. Pura para poder probarla: el banco
 * llega ya leído. El nombre se copia del banco y no del navegador, por si el banco cambia
 * después y para que nadie pueda guardar un nombre inventado.
 */
export function sesionValida(data: unknown, banco: ReadonlyMap<string, DelBanco>): SesionValida | string {
  if (typeof data !== "object" || data === null) return "id_invalido";
  const { id, ejercicios } = data as { id?: unknown; ejercicios?: unknown };
  if (typeof id !== "string" || !ID_VALIDO.test(id)) return "id_invalido";
  if (!Array.isArray(ejercicios) || ejercicios.length === 0) return "sesion_vacia";
  if (ejercicios.length > MAX_EJERCICIOS) return "sesion_muy_larga";

  const salida: EjercicioSesion[] = [];
  for (const e of ejercicios) {
    const { ejercicioId, series, biserie } = (e ?? {}) as { ejercicioId?: unknown; series?: unknown; biserie?: unknown };
    const delBanco = typeof ejercicioId === "string" ? banco.get(ejercicioId) : undefined;
    if (!delBanco) return "ejercicio_desconocido";
    if (!Array.isArray(series) || series.length === 0 || series.length > MAX_SERIES) {
      return "serie_invalida";
    }
    const validas: Serie[] = [];
    for (const s of series) {
      const v = serieValida(s, delBanco.tipo);
      if (!v) return "serie_invalida";
      validas.push(v);
    }
    if (biserie !== undefined && biserie !== null && (typeof biserie !== "string" || !BISERIE_VALIDA.test(biserie))) {
      return "biserie_invalida";
    }
    salida.push({
      ejercicioId: ejercicioId as string,
      nombre: delBanco.nombre,
      series: validas,
      ...(typeof biserie === "string" ? { biserie } : {}),
    });
  }
  // Cada biserie es de exactamente dos ejercicios, seguidos.
  for (const [i, e] of salida.entries()) {
    if (!e.biserie) continue;
    const con = salida.filter((x) => x.biserie === e.biserie).length;
    const pegado = salida[i - 1]?.biserie === e.biserie || salida[i + 1]?.biserie === e.biserie;
    if (con !== 2 || !pegado) return "biserie_invalida";
  }
  return { id, ejercicios: salida };
}

/** Un entrenamiento de más de un día no existe: es un reloj mal puesto o un borrador olvidado. */
const MAX_DURACION_MS = 24 * 3_600_000;
/** Margen para relojes de teléfono adelantados. */
const MARGEN_FUTURO_MS = 5 * 60_000;

/**
 * La hora en que la clienta tocó "Iniciar entrenamiento", o null si no sirve. Viene del reloj
 * del teléfono, así que solo se acepta si es razonable; si no, la sesión se guarda sin ella y
 * el historial muestra la fecha sin la duración.
 */
export function inicioValido(ms: unknown, ahora: number): number | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  if (ms < ahora - MAX_DURACION_MS || ms > ahora + MARGEN_FUTURO_MS) return null;
  return ms;
}

/**
 * Lo más atrasado que se acepta un entrenamiento hecho sin internet: la web lo guarda en el
 * teléfono y lo manda cuando vuelve la señal (backlog 2, punto 11). Más de una semana ya no
 * es un bache de señal; se guarda como de hoy.
 */
const MAX_ATRASO_MS = 7 * 24 * 3_600_000;
const DIA_MS = 24 * 3_600_000;

/**
 * La hora en que tocó "Terminar entrenamiento", si es razonable. Del reloj del teléfono, como
 * `iniciadaEn`; solo importa cuando llega tarde.
 */
export function terminadaValida(ms: unknown, ahora: number): number | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  if (ms < ahora - MAX_ATRASO_MS || ms > ahora + MARGEN_FUTURO_MS) return null;
  return ms;
}

/**
 * El día del entrenamiento según el teléfono ("2026-10-14"), si es de la última semana y no
 * del futuro; si no, null y se usa hoy. Sin esto, uno hecho sin señal y mandado al día
 * siguiente quedaba con la fecha del día en que llegó.
 */
export function fechaValida(fecha: unknown, hoy: string): string | null {
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const dias = (Date.parse(hoy) - Date.parse(fecha)) / DIA_MS;
  return Number.isFinite(dias) && dias >= 0 && dias * DIA_MS <= MAX_ATRASO_MS ? fecha : null;
}

/**
 * "guiado" si se empezó con "▶ Empezar entrenamiento" desde la tarjeta del día (backlog 2,
 * punto 7); cualquier otra cosa es uno de Registro, "manual".
 */
export function origenValido(origen: unknown): "manual" | "guiado" {
  return origen === "guiado" ? "guiado" : "manual";
}

/** Los ejercicios del banco que trae la petición: lo que `sesionValida` necesita para validar. */
async function leerBanco(data: unknown): Promise<Map<string, DelBanco>> {
  const pedidos = (data as { ejercicios?: unknown } | null)?.ejercicios;
  const ids = Array.isArray(pedidos)
    ? [...new Set(pedidos.slice(0, MAX_EJERCICIOS)
        .map((e) => (e as { ejercicioId?: unknown })?.ejercicioId)
        .filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,60}$/.test(x)))]
    : [];

  const banco = new Map<string, DelBanco>();
  if (ids.length > 0) {
    const docs = await db().getAll(...ids.map((i) => db().collection("ejercicios").doc(i)));
    for (const d of docs) {
      if (d.exists) banco.set(d.id, { nombre: d.get("nombre"), tipo: d.get("tipo") });
    }
  }
  return banco;
}

export const registrarSesion = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const banco = await leerBanco(request.data);

  const sesion = sesionValida(request.data, banco);
  if (typeof sesion === "string") throw new HttpsError("invalid-argument", sesion);

  const datos = request.data as { iniciadaEn?: unknown; terminadaEn?: unknown; fecha?: unknown; origen?: unknown };
  const ahora = Date.now();
  // Hecho sin internet, puede llegar horas o días después: la fecha y las horas son las del
  // teléfono, no las de cuando llegó.
  const terminada = terminadaValida(datos?.terminadaEn, ahora);
  const tarde = terminada !== null && ahora - terminada > 10 * 60_000;
  const fecha = fechaValida(datos?.fecha, hoyEnMazatlan()) ?? hoyEnMazatlan();
  const inicio = inicioValido(datos?.iniciadaEn, terminada ?? ahora);
  await db().collection("clientes").doc(clienteId).collection("sesiones").doc(sesion.id).set({
    fecha,
    // `creada` es cuando terminó (tocó "Terminar entrenamiento"); `iniciada`, cuando lo empezó.
    // Al momento, la hora del servidor; si llegó tarde, la del teléfono.
    creada: tarde ? Timestamp.fromMillis(terminada) : FieldValue.serverTimestamp(),
    ...(inicio !== null ? { iniciada: Timestamp.fromMillis(inicio) } : {}),
    origen: origenValido(datos?.origen),
    ejercicios: sesion.ejercicios,
  });
  // La asistencia se marca al iniciar el entrenamiento (`marcarAsistencia`); esto la cubre si
  // lo inició sin internet. Si falla no se pierde el entrenamiento, que ya está guardado.
  await marcarAsistenciaDelDia(clienteId, fecha).catch((error) => {
    console.error("No se pudo marcar la asistencia al guardar el entrenamiento", clienteId, fecha, error);
  });
  // Y su duración, para quien entrena sin el cronómetro del entrenador.
  await actualizarDuracionDelDia(clienteId, fecha).catch((error) => {
    console.error("No se pudo poner la duración en la asistencia", clienteId, fecha, error);
  });
  return { ok: true, id: sesion.id, fecha };
});

/** El id de una sesión que la clienta quiere editar o borrar, o null si no sirve. */
export function idSesion(data: unknown): string | null {
  const id = (data as { id?: unknown } | null)?.id;
  return typeof id === "string" && ID_VALIDO.test(id) ? id : null;
}

/**
 * Corrige un entrenamiento ya guardado (un peso mal escrito, una serie de más). Solo cambia
 * los ejercicios: la fecha y las horas de inicio y fin se quedan, porque son de cuando lo
 * entrenó y no de cuando lo corrigió. Valida igual que `registrarSesion`.
 */
export const editarSesion = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const id = idSesion(request.data);
  if (!id) throw new HttpsError("invalid-argument", "id_invalido");

  const ref = db().collection("clientes").doc(clienteId).collection("sesiones").doc(id);
  if (!(await ref.get()).exists) throw new HttpsError("not-found", "sesion_no_existe");

  const banco = await leerBanco(request.data);
  const sesion = sesionValida(request.data, banco);
  if (typeof sesion === "string") throw new HttpsError("invalid-argument", sesion);

  await ref.update({ ejercicios: sesion.ejercicios, editada: FieldValue.serverTimestamp() });
  return { ok: true, id };
});

/** Borra un entrenamiento de su historial. Solo los suyos: la ruta sale del claim, no del navegador. */
export const borrarSesion = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const id = idSesion(request.data);
  if (!id) throw new HttpsError("invalid-argument", "id_invalido");
  const ref = db().collection("clientes").doc(clienteId).collection("sesiones").doc(id);
  const fecha = (await ref.get()).get("fecha") as string | undefined;
  await ref.delete();
  // Sin ese entrenamiento, la duración del día cambia (o desaparece).
  if (fecha) {
    await actualizarDuracionDelDia(clienteId, fecha).catch((error) => {
      console.error("No se pudo actualizar la duración al borrar", clienteId, fecha, error);
    });
  }
  return { ok: true, id };
});
