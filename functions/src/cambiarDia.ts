import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import { variacionQueToca, type AsistenciaLeida } from "./asistenciaWeb";

const MOTIVO_MAXIMO = 200;

/**
 * Que hacer con la asistencia de hoy al cambiar de dia. Pura para poder probarla.
 *
 * - Sin asistencia de hoy (o falta): solo se mueve el ancla, como siempre.
 * - Asistencia que marco la web al EMPEZAR un entrenamiento (`marcadaDesde: "registro"`) y
 *   todavia sin ningun entrenamiento guardado hoy: no entreno aun, solo apreto "Empezar". Se
 *   deja cambiar y se reescribe el dia de esa asistencia (2026-11-24: Jesica y Brianda
 *   empezaban el entrenamiento, se arrepentian del dia y la funcion las rechazaba).
 * - Asistencia que marco el entrenador, o con un entrenamiento ya guardado hoy: el dia esta
 *   hecho y no se cambia.
 *
 * GEMELO de `diaCambiable` en `web/src/ui/accionDia.ts`.
 */
export function planCambioDia(
  asistenciaHoy: { asistio?: unknown; marcadaDesde?: unknown } | undefined,
  entrenoGuardadoHoy: boolean
): "ancla" | "reescribir" | "bloquear" {
  if (asistenciaHoy?.asistio !== true) return "ancla";
  return asistenciaHoy.marcadaDesde === "registro" && !entrenoGuardadoHoy ? "reescribir" : "bloquear";
}

/**
 * Cambia el dia de rutina que le toca al cliente. Sin limite de uso: si cambia dos veces el
 * mismo dia, la segunda pisa a la primera.
 *
 * Hace lo mismo que `AsignarDiaManual.ejecutar` en Kotlin, y por las mismas razones: ancla
 * fechada ayer y, si hoy ya hay asistencia, su dia reescrito al nuevo. Si esa logica cambia
 * alla, tiene que cambiar aca.
 */
export const cambiarDia = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);

  const datos = request.data as { diaIndex?: unknown; motivo?: unknown } | undefined;
  const diaIndex = datos?.diaIndex;
  const motivo = typeof datos?.motivo === "string" ? datos.motivo.trim() : "";
  if (typeof diaIndex !== "number" || !Number.isInteger(diaIndex) || diaIndex < 0) {
    throw new HttpsError("invalid-argument", "dia_invalido");
  }
  if (motivo === "" || motivo.length > MOTIVO_MAXIMO) {
    throw new HttpsError("invalid-argument", "motivo_invalido");
  }

  const firestore = db();
  const clienteRef = firestore.collection("clientes").doc(clienteId);
  const cliente = await clienteRef.get();
  if (!cliente.exists) throw new HttpsError("not-found", "cliente_no_encontrado");

  // El rango valido sale de la rutina que tiene asignada: sin esto, un diaIndex fuera de
  // rango dejaria el ancla apuntando a un dia que no existe y la pagina no podria pintarlo.
  const totalDias = (cliente.get("rutinaAsignada.dias") as unknown[] | undefined)?.length ?? 0;
  if (totalDias === 0) throw new HttpsError("failed-precondition", "sin_rutina");
  if (diaIndex >= totalDias) throw new HttpsError("invalid-argument", "dia_invalido");

  const hoy = hoyEnMazatlan();
  // El ancla se fecha el dia ANTERIOR a hoy porque el calculador toma el historial
  // estrictamente despues del ancla: asi la asistencia de hoy entra en la ventana y manana
  // el ciclo avanza, en vez de quedarse trabado en el dia asignado para siempre.
  const ancla = new Date(`${hoy}T12:00:00Z`);
  ancla.setUTCDate(ancla.getUTCDate() - 1);
  const anclaFecha = ancla.toISOString().slice(0, 10);

  // Si ya entreno hoy, el dia esta hecho y no hay nada que cambiar. Se revisa en el servidor
  // y no solo en la pagina porque esconder el boton seria cosmetico. Ver `planCambioDia`: una
  // asistencia que solo marco la web al empezar el entrenamiento no cuenta como hecho.
  const deHoy = await firestore
    .collection("asistencias")
    .where("clienteId", "==", clienteId)
    .where("fecha", "==", hoy)
    .limit(1)
    .get();
  const asistenciaHoy = deHoy.docs[0];
  const guardadoHoy = await clienteRef.collection("sesiones").where("fecha", "==", hoy).limit(1).get();
  const plan = planCambioDia(asistenciaHoy?.data(), !guardadoHoy.empty);
  if (plan === "bloquear") throw new HttpsError("failed-precondition", "ya_asistio_hoy");

  const lote = firestore.batch();

  if (plan === "ancla") {
    lote.update(clienteRef, {
      // Los nombres salen de `FirestoreClienteRepository.asignarDiaAncla`, que escribe
      // exactamente este par. Ojo con el primero: el dia del ancla se guarda en
      // `diaActualIndex`, no en un `diaAnclaIndex` que no existe.
      diaActualIndex: diaIndex,
      diaAnclaFecha: anclaFecha,
      // El trio denormalizado se escribe a mano, en el mismo lote que el ancla, para que no
      // exista un instante con el ancla nueva y el trio viejo. Sin asistencia de hoy, la
      // ventana del ancla (`fecha > ancla && fecha <= hoy`) esta vacia y el ancla manda.
      ultimoDia: diaIndex,
      ultimoDiaFecha: anclaFecha,
      ultimoDiaEsAncla: true,
    });
  } else {
    // Hoy ya hay asistencia (la de "Empezar"). Como `AsignarDiaManual`: el ancla y ademas el
    // dia de esa asistencia, para que no quede el viejo (la regresion del commit d424286:
    // la asistencia de hoy cae en la ventana del ancla y, con el dia viejo, la trababa).
    // La variacion guardada era del dia viejo: se recalcula para el nuevo.
    const variaciones = ((cliente.get("rutinaAsignada.dias") as { variaciones?: unknown[] }[])[diaIndex]
      ?.variaciones ?? []).length;
    let variacionRealizada: number | null = null;
    if (variaciones > 0) {
      const todas = await firestore.collection("asistencias").where("clienteId", "==", clienteId).get();
      const leidas: AsistenciaLeida[] = todas.docs
        .filter((d) => d.get("fecha") !== hoy)
        .map((d) => ({
          fecha: String(d.get("fecha") ?? ""),
          asistio: d.get("asistio") === true,
          diaRutinaRealizado: typeof d.get("diaRutinaRealizado") === "number" ? d.get("diaRutinaRealizado") : null,
          variacionRealizada: typeof d.get("variacionRealizada") === "number" ? d.get("variacionRealizada") : null,
        }));
      variacionRealizada = variacionQueToca(diaIndex, leidas, hoy, variaciones);
    }
    lote.update(asistenciaHoy!.ref, { diaRutinaRealizado: diaIndex, variacionRealizada });
    // El trio es el que da `denormalizar()` con esa asistencia: el dia de HOY, sin ancla.
    lote.update(clienteRef, {
      diaActualIndex: diaIndex,
      diaAnclaFecha: anclaFecha,
      ultimoDia: diaIndex,
      ultimoDiaFecha: hoy,
      ultimoDiaEsAncla: false,
    });
  }

  lote.set(firestore.collection("cambiosDia").doc(`${clienteId}_${hoy}`), {
    clienteId,
    fecha: hoy,
    diaIndex,
    motivo,
    creado: FieldValue.serverTimestamp(),
  });

  await lote.commit();
  return { ok: true, diaIndex };
});
