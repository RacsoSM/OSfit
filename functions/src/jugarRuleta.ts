import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import { faltaQueRompioLaRacha, type AsistenciaParaRacha } from "./faltaRompio";
import {
  COLORES,
  castigoDelMes,
  mesAnterior,
  motivoDeRechazo,
  resolverTirada,
  type Color,
  type EstadoParaJugar,
  type TiradaParaCastigo,
} from "./reglasRuleta";

/** Mismo tope que `CupoRevivesCalculator.MAXIMO_POR_MES` en Kotlin y `cupo.ts` en la web. */
const MAXIMO_POR_MES = 3;

/**
 * El cupo es un solo número, derivado de las asistencias y del castigo del mes anterior.
 *
 * GEMELO: `disponiblesEnElMes` en `web/src/cupo.ts`. Tienen que dar el mismo resultado: el
 * cupo que la página le muestra al cliente y el que el servidor revalida antes de aceptar la
 * tirada son el mismo número, y dos fórmulas distintas para un mismo número es justo lo que
 * el spec prohíbe. Si acá no se restara el castigo, a una clienta castigada (máximo 2) que ya
 * gastó sus 2 revives la página le mostraría cupo 0 y le ofrecería jugar, pero el servidor
 * calcularía cupo 1 y le respondería `todavia_tiene_cupo`, rechazando la tirada que la propia
 * página acaba de ofrecerle — justo a la clienta que ya perdió una vez.
 */
export function calcularDisponibles(gastados: number, castigo: number): number {
  return Math.max(MAXIMO_POR_MES - castigo - gastados, 0);
}

export interface DepsTirada {
  estado: EstadoParaJugar;
  apostado: Color;
  mes: string;
  hoy: string;
  /** Inyectada para poder fijarla en las pruebas. En producción es `Math.random`. */
  azar: () => number;
  registrarTirada: (tirada: {
    mes: string;
    color: Color;
    gano: boolean;
    fecha: string;
  }) => Promise<void>;
  justificarFalta: (fecha: string) => Promise<void>;
}

/**
 * El núcleo: decide y manda escribir, sin saber qué es Firestore.
 *
 * Lanza un `Error` con el motivo como mensaje; el callable lo traduce a `HttpsError`. Así
 * esto se prueba en Node sin arrastrar `firebase-functions`.
 */
export async function aplicarTirada(deps: DepsTirada): Promise<{ gano: boolean; color: Color }> {
  if (!COLORES.includes(deps.apostado)) throw new Error("color_invalido");

  const motivo = motivoDeRechazo(deps.estado);
  if (motivo !== null) throw new Error(motivo);

  const resultado = resolverTirada(deps.apostado, deps.azar());

  // La tirada se registra SIEMPRE y primero: es lo que consume la oportunidad del mes. Si se
  // registrara después de justificar, una falla entre las dos escrituras le dejaría al
  // cliente el premio y la tirada intacta.
  await deps.registrarTirada({
    mes: deps.mes,
    color: resultado.color,
    gano: resultado.gano,
    fecha: deps.hoy,
  });

  if (resultado.gano) {
    // `faltaRota` no puede ser null acá: `motivoDeRechazo` ya devolvió `sin_falta_reparable`.
    await deps.justificarFalta(deps.estado.faltaRota as string);
  }

  return resultado;
}

const CODIGO_HTTP: Record<string, "failed-precondition" | "already-exists" | "permission-denied"> = {
  cuenta_pausada: "permission-denied",
  sin_falta_reparable: "failed-precondition",
  todavia_tiene_cupo: "failed-precondition",
  ya_jugo: "already-exists",
  color_invalido: "failed-precondition",
};

/**
 * La ruleta: el cliente sin cupo y con la racha rota apuesta a un color. Si acierta se le
 * justifica la falta sin gastar cupo; si falla, el mes siguiente tendrá 2 revives en vez de 3.
 *
 * TODO lo que manda la página se revalida acá. Igual que `revivirRacha` no confía en la fecha
 * que le mandan, esta no confía en "te juro que no tengo vidas": el cupo y la falta rota se
 * recalculan sobre el historial real.
 */
