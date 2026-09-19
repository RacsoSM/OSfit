import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { DocumentReference } from "firebase-admin/firestore";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import { faltaQueRompioLaRacha, type AsistenciaParaRacha } from "./faltaRompio";
import { calcularDisponibles } from "./jugarRuleta";
import { castigoDelMes, mesAnterior, type TiradaParaCastigo } from "./reglasRuleta";

/**
 * El cupo de quien pide un revive: si le alcanza, y con cuantos queda despues de darselo.
 *
 * Vive aparte del `onCall` para poder probarse en Node, que es lo unico que faltaba para que
 * el castigo de la ruleta lo sostuviera el servidor y no el `disabled` de un boton. Reusa
 * `calcularDisponibles` en vez de repetir la resta: una tercera copia de la aritmetica del
 * cupo es justo lo que el spec prohibe.
 *
 * [yaGastada] es que la fecha pedida YA estuviera justificada por el cliente dentro del mes:
 * en ese caso `gastados` ya la contaba y volver a pedirla no gasta nada nuevo, asi que restar
 * uno de mas dejaria el cupo que ve la pagina un numero por debajo del que va a contar la
 * proxima llamada.
 */
export function cupoDelRevive(
  gastados: number,
  castigo: number,
  yaGastada: boolean
): { sinCupo: boolean; disponibles: number } {
  const antes = calcularDisponibles(gastados, castigo);
  return { sinCupo: antes <= 0, disponibles: Math.max(yaGastada ? antes : antes - 1, 0) };
}

/** El historial que necesita esta funcion, con la referencia para poder escribirle encima. */
interface AsistenciaConRef extends AsistenciaParaRacha {
  justificadaPorCliente: boolean;
  ref: DocumentReference;
}

/**
 * Justifica una falta del cliente ("revivir la racha"), con cupo de 3 por mes — 2 si perdio
 * la ruleta el mes pasado.
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

  // El castigo de la ruleta entra tambien aca, y no solo en `jugarRuleta`: esta es la funcion
  // que de verdad otorga los revives, asi que si el maximo se quedara fijo en 3, una clienta
  // castigada podria pedir desde la consola del navegador el revive que su pagina ya no le
  // ofrece — el castigo, que es la apuesta entera de la ruleta, lo sostendria solo la interfaz.
  const tiradaAnteriorSnap = await firestore
    .collection("ruletas")
    .doc(`${clienteId}_${mesAnterior(mes)}`)
    .get();
  const tiradaAnterior: TiradaParaCastigo | null = tiradaAnteriorSnap.exists
    ? { gano: tiradaAnteriorSnap.get("gano") === true }
    : null;

  const existente = asistencias.find((a) => a.fecha === fecha);
  const yaGastada =
    existente?.justificadaPorCliente === true &&
    existente?.justificada === true &&
    fecha.startsWith(`${mes}-`);
  const cupo = cupoDelRevive(gastados, castigoDelMes(tiradaAnterior), yaGastada);
  if (cupo.sinCupo) {
    throw new HttpsError("resource-exhausted", "sin_cupo");
  }
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

  return { ok: true, disponibles: cupo.disponibles };
});
