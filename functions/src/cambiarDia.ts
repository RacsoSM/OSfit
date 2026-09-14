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

  // Si el entrenador ya le marco la asistencia de hoy, el dia esta hecho y no hay nada que
  // cambiar: la rutina ya se realizo. Se revisa en el servidor y no solo en la pagina porque
  // esconder el boton seria cosmetico — cualquiera podria llamar a esta funcion desde la
  // consola del navegador despues de entrenar.
  //
  // Solo bloquea `asistio === true`. Un registro de hoy marcado como falta no es una rutina
  // hecha, asi que ese caso sigue pudiendo cambiar de dia.
  const deHoy = await firestore
    .collection("asistencias")
    .where("clienteId", "==", clienteId)
    .where("fecha", "==", hoy)
    .limit(1)
    .get();
  if (deHoy.docs[0]?.get("asistio") === true) {
    throw new HttpsError("failed-precondition", "ya_asistio_hoy");
  }

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
    // Una sola forma, la de ancla, porque el caso de "ya vino hoy" ya se rechazo arriba.
    // `denormalizar()` produce dos y habia que elegir: el ancla se fecha AYER, asi que una
    // asistencia de hoy caeria dentro de su ventana (`fecha > ancla && fecha <= hoy`) y
    // ganaria, dejando al cliente trabado en este dia manana — la regresion del commit
    // d424286. Sin asistencia de hoy esa ventana esta vacia y el ancla manda.
    ultimoDia: diaIndex,
    ultimoDiaFecha: anclaFecha,
    ultimoDiaEsAncla: true,
  });

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
