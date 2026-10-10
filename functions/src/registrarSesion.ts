import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";

/**
 * Registro: la clienta anota lo que entrenó (los ejercicios que el coach le dijo en el gym,
 * sigan o no la rutina de la app) y esto lo guarda en `clientes/{cid}/sesiones/{id}`.
 *
 * Pasa por una función como todo lo que escribe la página: las reglas la dejan en solo lectura.
 * Ver `docs/superpowers/specs/2026-10-10-mapa-fuerza-entrenamiento-design.md`, "Sesiones".
 */

export interface DelBanco { nombre: string; tipo: "peso" | "corporal" | "tiempo"; }

export interface Serie { reps: number; peso: number | null; }
export interface EjercicioSesion { ejercicioId: string; nombre: string; series: Serie[]; }
export interface SesionValida { id: string; ejercicios: EjercicioSesion[]; }

const MAX_EJERCICIOS = 30;
const MAX_SERIES = 20;
const MAX_PESO = 500;
const MAX_REPS = 100;
/** En los de tiempo, `reps` son segundos: una hora de plancha ya es un error de captura. */
const MAX_SEGUNDOS = 3600;

/**
 * El id lo genera el borrador del navegador y se usa como id del documento. Así, si la
 * respuesta se pierde y la clienta vuelve a tocar "Guardar", se reescribe la misma sesión en
 * vez de duplicarla.
 */
const ID_VALIDO = /^[A-Za-z0-9_-]{8,40}$/;

function serieValida(s: unknown, tipo: DelBanco["tipo"]): Serie | null {
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
    const { ejercicioId, series } = (e ?? {}) as { ejercicioId?: unknown; series?: unknown };
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
    salida.push({ ejercicioId: ejercicioId as string, nombre: delBanco.nombre, series: validas });
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

export const registrarSesion = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);

  const pedidos = (request.data as { ejercicios?: unknown })?.ejercicios;
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

  const sesion = sesionValida(request.data, banco);
  if (typeof sesion === "string") throw new HttpsError("invalid-argument", sesion);

  const fecha = hoyEnMazatlan();
  const inicio = inicioValido((request.data as { iniciadaEn?: unknown })?.iniciadaEn, Date.now());
  await db().collection("clientes").doc(clienteId).collection("sesiones").doc(sesion.id).set({
    fecha,
    // `creada` es cuando terminó (tocó "Terminar entrenamiento"); `iniciada`, cuando lo empezó.
    creada: FieldValue.serverTimestamp(),
    ...(inicio !== null ? { iniciada: Timestamp.fromMillis(inicio) } : {}),
    origen: "manual",
    ejercicios: sesion.ejercicios,
  });
  return { ok: true, id: sesion.id, fecha };
});
