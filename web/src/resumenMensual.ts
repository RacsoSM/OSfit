import type { Asistencia, EjercicioBanco, Sesion, Sexo } from "./datos";
import { edadEn, factorEdad, factorPeso, fuerzaPorMusculo, nivelDe, pesoParaFuerza, unoRm } from "./fuerza";
import { rachaMasLarga } from "./racha";

/**
 * El resumen de un mes: lo que guarda `cerrarMes` en `clientes/{cid}/resumenesMensuales/{AAAA-MM}`
 * al cerrarse y lo que la web calcula en vivo para el mes en curso. Ver
 * `docs/superpowers/specs/2026-10-28-resumen-mensual-design.md`.
 *
 * GEMELO: `functions/src/resumenMensual.ts`, con prueba de igualdad. La función congela el mes
 * con este mismo cálculo, así que el mes en curso y el cerrado dicen lo mismo.
 */

export type MarcaDia = "e" | "j" | "f";

export interface ResumenMensual {
  mes: string;
  version: 1;
  asistencia: {
    entreno: number;
    justificadas: number;
    faltas: number;
    /** Días hábiles que entrenó ÷ días hábiles con registro, 0–100 entero. Sin fines de semana. */
    porcentaje: number;
    /** Lo cronometrado de los días que entrenó; las visitas sin cronómetro no suman. */
    minutos: number;
    visitasConMinutos: number;
    rachaMasLarga: number;
    /** "01".."31" → entrenó, justificada o falta. Los días sin registro no están. */
    dias: Record<string, MarcaDia>;
  };
  entrenamiento: {
    sesiones: number;
    kg: number;
    series: number;
    reps: number;
    top: { ejercicioId: string; nombre: string; veces: number }[];
    diaFavorito: { indice: number; nombre: string; veces: number } | null;
  };
  fuerza: { general: number; musculos: Record<string, number> } | null;
  marcas: {
    ejercicioId: string; nombre: string; tipo: "peso" | "corporal";
    reps: number; peso: number | null; nivel: number;
  }[];
}

export interface EntradaResumen {
  mes: string;
  /** Último día que cuenta: el fin del mes si ya cerró, hoy si está en curso. */
  corte: string;
  asistencias: readonly Asistencia[];
  sesiones: readonly Sesion[];
  /** Ya ajustado a su sede (`bancoEnSede`), como el que usa el mapa. */
  banco: readonly EjercicioBanco[];
  perfil: {
    sexo: Sexo | null;
    peso: number | null;
    porcentajeGrasa: number | null;
    anioNacimiento: number | null;
    /** `nombreDia` de cada día de su rutina, en orden: el índice es `diaRutinaRealizado`. */
    nombresDias: readonly string[];
  };
}

const TOP = 5;
const MARCAS = 5;

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-10" → "octubre". */
export function nombreMes(mes: string): string {
  return NOMBRES_MES[Number(mes.slice(5, 7)) - 1] ?? mes;
}

/** "2026-10" → "2026-10-31". */
export function ultimoDiaDe(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const dias = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  return `${mes}-${String(dias).padStart(2, "0")}`;
}

