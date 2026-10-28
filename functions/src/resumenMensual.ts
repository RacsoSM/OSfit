import {
  edadEn, factorEdad, factorPeso, nivelDe, nivelesPorMusculo, pesoParaFuerza, unoRm,
  type EjercicioFuerza, type Sexo,
} from "./fuerza";
import { fechasQueCuentan, rachaMasLarga } from "./rachas";

/**
 * El resumen de un mes, el que `cerrarMes` congela en `clientes/{cid}/resumenesMensuales/{AAAA-MM}`.
 *
 * GEMELO: `web/src/resumenMensual.ts`. Se duplica porque `functions/` y `web/` son proyectos npm
 * separados; `resumenMensual.test.ts` compara los dos con los mismos datos. Si cambia la regla
 * en uno, cambia en el otro. Ver `docs/superpowers/specs/2026-10-28-resumen-mensual-design.md`.
 */

export type MarcaDia = "e" | "j" | "f";

export interface ResumenMensual {
  mes: string;
  version: 1;
  asistencia: {
    entreno: number;
    justificadas: number;
    faltas: number;
    porcentaje: number;
    minutos: number;
    visitasConMinutos: number;
    rachaMasLarga: number;
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

export interface AsistenciaResumen {
  fecha: string;
  asistio: boolean;
  justificada: boolean;
  duracionMinutos?: number | null;
  diaRutinaRealizado?: number | null;
}

interface Parte { reps: number; peso: number | null }

export interface SesionResumen {
  fecha: string;
  ejercicios: { ejercicioId: string; nombre: string; series: (Parte & { caidas?: Parte[] })[] }[];
}

export type EjercicioResumen = EjercicioFuerza & { nombre: string };

export interface EntradaResumen {
  mes: string;
  corte: string;
  asistencias: readonly AsistenciaResumen[];
  sesiones: readonly SesionResumen[];
  banco: readonly EjercicioResumen[];
  perfil: {
    sexo: Sexo | null;
    peso: number | null;
    porcentajeGrasa: number | null;
    anioNacimiento: number | null;
    nombresDias: readonly string[];
  };
}

const TOP = 5;
const MARCAS = 5;

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function nombreMes(mes: string): string {
  return NOMBRES_MES[Number(mes.slice(5, 7)) - 1] ?? mes;
}

export function ultimoDiaDe(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const dias = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  return `${mes}-${String(dias).padStart(2, "0")}`;
}

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

/** Meses en que entrenó o registró, del más nuevo al más viejo (faltas solas no cuentan). */
export function mesesConActividad(asistencias: readonly AsistenciaResumen[], sesiones: readonly SesionResumen[]): string[] {
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
    rachaMasLarga: rachaMasLarga(fechasQueCuentan([...delMes])),
    dias,
  };
}

function entrenamientoDelMes(e: EntradaResumen, sesiones: readonly SesionResumen[]): ResumenMensual["entrenamiento"] {
  const porId = new Map(e.banco.map((b) => [b.id, b]));
  let kg = 0, series = 0, reps = 0;
  const veces = new Map<string, { nombre: string; veces: number; series: number }>();
  for (const s of sesiones) {
    const vistos = new Set<string>();
    for (const ej of s.ejercicios) {
      const b = porId.get(ej.ejercicioId);
      if (b && (b.tipo === "tiempo" || b.tipo === "cardio")) continue;
      const corporal = b?.tipo === "corporal";
      const v = veces.get(ej.ejercicioId) ?? { nombre: b?.nombre ?? ej.nombre, veces: 0, series: 0 };
      if (!vistos.has(ej.ejercicioId)) { v.veces++; vistos.add(ej.ejercicioId); }
      for (const serie of ej.series) {
        series++;
        v.series++;
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
  const sesiones = e.sesiones.filter((s) => s.fecha <= e.corte);
  const niveles = nivelesPorMusculo(sesiones, e.banco, m.sexo, m.pesoFuerza, e.corte, m.edad);
  const grupos = Object.keys(niveles).sort();
  if (grupos.length === 0) return null;
  const musculos: Record<string, number> = {};
  for (const g of grupos) musculos[g] = redondear(niveles[g]);
  const general = grupos.reduce((s, g) => s + niveles[g], 0) / grupos.length;
  return { general: redondear(general), musculos };
}

function marcasDelMes(e: EntradaResumen, sesiones: readonly SesionResumen[]): ResumenMensual["marcas"] {
  const m = medidor(e);
  if (!m) return [];
  const porId = new Map(e.banco.map((b) => [b.id, b]));
  const mejor = new Map<string, { nombre: string; tipo: "peso" | "corporal"; reps: number; peso: number | null; marca: number }>();
  for (const s of sesiones) {
    for (const ej of s.ejercicios) {
      const b = porId.get(ej.ejercicioId);
      if (!b || !b.estandares || (b.tipo !== "peso" && b.tipo !== "corporal")) continue;
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