export const jugarRuleta = onCall({ region: REGION }, async (request) => {
  const clienteId = clienteDeLaSesion(request);
  const datos = request.data as { color?: unknown } | undefined;
  const apostado = datos?.color as Color;

  const firestore = db();
  const hoy = hoyEnMazatlan();
  const mes = hoy.slice(0, 7);

  const clienteSnap = await firestore.collection("clientes").doc(clienteId).get();
  const activo = clienteSnap.get("activo") === true;

  const todas = await firestore.collection("asistencias").where("clienteId", "==", clienteId).get();
  const asistencias: (AsistenciaParaRacha & { justificadaPorCliente: boolean })[] = todas.docs.map(
    (d) => ({
      fecha: typeof d.get("fecha") === "string" ? (d.get("fecha") as string) : "",
      asistio: d.get("asistio") === true,
      justificada: d.get("justificada") === true,
      justificadaPorCliente: d.get("justificadaPorCliente") === true,
    })
  );

  const gastados = asistencias.filter(
    (a) => a.justificadaPorCliente && a.justificada && a.fecha.startsWith(`${mes}-`)
  ).length;

  // El castigo se lee del mismo documento que le da a la página su cupo: `ruletas/{cliente}
  // _{mes anterior}`. No hacerlo sería tener dos fórmulas para el mismo cupo (ver el
  // comentario de `calcularDisponibles`).
  const tiradaAnteriorSnap = await firestore
    .collection("ruletas")
    .doc(`${clienteId}_${mesAnterior(mes)}`)
    .get();
  const tiradaAnterior: TiradaParaCastigo | null = tiradaAnteriorSnap.exists
    ? { gano: tiradaAnteriorSnap.get("gano") === true }
    : null;
  const disponibles = calcularDisponibles(gastados, castigoDelMes(tiradaAnterior));

  const refTirada = firestore.collection("ruletas").doc(`${clienteId}_${mes}`);
  const yaJugo = (await refTirada.get()).exists;

  try {
    return await aplicarTirada({
      estado: {
        activo,
        faltaRota: faltaQueRompioLaRacha(asistencias, hoy),
        disponibles,
        yaJugo,
      },
      apostado,
      mes,
      hoy,
      azar: Math.random,
      // `create()` y no `set()`: si el documento ya existe la escritura falla sola. Es lo que
      // hace atómico el "una tirada por mes" contra dos toques simultáneos desde dos
      // teléfonos, que la lectura de `yaJugo` de arriba no puede evitar por sí sola.
      registrarTirada: async (tirada) => {
        try {
          await refTirada.create({ clienteId, ...tirada });
        } catch {
          throw new Error("ya_jugo");
        }
      },
      justificarFalta: async (fecha) => {
        const existente = todas.docs.find((d) => d.get("fecha") === fecha);
        // `ganadaEnRuleta` y NO `justificadaPorCliente`: si se marcara como del cliente,
        // `gastadosEnElMes` la contaría como un revive usado y el premio se cobraría a sí
        // mismo.
        if (existente) {
          await existente.ref.update({ justificada: true, ganadaEnRuleta: true });
        } else {
          await firestore.collection("asistencias").add({
            id: "",
            clienteId,
            fecha,
            asistio: false,
            justificada: true,
            ganadaEnRuleta: true,
            diaRutinaRealizado: null,
            nota: "",
            horaLlegada: null,
            horaSalida: null,
            duracionMinutos: null,
          });
        }
      },
    });
  } catch (error) {
    const motivo = (error as Error).message;
    const codigo = CODIGO_HTTP[motivo];
    if (codigo) throw new HttpsError(codigo, motivo);
    throw error;
  }
});
