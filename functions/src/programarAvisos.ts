import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { REGION, db, hoyEnMazatlan } from "./comun";
import {
  avisosDesdeDoc,
  diaDeAvisoPago,
  idAviso,
  mensajePago,
  mensajeRacha,
  quiere,
  rachaPerdida,
  type ClienteParaAvisos,
  type Mensaje,
  type SalidaRacha,
  type TipoAviso,
} from "./avisosAutomaticos";
import { calcularDisponibles } from "./jugarRuleta";
import { castigoDelMes, mesAnterior } from "./reglasRuleta";

/** Código gRPC de "ya existe": el aviso de esa ocasión ya se había creado. */
const YA_EXISTE = 6;

function fechaEnMazatlan(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString("en-CA", { timeZone: "America/Mazatlan" });
}

/**
 * Deja el aviso en `notificaciones/` como si lo hubiera escrito la app: lo manda
 * `enviarNotificacion`, que ya sabe de tokens, tandas y tokens muertos, y queda en el
 * historial de Avisos del entrenador. `create()` con id fijo lo hace idempotente.
 */
async function encolar(tipo: TipoAviso, clienteId: string, ocasion: string, m: Mensaje): Promise<boolean> {
  try {
    await db().collection("notificaciones").doc(idAviso(tipo, clienteId, ocasion)).create({
      id: idAviso(tipo, clienteId, ocasion),
      titulo: m.titulo,
      texto: m.texto,
      destino: "elegidas",
      clientesElegidos: [clienteId],
      creada: FieldValue.serverTimestamp(),
      estado: "pendiente",
      enviadas: 0,
      fallidas: 0,
      automatico: tipo,
    });
    return true;
  } catch (error) {
    if ((error as { code?: unknown }).code === YA_EXISTE) return false;
    throw error;
  }
}

/** Vidas que le quedan este mes, o si le toca la ruleta. Mismas reglas que `revivirRacha`. */
async function salidaRacha(clienteId: string, hoy: string, asistencias: FirebaseFirestore.DocumentData[]): Promise<SalidaRacha> {
  const mes = hoy.slice(0, 7);
  const gastados = asistencias.filter(
    (a) => a.justificadaPorCliente === true && a.justificada === true &&
      typeof a.fecha === "string" && a.fecha.startsWith(`${mes}-`)
  ).length;
  const [anterior, actual] = await Promise.all([
    db().collection("ruletas").doc(`${clienteId}_${mesAnterior(mes)}`).get(),
    db().collection("ruletas").doc(`${clienteId}_${mes}`).get(),
  ]);
  const castigo = castigoDelMes(anterior.exists ? { gano: anterior.get("gano") === true } : null);
  const vidas = calcularDisponibles(gastados, castigo);
  if (vidas > 0) return { vidas };
  return actual.exists ? { nada: true } : { ruleta: true };
}

async function avisosDe(c: ClienteParaAvisos, hoy: string): Promise<number> {
  let encolados = 0;

  const dias = quiere(c, "recordatorioPago") ? diaDeAvisoPago(c.fechaPago, hoy) : null;
  if (dias !== null && (await encolar("recordatorioPago", c.id, `${c.fechaPago}_${dias}`, mensajePago(dias)))) {
    encolados++;
  }

  if (quiere(c, "rachaPerdida")) {
    const snap = await db().collection("asistencias").where("clienteId", "==", c.id).get();
    const crudas = snap.docs.map((d) => d.data());
    const perdida = rachaPerdida(
      crudas.map((a) => ({
        fecha: typeof a.fecha === "string" ? a.fecha : "",
        asistio: a.asistio === true,
        justificada: a.justificada === true,
      })),
      hoy
    );
    if (perdida) {
      const m = mensajeRacha(perdida.dias, await salidaRacha(c.id, hoy, crudas));
      if (await encolar("rachaPerdida", c.id, perdida.fecha, m)) encolados++;
    }
  }
  return encolados;
}

/**
 * Los avisos automáticos de cada mañana: racha perdida y recordatorio de pago, solo a las
 * clientas a las que el entrenador se los prendió (y con su llave de Notificaciones prendida).
 * Una clienta que falla no detiene a las demás.
 */
export const programarAvisos = onSchedule(
  { schedule: "0 9 * * *", timeZone: "America/Mazatlan", region: REGION },
  async () => {
    const hoy = hoyEnMazatlan();
    const snap = await db().collection("clientes").where("notificacionesWeb", "==", true).get();
    const clientes: ClienteParaAvisos[] = snap.docs.map((d) => {
      const pago = d.get("fechaProximoPago") as Timestamp | null | undefined;
      return {
        id: d.id,
        activo: d.get("activo") === true,
        notificacionesWeb: true,
        avisosAutomaticos: avisosDesdeDoc(d.data()),
        fechaPago: pago && typeof pago.toDate === "function" ? fechaEnMazatlan(pago) : null,
      };
    });

    let total = 0;
    for (const c of clientes) {
      try {
        total += await avisosDe(c, hoy);
      } catch (error) {
        logger.error("Avisos automáticos: falló una clienta", { clienteId: c.id, error });
      }
    }
    logger.info("Avisos automáticos", { hoy, clientes: clientes.length, encolados: total });
  }
);
