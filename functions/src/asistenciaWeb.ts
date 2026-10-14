import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";

/**
 * La asistencia que se marca sola cuando la clienta inicia un entrenamiento en Registro, para
 * que el entrenador la vea en su app (backlog 2, punto 21).
 *
 * Escribe lo mismo que la app al marcar asistencia (`FirestoreAsistenciaRepository`): un
 * documento en `asistencias` con el día de la rutina que hizo y su variación, de los que la
 * app deduce qué día le toca después. Y refresca en la ficha el trío denormalizado que lee la
 * web (`ultimoDia`…), como hace `SincronizadorDiaWeb` en la app: si no, la web no se enteraría
 * de que ya vino hoy.
 *
 * El día y la variación se calculan aquí, no los manda la página: son los mismos que la web le
 * muestra ("Hoy te toca Pierna"), con las mismas reglas (`web/src/dia.ts` y `variacion.ts`).
 */

/** Hoy no hay día que hacer: ya completó el ciclo de la semana. GEMELO: `DESCANSO` de `web/src/dia.ts`. */
const DESCANSO = "descanso" as const;

export interface Trio {
  dia: number | null | undefined;
  fecha: string | null | undefined;
  esAncla: boolean | undefined;
}

function aMediodia(fecha: string): Date {
  return new Date(`${fecha}T12:00:00Z`);
}

export function esFinDeSemana(fecha: string): boolean {
  const dia = aMediodia(fecha).getUTCDay();
  return dia === 0 || dia === 6;
}

/** GEMELO: `domingoAnterior` de `web/src/dia.ts`. */
function domingoAnterior(fecha: string): string {
  const d = aMediodia(fecha);
  const diaSemana = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (diaSemana === 0 ? 6 : diaSemana - 1) - 1);
  return d.toISOString().slice(0, 10);
}

/** GEMELO: `interpretar` de `web/src/dia.ts` (y `RutinaProgressCalculator.interpretar`). */
export function interpretar(
  valor: Trio,
  totalDias: number,
  fecha: string,
  reinicioSemanal: boolean
): number | null | typeof DESCANSO {
  if (valor.dia == null || totalDias <= 0) return null;
  const acotado = Math.min(Math.max(valor.dia, 0), totalDias - 1);
  if (reinicioSemanal && valor.fecha != null) {
    const domingo = domingoAnterior(fecha);
    if (valor.esAncla && valor.fecha < domingo) return 0;
    if (!valor.esAncla && valor.fecha <= domingo) return 0;
  }
  if (valor.esAncla) return acotado;
  if (valor.fecha === fecha) return acotado;
  if (reinicioSemanal && acotado + 1 >= totalDias) return DESCANSO;
  return acotado + 1 >= totalDias ? 0 : acotado + 1;
}

export interface AsistenciaLeida {
  fecha: string;
  asistio: boolean;
  diaRutinaRealizado: number | null;
  variacionRealizada: number | null;
}

/** GEMELO: `variacionQueToca` de `web/src/variacion.ts`. */
export function variacionQueToca(
  diaDelCiclo: number,
  asistencias: AsistenciaLeida[],
  fecha: string,
  totalVariaciones: number
): number {
  if (totalVariaciones <= 1) return 0;
  let ultima: AsistenciaLeida | null = null;
  for (const a of asistencias) {
    if (!a.asistio || a.diaRutinaRealizado !== diaDelCiclo || a.fecha > fecha) continue;
    if (ultima === null || a.fecha > ultima.fecha) ultima = a;
  }
  if (ultima === null) return 0;
  const realizada = Math.min(Math.max(ultima.variacionRealizada ?? 0, 0), totalVariaciones - 1);
  return ultima.fecha === fecha ? realizada : (realizada + 1) % totalVariaciones;
}

export interface ClienteLeido {
  trio: Trio;
  /** Cuántas variaciones tiene cada día de su rutina (0 = día normal). */
  variacionesPorDia: number[];
  reinicioSemanal: boolean;
}

export type Plan =
  | { accion: "nada" }
  | {
      accion: "marcar";
      diaRutinaRealizado: number | null;
      variacionRealizada: number | null;
      /** El trío nuevo de la ficha, o null si esta asistencia no lo mueve. */
      trio: { ultimoDia: number; ultimoDiaFecha: string; ultimoDiaEsAncla: false } | null;
    };

/**
 * Qué hacer con la asistencia de [fecha]. Pura para poder probarla.
 *
 * - Si ya está marcada como asistencia (la marcó el entrenador o un entrenamiento anterior del
 *   mismo día), no se toca: lo que haya puesto él manda.
 * - Si no hay, o era falta, se marca. El día de la rutina es el que la web le muestra para esa
 *   fecha. Solo cuenta si la asistencia es la más nueva que el trío conoce (un entrenamiento
 *   mandado tarde, sin internet, puede ser de un día ya superado) y no cae antes de un día
 *   asignado a mano (ancla): ahí se marca la asistencia sin día, que no mueve la rutina.
 */
