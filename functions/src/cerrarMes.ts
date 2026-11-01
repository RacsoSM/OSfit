import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { REGION, db, hoyEnMazatlan } from "./comun";
import { sedesDesdeDocs } from "./comparar";
import type { Sexo } from "./fuerza";
import {
  mesAnterior, mesesConActividad, nombreMes, resumenDelMes, ultimoDiaDe,
  type AsistenciaResumen, type EjercicioResumen, type ResumenMensual, type SesionResumen,
} from "./resumenMensual";
import { bancoEnSede } from "./sede";

/**
 * Congela cada mes cerrado de cada clienta en `clientes/{cid}/resumenesMensuales/{AAAA-MM}` y le
 * avisa del que acaba de cerrar. Ver `docs/superpowers/specs/2026-10-28-resumen-mensual-design.md`.
 *
 * Genera todos los meses cerrados con actividad que todavía no tienen documento, no solo el
 * último: así la primera corrida es también el respaldo de los meses viejos, y una clienta que
 * falló una vez se completa en la siguiente. Un documento que ya existe no se toca (`create()`):
 * un mes cerrado no cambia aunque después se recalibren los estándares.
 */

/** Código gRPC de "ya existe", como en `programarAvisos`. */
const YA_EXISTE = 6;

/** Los meses cerrados (antes del mes de hoy) con actividad y sin documento, del más viejo al más nuevo. */
export function mesesPorGenerar(conActividad: readonly string[], yaGuardados: ReadonlySet<string>, hoy: string): string[] {
  const mesDeHoy = hoy.slice(0, 7);
  return conActividad.filter((m) => m < mesDeHoy && !yaGuardados.has(m)).sort();
}

/**
 * El mes que cierra hoy: el anterior si hoy es día 1, y si no, ninguno. Solo ese manda push;
 * los meses del respaldo se guardan callados (una clienta no quiere 6 avisos de golpe).
 */
export function mesRecienCerrado(hoy: string): string | null {
  return hoy.endsWith("-01") ? mesAnterior(hoy.slice(0, 7)) : null;
}

export interface AvisoResumen {
  id: string;
  titulo: string;
  texto: string;
  abrir: { ventana: "resumenMensual"; mes: string };
}

export function avisoResumen(clienteId: string, r: ResumenMensual): AvisoResumen {
  const dias = r.asistencia.entreno;
  const partes = [`${dias} ${dias === 1 ? "día entrenado" : "días entrenados"}`];
  if (r.entrenamiento.kg > 0) {
    partes.push(`${String(r.entrenamiento.kg).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} kg levantados`);
  }
  return {
    id: `resumenMensual_${clienteId}_${r.mes}`,
    titulo: `Tu resumen de ${nombreMes(r.mes)} ya está listo`,
    texto: `${partes.join(" y ")}. Míralo en Resumen mensual.`,
    abrir: { ventana: "resumenMensual", mes: r.mes },
  };
}

/** Los nombres de los días de su rutina, en orden: `diaRutinaRealizado` es el índice. */
export function nombresDiasDesdeDoc(data: Record<string, unknown>): string[] {
  const rutina = data.rutinaAsignada as { dias?: unknown } | null | undefined;
  if (!rutina || !Array.isArray(rutina.dias)) return [];
  return rutina.dias.map((d, i) => {
    const nombre = (d as { nombreDia?: unknown } | null)?.nombreDia;
    return typeof nombre === "string" && nombre.trim() !== "" ? nombre.trim() : `Día ${i + 1}`;
  });
}

const numero = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

