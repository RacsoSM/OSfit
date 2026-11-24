import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";

/**
 * Torre de discos, el minijuego de la web (entrenador, 2026-11-24), y su tabla de puntuaciones.
 *
 * Cada clienta tiene un documento `juegoDiscos/{clienteId}` con su mejor puntuación de siempre
 * (la tabla "Records"). Solo estas funciones lo escriben y lo leen (las reglas lo cierran a las
 * clientas), así nadie se pone una puntuación a mano: `guardarPartidaDiscos` revisa que la
 * partida sea posible antes de guardarla.
 */

/** Lo mínimo que tarda un disco en apilarse (igual que `MS_MINIMOS_POR_DISCO` en la web). */
export const MS_MINIMOS_POR_DISCO = 250;
export const MAXIMO_DISCOS = 2000;
const MAXIMA_DURACION_MS = 3 * 60 * 60 * 1000;

export interface Partida { puntos: number; apilados: number; duracionMs: number }

/**
 * La partida si es posible, o null. Cada disco tarda un mínimo en apilarse. La puntuación es el
 * número de discos (entrenador, 2026-11-24); se aceptan aún los `puntos` hasta el doble que
 * mandaban las páginas abiertas antes del cambio, pero lo que cuenta es `apilados`.
 */
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

/** Su nombre completo, con los espacios en orden (entrenador, 2026-11-24: "nombre completo"). */
export function nombreVisible(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, " ");
  return limpio === "" ? "Sin nombre" : limpio;
}

export interface Registro { clienteId: string; nombre: string; mejor: number }

export interface FilaTabla { puesto: number; nombre: string; puntos: number; esTuyo: boolean }
/** Los records: la mejor partida de cada quien, de siempre. Cuentan todas, activas o no. */
export interface TablaDiscos { filas: FilaTabla[]; tuMejor: number }

export function armarTabla(registros: readonly Registro[], clienteId: string): TablaDiscos {
  const o = registros.filter((r) => r.mejor > 0)
    .map((r) => ({ nombre: nombreVisible(r.nombre), puntos: r.mejor, esTuyo: r.clienteId === clienteId }))
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, "es"));
  // Empates: mismo puesto ("1, 1, 3").
  let puesto = 0;
  const filas = o.map((f, i) => {
    if (i === 0 || o[i - 1]!.puntos !== f.puntos) puesto = i + 1;
    return { puesto, ...f };
  });
  return { filas, tuMejor: registros.find((r) => r.clienteId === clienteId)?.mejor ?? 0 };
}

function registroDesdeDoc(id: string, d: Record<string, unknown>): Registro {
  return {
    clienteId: id,
    nombre: typeof d.nombre === "string" ? d.nombre : "",
    mejor: typeof d.mejor === "number" && Number.isFinite(d.mejor) ? d.mejor : 0,
  };
}

async function leerTabla(clienteId: string): Promise<TablaDiscos> {
  const snap = await db().collection("juegoDiscos").get();
  return armarTabla(snap.docs.map((d) => registroDesdeDoc(d.id, d.data())), clienteId);
}

/**
 * A quiénes acaba de rebasar: quienes estaban arriba o empatadas con su récord anterior y ahora
 * quedaron abajo del nuevo (entrenador, 2026-11-24: "si alguien más juega y me supera, que me
 * llegue una notificación"). A quien ya iba ganando no se le avisa otra vez.
 */
export function superadas(registros: readonly Registro[], jugadoraId: string, antes: number, nuevo: number): string[] {
  if (nuevo <= antes) return [];
  return registros
    .filter((r) => r.clienteId !== jugadoraId && r.mejor > 0 && r.mejor >= antes && r.mejor < nuevo)
    .map((r) => r.clienteId);
}

export interface AvisoSuperada { id: string; titulo: string; texto: string; abrir: { ventana: "juego" } }

/** El aviso para quien fue rebasada. El id fijo evita mandarlo dos veces si se reintenta. */
export function avisoSuperada(superadaId: string, jugadoraId: string, nombre: string, nuevo: number): AvisoSuperada {
  return {
    id: `auto_torreDiscos_${superadaId}_${jugadoraId}_${nuevo}`,
    titulo: `${nombreVisible(nombre)} te ha superado en Torre de discos`,
    texto: "¡Juega para intentar quitarle su lugar en el marcador!",
    abrir: { ventana: "juego" },
  };
}

/** Guarda la partida (si mejora algo) y devuelve la tabla al día, con si fue récord. */
export const guardarPartidaDiscos = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const partida = partidaValida(request.data);
  if (!partida) throw new HttpsError("invalid-argument", "partida_invalida");

  const firestore = db();
  // El nombre de hoy: si el entrenador lo corrige, la tabla se pone al día en su próxima partida.
  const nombre = ((await firestore.collection("clientes").doc(clienteId).get()).get("nombre") as string | undefined)?.trim() || "";
  const ref = firestore.collection("juegoDiscos").doc(clienteId);
  const { record, mejorAntes } = await firestore.runTransaction(async (tx) => {
    const antes = registroDesdeDoc(clienteId, (await tx.get(ref)).data() ?? {});
    tx.set(ref, {
      nombre,
      mejor: Math.max(antes.mejor, partida.apilados),
      partidas: FieldValue.increment(1),
      ultima: FieldValue.serverTimestamp(),
      ...(partida.apilados > antes.mejor ? { mejorEn: hoyEnMazatlan() } : {}),
    }, { merge: true });
    return { record: partida.apilados > antes.mejor, mejorAntes: antes.mejor };
  });
  const snap = await firestore.collection("juegoDiscos").get();
  const registros = snap.docs.map((d) => registroDesdeDoc(d.id, d.data()));
  if (record) await avisarSuperadas(registros, clienteId, nombre, mejorAntes, partida.apilados);
  return { record, tabla: armarTabla(registros, clienteId) };
});

/**
 * Les deja el aviso en `notificaciones/`: el trigger `enviarNotificacion` lo pone en su buzón y
 * lo manda a sus teléfonos (solo a las activas con notificaciones encendidas). Si falla, la
 * partida ya quedó guardada: no se le avisa, pero no se pierde nada.
 */
async function avisarSuperadas(registros: readonly Registro[], jugadoraId: string, nombre: string, antes: number, nuevo: number): Promise<void> {
  const ids = superadas(registros, jugadoraId, antes, nuevo);
  if (ids.length === 0) return;
  try {
    const lote = db().batch();
    for (const id of ids) {
      const a = avisoSuperada(id, jugadoraId, nombre, nuevo);
      lote.set(db().collection("notificaciones").doc(a.id), {
        id: a.id, titulo: a.titulo, texto: a.texto,
        destino: "elegidas", clientesElegidos: [id],
        creada: FieldValue.serverTimestamp(), estado: "pendiente", enviadas: 0, fallidas: 0,
        automatico: "torreDiscos", abrir: a.abrir,
      });
    }
    await lote.commit();
  } catch (error) {
    logger.error("No se pudo avisar a las superadas en Torre de discos", { jugadoraId, error });
  }
}

export const tablaDiscos = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  return leerTabla(clienteId);
});
