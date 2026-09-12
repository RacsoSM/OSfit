import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";

const MOTIVO_MAXIMO = 200;

/**
 * Cambia el dia de rutina que le toca al cliente. Sin limite de uso: si cambia dos veces el
 * mismo dia, la segunda pisa a la primera.
 *
 * Hace lo mismo que `AsignarDiaManual.ejecutar` en Kotlin, y por las mismas razones. Si esa
 * logica cambia alla, tiene que cambiar aca.
 */
export const cambiarDia = onCall({ region: REGION }, async (request) => {
  const clienteId = clienteDeLaSesion(request);

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

  // Se consulta ANTES de armar el lote: de si hay asistencia hoy depende no solo la
  // correccion del dia realizado, sino tambien la forma del trio denormalizado.
  const deHoy = await firestore
    .collection("asistencias")
    .where("clienteId", "==", clienteId)
    .where("fecha", "==", hoy)
    .limit(1)
    .get();
  const asistenciaHoy = deHoy.docs[0];
  const vinoHoy = asistenciaHoy?.get("asistio") === true;

  const lote = firestore.batch();

  lote.update(clienteRef, {
    // Los nombres salen de `FirestoreClienteRepository.asignarDiaAncla`, que escribe
    // exactamente este par. Ojo con el primero: el dia del ancla se guarda en
    // `diaActualIndex`, no en un `diaAnclaIndex` que no existe.
    diaActualIndex: diaIndex,
    diaAnclaFecha: anclaFecha,
    // El trio denormalizado se escribe a mano, en el mismo lote que el ancla, para que no
    // exista un instante con el ancla nueva y el trio viejo.
    //
    // Las dos formas son las mismas dos que produce `denormalizar()`, y hay que elegir
    // igual que ella: el ancla se fecha AYER, asi que una asistencia de hoy cae dentro de
    // su ventana (`fecha > ancla && fecha <= hoy`) y gana. Escribir el trio de ancla
    // cuando el cliente ya vino hoy lo dejaria trabado en este dia manana, que es
    // exactamente la regresion del commit d424286.
    ...(vinoHoy
      ? { ultimoDia: diaIndex, ultimoDiaFecha: hoy, ultimoDiaEsAncla: false }
      : { ultimoDia: diaIndex, ultimoDiaFecha: anclaFecha, ultimoDiaEsAncla: true }),
  });

  // Si ya hay asistencia de hoy, el historial pisaria la correccion al instante. Mismo
  // motivo que el paso 2 de `AsignarDiaManual`.
  if (vinoHoy) {
    lote.update(asistenciaHoy.ref, { diaRutinaRealizado: diaIndex });
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
