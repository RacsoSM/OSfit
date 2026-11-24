import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";

/**
 * Torre de discos, el minijuego de la web (entrenador, 2026-11-24), y su tabla de puntuaciones.
 *
 * Cada clienta tiene un documento `juegoDiscos/{clienteId}` con su mejor puntuación de siempre
 * y la del mes en curso. Solo estas funciones lo escriben y lo leen (las reglas lo cierran a las
 * clientas), así nadie se pone una puntuación a mano: `guardarPartidaDiscos` revisa que la
 * partida sea posible antes de guardarla.
 */

/** Lo mínimo que tarda un disco en apilarse (igual que `MS_MINIMOS_POR_DISCO` en la web). */
export const MS_MINIMOS_POR_DISCO = 250;
export const MAXIMO_DISCOS = 2000;
const MAXIMA_DURACION_MS = 3 * 60 * 60 * 1000;

export interface Partida { puntos: number; apilados: number; duracionMs: number }

/** La partida si es posible, o null. Cada disco vale 1 o 2 (perfecto) y tarda un mínimo. */
export function partidaValida(x: unknown): Partida | null {
  if (!x || typeof x !== "object") return null;
  const { puntos, apilados, duracionMs } = x as Record<string, unknown>;
  const entero = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
  if (!entero(puntos) || !entero(apilados) || !entero(duracionMs)) return null;
  if (apilados > MAXIMO_DISCOS || duracionMs > MAXIMA_DURACION_MS) return null;
  if (puntos < apilados || puntos > apilados * 2) return null;
  if (duracionMs < apilados * MS_MINIMOS_POR_DISCO) return null;
  return { puntos, apilados, duracionMs };
}

/** "Valeria Ruiz Pérez" → "Valeria R."; un solo nombre queda igual. */
export function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "Sin nombre";
  return partes.length === 1 ? partes[0]! : `${partes[0]} ${partes[1]!.charAt(0).toUpperCase()}.`;
}

export interface Registro {
  clienteId: string;
  nombre: string;
  mejor: number;
  mes: string | null;
  mejorMes: number;
}

export interface FilaTabla { puesto: number; nombre: string; puntos: number; esTuyo: boolean }
export interface TablaDiscos {
  mes: string;
  esteMes: FilaTabla[];
  historico: FilaTabla[];
  /** Lo suyo, aunque no haya jugado (0). */
  tuMejor: number;
  tuMejorMes: number;
}

function ordenar(filas: { nombre: string; puntos: number; esTuyo: boolean }[]): FilaTabla[] {
  const o = filas.filter((f) => f.puntos > 0).sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, "es"));
  // Empates: mismo puesto ("1, 1, 3").
  let puesto = 0;
  return o.map((f, i) => {
    if (i === 0 || o[i - 1]!.puntos !== f.puntos) puesto = i + 1;
    return { puesto, ...f };
  });
}

export function armarTabla(registros: readonly Registro[], clienteId: string, mes: string): TablaDiscos {
  const mio = registros.find((r) => r.clienteId === clienteId);
  return {
    mes,
    esteMes: ordenar(registros.filter((r) => r.mes === mes)
      .map((r) => ({ nombre: nombreCorto(r.nombre), puntos: r.mejorMes, esTuyo: r.clienteId === clienteId }))),
    historico: ordenar(registros.map((r) => ({ nombre: nombreCorto(r.nombre), puntos: r.mejor, esTuyo: r.clienteId === clienteId }))),
    tuMejor: mio?.mejor ?? 0,
    tuMejorMes: mio && mio.mes === mes ? mio.mejorMes : 0,
  };
}

function registroDesdeDoc(id: string, d: Record<string, unknown>): Registro {
  const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
  return {
    clienteId: id,
    nombre: typeof d.nombre === "string" ? d.nombre : "",
    mejor: num(d.mejor),
    mes: typeof d.mes === "string" ? d.mes : null,
    mejorMes: num(d.mejorMes),
  };
}

async function leerTabla(clienteId: string): Promise<TablaDiscos> {
  const snap = await db().collection("juegoDiscos").get();
  return armarTabla(snap.docs.map((d) => registroDesdeDoc(d.id, d.data())), clienteId, hoyEnMazatlan().slice(0, 7));
}

/** Guarda la partida (si mejora algo) y devuelve la tabla al día, con si fue récord. */
export const guardarPartidaDiscos = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const partida = partidaValida(request.data);
  if (!partida) throw new HttpsError("invalid-argument", "partida_invalida");

  const firestore = db();
  const mes = hoyEnMazatlan().slice(0, 7);
  const nombre = ((await firestore.collection("clientes").doc(clienteId).get()).get("nombre") as string | undefined)?.trim() || "";
  const ref = firestore.collection("juegoDiscos").doc(clienteId);
  const { recordHistorico, recordMes } = await firestore.runTransaction(async (tx) => {
    const antes = registroDesdeDoc(clienteId, (await tx.get(ref)).data() ?? {});
    const mejorMesAntes = antes.mes === mes ? antes.mejorMes : 0;
    const recordHistorico = partida.puntos > antes.mejor;
    const recordMes = partida.puntos > mejorMesAntes;
    tx.set(ref, {
      nombre,
      mejor: Math.max(antes.mejor, partida.puntos),
      mes,
      mejorMes: Math.max(mejorMesAntes, partida.puntos),
      partidas: FieldValue.increment(1),
      ultima: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { recordHistorico, recordMes };
  });
  return { recordHistorico, recordMes, tabla: await leerTabla(clienteId) };
});

export const tablaDiscos = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  return leerTabla(clienteId);
});