export function planAsistencia(
  cliente: ClienteLeido,
  existente: AsistenciaLeida | null,
  asistencias: AsistenciaLeida[],
  fecha: string
): Plan {
  if (existente?.asistio) return { accion: "nada" };

  const total = cliente.variacionesPorDia.length;
  const { trio } = cliente;
  const posterior = trio.fecha == null ||
    (trio.esAncla ? fecha > trio.fecha : fecha >= trio.fecha);
  const dia = total > 0 && posterior && !esFinDeSemana(fecha)
    ? interpretar(trio, total, fecha, cliente.reinicioSemanal)
    : null;
  if (dia === null || dia === DESCANSO) {
    return { accion: "marcar", diaRutinaRealizado: null, variacionRealizada: null, trio: null };
  }
  const variaciones = cliente.variacionesPorDia[dia] ?? 0;
  return {
    accion: "marcar",
    diaRutinaRealizado: dia,
    variacionRealizada: variaciones > 0 ? variacionQueToca(dia, asistencias, fecha, variaciones) : null,
    trio: { ultimoDia: dia, ultimoDiaFecha: fecha, ultimoDiaEsAncla: false },
  };
}

function leerAsistencia(d: FirebaseFirestore.DocumentSnapshot): AsistenciaLeida {
  const num = (campo: string) => (typeof d.get(campo) === "number" ? (d.get(campo) as number) : null);
  return {
    fecha: typeof d.get("fecha") === "string" ? (d.get("fecha") as string) : "",
    asistio: d.get("asistio") === true,
    diaRutinaRealizado: num("diaRutinaRealizado"),
    variacionRealizada: num("variacionRealizada"),
  };
}

/**
 * Marca la asistencia de la clienta en [fecha] si todavía no está. La usan `marcarAsistencia`
 * (al iniciar el entrenamiento) y `registrarSesion` (al guardarlo: si lo empezó sin internet,
 * la asistencia llega con el entrenamiento). Devuelve si escribió algo.
 */
export async function marcarAsistenciaDelDia(clienteId: string, fecha: string): Promise<boolean> {
  const firestore = db();
  const clienteRef = firestore.collection("clientes").doc(clienteId);
  return firestore.runTransaction(async (tx) => {
    const cliente = await tx.get(clienteRef);
    if (!cliente.exists) return false;
    const todas = await tx.get(firestore.collection("asistencias").where("clienteId", "==", clienteId));
    const delDia = todas.docs.find((d) => d.get("fecha") === fecha);
    const asistencias = todas.docs.map(leerAsistencia);

    const dias = (cliente.get("rutinaAsignada.dias") as { variaciones?: unknown[] }[] | undefined) ?? [];
    const plan = planAsistencia(
      {
        trio: {
          dia: cliente.get("ultimoDia") as number | null | undefined,
          fecha: cliente.get("ultimoDiaFecha") as string | null | undefined,
          esAncla: cliente.get("ultimoDiaEsAncla") as boolean | undefined,
        },
        variacionesPorDia: dias.map((d) => (Array.isArray(d?.variaciones) ? d.variaciones.length : 0)),
        reinicioSemanal: cliente.get("rutinaAsignada.reinicioSemanal") === true,
      },
      delDia ? leerAsistencia(delDia) : null,
      asistencias,
      fecha
    );
    if (plan.accion === "nada") return false;

    const campos = {
      clienteId,
      fecha,
      asistio: true,
      justificada: false,
      justificadaPorCliente: false,
      diaRutinaRealizado: plan.diaRutinaRealizado,
      variacionRealizada: plan.variacionRealizada,
      // Para saber de dónde salió: la app ignora el campo.
      marcadaDesde: "registro",
      marcadaEn: FieldValue.serverTimestamp(),
    };
    // Si era falta se actualiza ese mismo documento (la app busca uno por clienta y día). Si
    // no hay, uno con id fijo: dos toques seguidos no crean dos asistencias del mismo día.
    const ref: DocumentReference = delDia?.ref ??
      firestore.collection("asistencias").doc(`${clienteId}_${fecha}`);
    if (delDia) tx.update(ref, campos);
    else tx.set(ref, { ...campos, nota: "" });
    if (plan.trio) tx.update(clienteRef, plan.trio);
    return true;
  });
}

/** Al tocar "Iniciar entrenamiento" en Registro. */
export const marcarAsistencia = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  try {
    const marcada = await marcarAsistenciaDelDia(clienteId, hoyEnMazatlan());
    return { ok: true, marcada };
  } catch (error) {
    throw new HttpsError("internal", (error as Error).message);
  }
});
