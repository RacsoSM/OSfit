import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { DocumentReference } from "firebase-admin/firestore";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import { faltaQueRompioLaRacha, type AsistenciaParaRacha } from "./faltaRompio";

/** Mismo tope que `CupoRevivesCalculator.MAXIMO_POR_MES` en Kotlin. */
const MAXIMO_POR_MES = 3;

/** El historial que necesita esta funcion, con la referencia para poder escribirle encima. */
interface AsistenciaConRef extends AsistenciaParaRacha {
  justificadaPorCliente: boolean;
  ref: DocumentReference;
}

/**
 * Justifica una falta del cliente ("revivir la racha"), con cupo de 3 por mes.
 *
 * El cupo no se guarda en ningun contador: se cuenta sobre las asistencias del mes, igual que
 * `CupoRevivesCalculator`, para que si el entrenador desmarca una justificada desde su app el
 * revive se le devuelva solo al cliente.
 */
export const revivirRacha = onCall({ region: REGION }, async (request) => {
  const clienteId = clienteDeLaSesion(request);

  const datos = request.data as { fecha?: unknown } | undefined;
  const fecha = typeof datos?.fecha === "string" ? datos.fecha : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new HttpsError("invalid-argument", "fecha_invalida");
  }

  const firestore = db();
  const hoy = hoyEnMazatlan();

  // Se lee el historial completo con una sola consulta por clienteId: la falta que rompio la
  // racha se calcula sobre todo el historial de todos modos, asi se lee una vez y no dos.
  const todas = await firestore.collection("asistencias").where("clienteId", "==", clienteId).get();
  const asistencias: AsistenciaConRef[] = todas.docs.map((d) => ({
    fecha: typeof d.get("fecha") === "string" ? (d.get("fecha") as string) : "",
    asistio: d.get("asistio") === true,
    justificada: d.get("justificada") === true,
    justificadaPorCliente: d.get("justificadaPorCliente") === true,
    ref: d.ref,
  }));

  // Solo dos fechas son justificables: hoy, y la falta que rompio la racha. Se revalida en el
  // servidor y no se confia en la que mande la pagina, porque si no el cliente podria
  // justificar cualquier dia de su historial abriendo la consola del navegador.
  if (fecha !== hoy && fecha !== faltaQueRompioLaRacha(asistencias, hoy)) {
    throw new HttpsError("failed-precondition", "fecha_no_justificable");
  }

  // El cupo se cuenta sobre el mes de hoy y exige las dos banderas: `justificadaPorCliente`
  // dice quien la pidio y `justificada` si sigue vigente.
  const mes = hoy.slice(0, 7);
  const gastados = asistencias.filter(
    (a) => a.justificadaPorCliente && a.justificada && a.fecha.startsWith(`${mes}-`)
  ).length;
  if (gastados >= MAXIMO_POR_MES) {
    throw new HttpsError("resource-exhausted", "sin_cupo");
  }

  const existente = asistencias.find((a) => a.fecha === fecha);
  // Justificar un dia al que si vino no significa nada. Misma condicion que ya aplica
  // `justificarFalta()` en Kotlin.
  if (existente?.asistio === true) {
    throw new HttpsError("failed-precondition", "ya_asistio");
  }

  if (existente) {
    await existente.ref.update({ justificada: true, justificadaPorCliente: true });
  } else {
    // El caso de avisar por adelantado: todavia no hay registro. Crearlo funciona sin
    // coordinacion con la app porque `registrarAsistencia()` ya conserva `justificada` al
    // remarcar una falta, y la limpia sola si el cliente termina asistiendo.
    //
    // Se escriben TODOS los campos del data class `Asistencia` de Kotlin, con el mismo valor
    // por defecto que tienen alla: si falta alguno, `toObject(Asistencia::class.java)` lo
    // resuelve igual, pero el documento quedaria con otra forma que el que escribe la app.
    // `id` se guarda vacio a proposito, que es lo que hace `registrarAsistencia()`.
    await firestore.collection("asistencias").add({
      id: "",
      clienteId,
      fecha,
      asistio: false,
      justificada: true,
      justificadaPorCliente: true,
      // Una falta no realizo ningun dia de rutina; los tres del cronometro no existen.
      diaRutinaRealizado: null,
      nota: "",
      horaLlegada: null,
      horaSalida: null,
      duracionMinutos: null,
    });
  }

  // Si la fecha YA estaba justificada por el cliente dentro de este mes, `gastados` ya la
  // contaba y volver a pedirla no gasta nada nuevo: restarle uno de mas dejaria el cupo que ve
  // la pagina un numero por debajo del que va a contar la proxima llamada.
  const yaGastada =
    existente?.justificadaPorCliente === true &&
    existente?.justificada === true &&
    fecha.startsWith(`${mes}-`);
  return { ok: true, disponibles: MAXIMO_POR_MES - gastados - (yaGastada ? 0 : 1) };
});