async function cerrarCliente(
  clienteId: string,
  data: Record<string, unknown>,
  banco: readonly EjercicioResumen[],
  hoy: string,
  recienCerrado: string | null,
  avisar: boolean
): Promise<{ escritos: number; avisos: number }> {
  const firestore = db();
  const ref = firestore.collection("clientes").doc(clienteId);
  const [asisSnap, sesSnap, guardadosSnap] = await Promise.all([
    firestore.collection("asistencias").where("clienteId", "==", clienteId).get(),
    ref.collection("sesiones").get(),
    ref.collection("resumenesMensuales").get(),
  ]);
  const asistencias: AsistenciaResumen[] = asisSnap.docs.map((d) => ({
    fecha: d.get("fecha"),
    asistio: d.get("asistio") === true,
    justificada: d.get("justificada") === true,
    duracionMinutos: numero(d.get("duracionMinutos")),
    diaRutinaRealizado: numero(d.get("diaRutinaRealizado")),
  })).filter((a) => typeof a.fecha === "string");
  const sesiones: SesionResumen[] = sesSnap.docs.map((d) => ({
    fecha: d.get("fecha"),
    ejercicios: (d.get("ejercicios") ?? []) as SesionResumen["ejercicios"],
  })).filter((s) => typeof s.fecha === "string");

  const meses = mesesPorGenerar(
    mesesConActividad(asistencias, sesiones), new Set(guardadosSnap.docs.map((d) => d.id)), hoy);
  const guardados = new Map(guardadosSnap.docs.map((d) => [d.id, d.data() as ResumenMensual]));

  const sexo = data.sexo === "H" || data.sexo === "M" ? (data.sexo as Sexo) : null;
  const perfil = {
    sexo,
    peso: numero(data.peso),
    porcentajeGrasa: numero(data.porcentajeGrasa),
    anioNacimiento: numero(data.anioNacimiento),
    nombresDias: nombresDiasDesdeDoc(data),
  };

  let escritos = 0;
  let avisos = 0;
  for (const mes of meses) {
    const r = resumenDelMes({ mes, corte: ultimoDiaDe(mes), asistencias, sesiones, banco, perfil });
    try {
      await ref.collection("resumenesMensuales").doc(mes).create({ ...r, generado: FieldValue.serverTimestamp() });
      escritos++;
      guardados.set(mes, r);
    } catch (error) {
      // Otra corrida lo escribió entre la lectura y aquí: ya está.
      if ((error as { code?: unknown }).code !== YA_EXISTE) throw error;
    }
  }

  // El aviso, solo en la corrida de la mañana y del mes que acaba de cerrar, lo haya guardado
  // esta corrida o la de las 00:30. El id fijo evita mandarlo dos veces.
  const r = recienCerrado ? guardados.get(recienCerrado) : undefined;
  if (avisar && r && data.notificacionesWeb === true) {
    const a = avisoResumen(clienteId, r);
    try {
      await firestore.collection("notificaciones").doc(a.id).create({
        id: a.id,
        titulo: a.titulo,
        texto: a.texto,
        destino: "elegidas",
        clientesElegidos: [clienteId],
        creada: FieldValue.serverTimestamp(),
        estado: "pendiente",
        enviadas: 0,
        fallidas: 0,
        automatico: "resumenMensual",
        abrir: a.abrir,
      });
      avisos++;
    } catch (error) {
      if ((error as { code?: unknown }).code !== YA_EXISTE) throw error;
    }
  }
  return { escritos, avisos };
}

/**
 * Lee el banco y las sedes una vez; por clienta, sus asistencias, sesiones y los meses ya
 * guardados. Todas las clientas, activas o no: una que se fue también tiene su historial. Una
 * que falla no detiene a las demás y se reintenta sola en la próxima corrida, porque su mes
 * sigue sin documento. Con `avisar`, además manda el push del mes que acaba de cerrar.
 */
async function cerrarTodo(avisar: boolean): Promise<void> {
  const hoy = hoyEnMazatlan();
  const recienCerrado = mesRecienCerrado(hoy);
  const firestore = db();
  const [clientesSnap, bancoSnap, sedesSnap] = await Promise.all([
    firestore.collection("clientes").get(),
    firestore.collection("ejercicios").get(),
    firestore.collection("sedes").get(),
  ]);
  const banco: EjercicioResumen[] = bancoSnap.docs.map((d) => ({
    id: d.id,
    nombre: typeof d.get("nombre") === "string" ? d.get("nombre") : d.id,
    tipo: d.get("tipo"),
    musculos: (d.get("musculos") ?? {}) as Record<string, number>,
    estandares: d.get("estandares") ?? null,
    pinta: d.get("pinta") ?? null,
  }));
  const sedes = sedesDesdeDocs(sedesSnap.docs);

  let escritos = 0;
  let avisos = 0;
  for (const c of clientesSnap.docs) {
    try {
      const sede = typeof c.get("sede") === "string" ? (c.get("sede") as string) : null;
      // Cada quien contra los estándares de su gimnasio, como el mapa.
      const suBanco = sede ? bancoEnSede(banco, sedes.get(sede) ?? {}) : banco;
      const r = await cerrarCliente(c.id, c.data(), suBanco, hoy, recienCerrado, avisar);
      escritos += r.escritos;
      avisos += r.avisos;
    } catch (error) {
      logger.error("Resumen mensual: falló una clienta", { clienteId: c.id, error });
    }
  }
  logger.info("Resumen mensual", { hoy, recienCerrado, avisar, clientes: clientesSnap.size, escritos, avisos });
}

/**
 * El día 1 a las 00:30 de Mazatlán: congela el mes que acaba de cerrar, callado. El push sale
 * hasta las 9:00 (`avisarResumenMes`): el 2026-11-01 salió a las 00:30 y despertó a las clientas
 * (entrenador). Así el resumen ya está listo en la página desde la medianoche.
 */
export const cerrarMes = onSchedule(
  { schedule: "30 0 1 * *", timeZone: "America/Mazatlan", region: REGION, timeoutSeconds: 540 },
  () => cerrarTodo(false)
);

/**
 * El día 1 a las 9:00 de Mazatlán, la hora de los demás avisos: "Tu resumen de octubre ya está
 * listo". Pasa otra vez por el cierre (si a alguna le falló el de las 00:30, se completa aquí;
 * lo ya guardado no se toca) y avisa a quien tenga su mes recién cerrado.
 */
export const avisarResumenMes = onSchedule(
  { schedule: "0 9 1 * *", timeZone: "America/Mazatlan", region: REGION, timeoutSeconds: 540 },
  () => cerrarTodo(true)
);
