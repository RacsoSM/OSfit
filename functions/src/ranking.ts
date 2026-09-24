import { onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import { fechasQueCuentan, rachaActual, rachaMasLarga } from "./rachas";

/**
 * El ranking de rachas que ve la web del cliente. Ver
 * `docs/superpowers/specs/2026-09-24-ranking-rachas-design.md`.
 *
 * Lo calcula el servidor porque las reglas solo dejan que cada cliente lea sus propias
 * asistencias, y abrirlas para esto expondria el historial completo de los demas. Aca se lee
 * todo con el Admin SDK y al navegador solo viaja lo que se pinta.
 */

export interface FilaRanking {
  puesto: number;
  nombre: string;
  racha: number;
  esTuyo: boolean;
}

export interface Ranking {
  /** Solo clientes activos. */
  actual: FilaRanking[];
  /** Todos, activos e inactivos: el salon de la fama. */
  historica: FilaRanking[];
}

export interface ClienteParaRanking {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface AsistenciaParaRanking {
  clienteId: string;
  fecha: string;
  asistio: boolean;
  justificada: boolean;
}

/** `activo` ausente o de tipo raro cuenta como inactivo: sale de la actual, sigue en la historica. */
export function clienteDesdeDoc(id: string, datos: Record<string, unknown>): ClienteParaRanking {
  const nombre = typeof datos.nombre === "string" && datos.nombre.trim() !== "" ? datos.nombre : "Sin nombre";
  return { id, nombre, activo: datos.activo === true };
}

export function asistenciaDesdeDoc(datos: Record<string, unknown>): AsistenciaParaRanking | null {
  if (typeof datos.clienteId !== "string" || typeof datos.fecha !== "string") return null;
  return {
    clienteId: datos.clienteId,
    fecha: datos.fecha,
    asistio: datos.asistio === true,
    justificada: datos.justificada === true,
  };
}

/**
 * Racha descendente y, dentro de un empate, alfabetico para que la lista no baile entre
 * aperturas. Los empates comparten puesto, igual que `calcularRanking` en Kotlin:
 * 10, 10, 8 -> 1, 1, 3.
 */
function ordenar(filas: Omit<FilaRanking, "puesto">[]): FilaRanking[] {
  const ordenadas = [...filas].sort((a, b) => b.racha - a.racha || a.nombre.localeCompare(b.nombre, "es"));
  let puesto = 0;
  return ordenadas.map((f, i) => {
    if (i === 0 || f.racha !== ordenadas[i - 1].racha) puesto = i + 1;
    return { puesto, nombre: f.nombre, racha: f.racha, esTuyo: f.esTuyo };
  });
}

export function armarRanking(
  clientes: ClienteParaRanking[],
  asistencias: AsistenciaParaRanking[],
  clienteId: string,
  hoy: string
): Ranking {
  const porCliente = new Map<string, AsistenciaParaRanking[]>();
  for (const a of asistencias) {
    const lista = porCliente.get(a.clienteId);
    if (lista) lista.push(a);
    else porCliente.set(a.clienteId, [a]);
  }

  const actual: Omit<FilaRanking, "puesto">[] = [];
  const historica: Omit<FilaRanking, "puesto">[] = [];
  for (const c of clientes) {
    const cuentan = fechasQueCuentan(porCliente.get(c.id) ?? []);
    const esTuyo = c.id === clienteId;
    if (c.activo) actual.push({ nombre: c.nombre, racha: rachaActual(cuentan, hoy), esTuyo });
    historica.push({ nombre: c.nombre, racha: rachaMasLarga(cuentan), esTuyo });
  }
  return { actual: ordenar(actual), historica: ordenar(historica) };
}

/**
 * Solo lectura: no escribe nada. Se piden las dos colecciones completas una vez cada una; para
 * un gimnasio son pocas lecturas. Si algun dia pesa, la mejora es cachear el resultado unos
 * minutos (ver el spec).
 */
export const obtenerRanking = onCall({ region: REGION }, async (request): Promise<Ranking> => {
  const clienteId = clienteDeLaSesion(request);
  const firestore = db();
  const [clientesSnap, asistenciasSnap] = await Promise.all([
    firestore.collection("clientes").get(),
    firestore.collection("asistencias").get(),
  ]);
  const clientes = clientesSnap.docs.map((d) => clienteDesdeDoc(d.id, d.data()));
  const asistencias = asistenciasSnap.docs
    .map((d) => asistenciaDesdeDoc(d.data()))
    .filter((a): a is AsistenciaParaRanking => a !== null);
  return armarRanking(clientes, asistencias, clienteId, hoyEnMazatlan());
});