/** "2026-10" → "2026-09". */
export function mesAnterior(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, "0")}`;
}

const enMes = (fecha: string, mes: string, corte: string) => fecha.startsWith(mes) && fecha <= corte;

/** Lunes a viernes. Al mediodía UTC, como `racha.ts`, para que la zona no mueva el día. */
function esDiaHabil(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return dia !== 0 && dia !== 6;
}

/**
 * Los meses con actividad, del más nuevo al más viejo: alguno en que entrenó (asistencia) o
 * registró un entrenamiento. Un mes solo con faltas o justificadas no cuenta: no hay nada que
 * resumirle (entrenador, 2026-10-28).
 */
export function mesesConActividad(asistencias: readonly Asistencia[], sesiones: readonly Sesion[]): string[] {
  const meses = new Set<string>();
  for (const a of asistencias) if (a.asistio) meses.add(a.fecha.slice(0, 7));
  for (const s of sesiones) meses.add(s.fecha.slice(0, 7));
  return [...meses].sort().reverse();
}

function asistenciaDelMes(e: EntradaResumen): ResumenMensual["asistencia"] {
  const delMes = e.asistencias.filter((a) => enMes(a.fecha, e.mes, e.corte));
  const dias: Record<string, MarcaDia> = {};
  let entreno = 0, justificadas = 0, faltas = 0, minutos = 0, visitasConMinutos = 0;
  for (const a of delMes) {
    const dia = a.fecha.slice(8, 10);
    if (a.asistio) {
      entreno++;
      dias[dia] = "e";
      // Los registros anteriores al cronómetro llegan sin el campo: no suman (ver `promedioMinutos`).
      if (typeof a.duracionMinutos === "number" && Number.isFinite(a.duracionMinutos)) {
        minutos += a.duracionMinutos;
        visitasConMinutos++;
      }
    } else if (a.justificada) {
      justificadas++;
      dias[dia] = "j";
    } else {
      faltas++;
      dias[dia] = "f";
    }
  }
  // El porcentaje es de los días hábiles: el fin de semana es opcional, como en la racha
  // (entrenador, 2026-10-28). Entrenar un sábado suma al calendario y a los días entrenados, pero
  // no infla el porcentaje (antes contaba arriba y abajo: un 1 de 1).
  const habiles = delMes.filter((a) => esDiaHabil(a.fecha));
  const entrenoHabil = habiles.filter((a) => a.asistio).length;
  return {
    entreno, justificadas, faltas,
    porcentaje: habiles.length === 0 ? 0 : Math.round((entrenoHabil / habiles.length) * 100),
    minutos, visitasConMinutos,
    // Solo los días del mes: una racha que viene del mes anterior cuenta desde el día 1.
    rachaMasLarga: rachaMasLarga([...delMes]),
    dias,
  };
}

function entrenamientoDelMes(e: EntradaResumen, sesiones: readonly Sesion[]): ResumenMensual["entrenamiento"] {
  const porId = new Map(e.banco.map((b) => [b.id, b]));
  let kg = 0, series = 0, reps = 0;
  const veces = new Map<string, { nombre: string; veces: number; series: number }>();
  for (const s of sesiones) {
    const vistos = new Set<string>();
    for (const ej of s.ejercicios) {
      const b = porId.get(ej.ejercicioId);
      // Tiempo y cardio no son volumen: sus "reps" son segundos o minutos.
      if (b && (b.tipo === "tiempo" || b.tipo === "cardio")) continue;
      const corporal = b?.tipo === "corporal";
      const v = veces.get(ej.ejercicioId) ?? { nombre: b?.nombre ?? ej.nombre, veces: 0, series: 0 };
      if (!vistos.has(ej.ejercicioId)) { v.veces++; vistos.add(ej.ejercicioId); }
      for (const serie of ej.series) {
        series++;
        v.series++;
        // Las bajadas de un dropset son parte de la misma serie: suman reps y kg, no series.
        for (const parte of [serie, ...(serie.caidas ?? [])]) {
          reps += parte.reps;
          if (!corporal) kg += (parte.peso ?? 0) * parte.reps;
        }
      }
      veces.set(ej.ejercicioId, v);
    }
  }
  const top = [...veces.entries()]
    .sort(([, a], [, b]) => b.veces - a.veces || b.series - a.series || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, TOP)
    .map(([ejercicioId, v]) => ({ ejercicioId, nombre: v.nombre, veces: v.veces }));

  const porDia = new Map<number, number>();
  for (const a of e.asistencias) {
    if (!a.asistio || !enMes(a.fecha, e.mes, e.corte)) continue;
    const i = a.diaRutinaRealizado;
    if (typeof i === "number" && Number.isInteger(i) && i >= 0) porDia.set(i, (porDia.get(i) ?? 0) + 1);
  }
  let diaFavorito: ResumenMensual["entrenamiento"]["diaFavorito"] = null;
  for (const [indice, n] of [...porDia.entries()].sort(([a], [b]) => a - b)) {
    if (!diaFavorito || n > diaFavorito.veces) {
      diaFavorito = { indice, nombre: e.perfil.nombresDias[indice] ?? `Día ${indice + 1}`, veces: n };
    }
  }

  return { sesiones: sesiones.length, kg: Math.round(kg), series, reps, top, diaFavorito };
}

const redondear = (n: number) => Math.round(n * 1000) / 1000;

/** Lo que mide la fuerza: el peso para fuerza y los factores, o null si falta sexo o peso. */
function medidor(e: EntradaResumen) {
  const { sexo, peso, porcentajeGrasa, anioNacimiento } = e.perfil;
  if ((sexo !== "H" && sexo !== "M") || !(typeof peso === "number" && peso > 0)) return null;
  const pesoFuerza = pesoParaFuerza(peso, sexo, porcentajeGrasa);
  const edad = edadEn(anioNacimiento, e.corte);
  return { sexo, pesoFuerza, edad, porEdad: factorEdad(edad), porPeso: factorPeso(pesoFuerza, sexo) };
}

function fuerzaDelMes(e: EntradaResumen): ResumenMensual["fuerza"] {
  const m = medidor(e);
  if (!m) return null;
  // La misma ventana de 8 semanas del mapa, terminando en el corte: es el mapa de ese día.
  const sesiones = e.sesiones.filter((s) => s.fecha <= e.corte);
  const fuerza = fuerzaPorMusculo(sesiones, e.banco, m.sexo, m.pesoFuerza, e.corte, m.edad);
  const grupos = Object.keys(fuerza).sort();
  if (grupos.length === 0) return null;
  const musculos: Record<string, number> = {};
  for (const g of grupos) musculos[g] = redondear(fuerza[g].nivel);
  const general = grupos.reduce((s, g) => s + fuerza[g].nivel, 0) / grupos.length;
  return { general: redondear(general), musculos };
}

/**
 * La mejor serie del mes de cada ejercicio con estándar, ordenadas por el nivel que dan: es lo que
 * deja comparar una banca con un curl. Sin sexo o sin peso no hay nivel, y no hay marcas.
 */
function marcasDelMes(e: EntradaResumen, sesiones: readonly Sesion[]): ResumenMensual["marcas"] {
  const m = medidor(e);
  if (!m) return [];
  const porId = new Map(e.banco.map((b) => [b.id, b]));
  const mejor = new Map<string, { nombre: string; tipo: "peso" | "corporal"; reps: number; peso: number | null; marca: number }>();
  for (const s of sesiones) {
    for (const ej of s.ejercicios) {
      const b = porId.get(ej.ejercicioId);
      if (!b || !b.estandares || (b.tipo !== "peso" && b.tipo !== "corporal")) continue;
      // Sin las bajadas, como el mapa: una bajada nunca es la mejor serie.
      for (const serie of ej.series) {
        const marca = b.tipo === "peso"
          ? (serie.peso ?? 0) > 0 ? (unoRm(serie.peso as number, serie.reps) / m.pesoFuerza) * m.porPeso * m.porEdad : 0
          : serie.reps * m.porEdad;
        if (marca > (mejor.get(b.id)?.marca ?? 0)) {
          mejor.set(b.id, { nombre: b.nombre, tipo: b.tipo, reps: serie.reps, peso: b.tipo === "peso" ? serie.peso : null, marca });
        }
      }
    }
  }
  return [...mejor.entries()]
    .map(([ejercicioId, x]) => ({
      ejercicioId, nombre: x.nombre, tipo: x.tipo, reps: x.reps, peso: x.peso,
      nivel: redondear(nivelDe(x.marca, porId.get(ejercicioId)!.estandares![m.sexo])),
    }))
    .sort((a, b) => b.nivel - a.nivel || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, MARCAS);
}

export function resumenDelMes(e: EntradaResumen): ResumenMensual {
  const sesiones = e.sesiones.filter((s) => enMes(s.fecha, e.mes, e.corte));
  return {
    mes: e.mes,
    version: 1,
    asistencia: asistenciaDelMes(e),
    entrenamiento: entrenamientoDelMes(e, sesiones),
    fuerza: fuerzaDelMes(e),
    marcas: marcasDelMes(e, sesiones),
  };
}

/** Cuánto cambió cada músculo contra el mes anterior; null si no hay con qué comparar. */
export function compararFuerza(
  actual: ResumenMensual["fuerza"],
  anterior: ResumenMensual["fuerza"] | null | undefined
): Record<string, number> | null {
  if (!actual || !anterior) return null;
  const cambios: Record<string, number> = {};
  for (const [g, nivel] of Object.entries(actual.musculos)) {
    const antes = anterior.musculos[g];
    if (typeof antes === "number") cambios[g] = redondear(nivel - antes);
  }
  return cambios;
}

/** 1044 → "17 h 24 min"; 45 → "45 min"; 120 → "2 h". */
export function formatoMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const min = Math.round(minutos % 60);
  if (h === 0) return `${min} min`;
  return min === 0 ? `${h} h` : `${h} h ${min} min`;
}

/** 59123 → "59,123". Sin `toLocaleString`: cada teléfono lo formatea distinto. */
export function formatoKg(kg: number): string {
  return String(Math.round(kg)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
