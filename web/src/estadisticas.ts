/**
 * Los números de la ventana Estadísticas (backlog 2, punto 22; ver
 * `docs/superpowers/specs/2026-10-20-estadisticas-design.md`). Todo puro: recibe sus sesiones y
 * el banco, devuelve lo que se pinta.
 *
 * Las sesiones guardan el peso en kg (Registro convierte las barras al enviar) y las bajadas
 * de un dropset (`caidas`) cuentan como series hechas: son peso que levantó.
 */
import type { EjercicioBanco, SerieSesion, Sesion, Sexo } from "./datos";
import { fuerzaPorMusculo, nombreRango, unoRm } from "./fuerza";

type Tipo = EjercicioBanco["tipo"];

/** Una serie suelta, ya sin la anidación de las bajadas. En cardio, `reps` son los minutos. */
interface Serie { reps: number; peso: number | null; velocidad?: number; }

function seriesDe(series: readonly SerieSesion[]): Serie[] {
  return series.flatMap((s) => [
    { reps: s.reps, peso: s.peso, ...(s.velocidad !== undefined ? { velocidad: s.velocidad } : {}) },
    ...(s.caidas ?? []),
  ]);
}

/** Lo que hizo de un ejercicio en cada fecha, la más vieja primero. Dos sesiones el mismo día se juntan. */
function porFecha(sesiones: readonly Sesion[], ejercicioId: string): { fecha: string; series: Serie[] }[] {
  const dias = new Map<string, Serie[]>();
  for (const s of sesiones) {
    for (const e of s.ejercicios) {
      if (e.ejercicioId !== ejercicioId) continue;
      const hechas = seriesDe(e.series).filter((x) => x.reps > 0);
      if (hechas.length === 0) continue;
      dias.set(s.fecha, [...(dias.get(s.fecha) ?? []), ...hechas]);
    }
  }
  return [...dias.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([fecha, series]) => ({ fecha, series }));
}

export interface EjercicioHecho {
  id: string;
  nombre: string;
  tipo: Tipo;
  /** En cuántas fechas distintas lo hizo. */
  veces: number;
  ultima: string;
}

/**
 * Los ejercicios que aparecen en sus sesiones, el más reciente primero. El nombre y el tipo
 * salen del banco; si ya no está, del nombre guardado en la sesión, y se trata como de peso.
 */
export function ejerciciosHechos(sesiones: readonly Sesion[], banco: readonly EjercicioBanco[]): EjercicioHecho[] {
  const porId = new Map(banco.map((b) => [b.id, b]));
  const vistos = new Map<string, { nombre: string; fechas: Set<string> }>();
  for (const s of sesiones) {
    for (const e of s.ejercicios) {
      if (!e.series.some((x) => x.reps > 0)) continue;
      const v = vistos.get(e.ejercicioId) ?? { nombre: e.nombre, fechas: new Set<string>() };
      v.fechas.add(s.fecha);
      vistos.set(e.ejercicioId, v);
    }
  }
  return [...vistos.entries()]
    .map(([id, v]) => {
      const b = porId.get(id);
      const fechas = [...v.fechas].sort();
      return { id, nombre: b?.nombre ?? v.nombre, tipo: b?.tipo ?? "peso", veces: fechas.length, ultima: fechas[fechas.length - 1] };
    })
    .sort((a, b) => (a.ultima === b.ultima ? a.nombre.localeCompare(b.nombre, "es") : a.ultima < b.ultima ? 1 : -1));
}

/**
 * Los músculos con datos: los que algún ejercicio hecho trabaja como principal (× 1 en el
 * banco), como el mapa ("solo trabajo directo"). Con sus ejercicios, el más reciente primero.
 */
export function musculosHechos(
  hechos: readonly EjercicioHecho[],
  banco: readonly EjercicioBanco[]
): { grupo: string; ejercicios: EjercicioHecho[] }[] {
  const porId = new Map(banco.map((b) => [b.id, b]));
  const grupos = new Map<string, EjercicioHecho[]>();
  for (const h of hechos) {
    for (const [grupo, cuanto] of Object.entries(porId.get(h.id)?.musculos ?? {})) {
      if (cuanto < 1) continue;
      grupos.set(grupo, [...(grupos.get(grupo) ?? []), h]);
    }
  }
  return [...grupos.entries()].map(([grupo, ejercicios]) => ({ grupo, ejercicios }));
}

export interface MejorSerie { reps: number; peso: number | null; fecha: string; }

export interface ResumenEjercicio {
  tipo: Tipo;
  veces: number;
  series: number;
  /** Reps totales; en los de tiempo, segundos totales. */
  reps: number;
  /** Σ peso × reps de todas sus series. Solo los de peso. */
  kgTotales: number;
  /** El peso más alto que movió. Solo los de peso. */
  pesoMaximo: number | null;
  /** Mejor 1RM estimado y la serie que lo dio. Solo los de peso. */
  unoRm: number | null;
  mejor: MejorSerie | null;
  /** 1RM estimado de hoy menos el de hace 30 días (lo mejor hasta esa fecha); null si no hay con qué comparar. */
  cambio30: number | null;
  /** La velocidad más alta que anotó. Solo cardio. */
  velocidadMaxima: number | null;
  primera: string | null;
  ultima: string | null;
}

/** El día de hace `n` días, en `AAAA-MM-DD`. */
function diasAntes(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const redondear = (n: number, decimales = 1) => Math.round(n * 10 ** decimales) / 10 ** decimales;

/** La mejor de dos series para "lo que levantó": más peso; a igual peso, más reps. */
function masPesada(a: Serie, b: Serie): Serie {
  const pa = a.peso ?? 0, pb = b.peso ?? 0;
  return pb > pa || (pb === pa && b.reps > a.reps) ? b : a;
}

export function resumenEjercicio(sesiones: readonly Sesion[], ejercicioId: string, tipo: Tipo, hoy: string): ResumenEjercicio {
  const dias = porFecha(sesiones, ejercicioId);
  const todas = dias.flatMap((d) => d.series.map((s) => ({ ...s, fecha: d.fecha })));
  const base: ResumenEjercicio = {
    tipo, veces: dias.length, series: todas.length, reps: todas.reduce((n, s) => n + s.reps, 0),
    kgTotales: 0, pesoMaximo: null, unoRm: null, mejor: null, cambio30: null, velocidadMaxima: null,
    primera: dias[0]?.fecha ?? null, ultima: dias[dias.length - 1]?.fecha ?? null,
  };
  if (todas.length === 0) return base;

  if (tipo !== "peso") {
    const mejor = todas.reduce((a, b) => (b.reps > a.reps ? b : a));
    const velocidades = todas.flatMap((s) => (s.velocidad !== undefined ? [s.velocidad] : []));
    return {
      ...base,
      mejor: { reps: mejor.reps, peso: null, fecha: mejor.fecha },
      velocidadMaxima: tipo === "cardio" && velocidades.length > 0 ? Math.max(...velocidades) : null,
    };
  }

  const conPeso = todas.filter((s) => s.peso !== null && s.peso > 0);
  if (conPeso.length === 0) return base;
  const rm = (s: Serie) => unoRm(s.peso ?? 0, s.reps);
  const mejor = conPeso.reduce((a, b) => (rm(b) > rm(a) ? b : a));
  const hace30 = diasAntes(hoy, 30);
  const antes = conPeso.filter((s) => s.fecha <= hace30);
  const mejorAntes = antes.length > 0 ? Math.max(...antes.map(rm)) : null;
  return {
    ...base,
    kgTotales: redondear(conPeso.reduce((n, s) => n + (s.peso ?? 0) * s.reps, 0), 0),
    pesoMaximo: Math.max(...conPeso.map((s) => s.peso ?? 0)),
    unoRm: redondear(rm(mejor)),
    mejor: { reps: mejor.reps, peso: mejor.peso, fecha: mejor.fecha },
    cambio30: mejorAntes === null ? null : redondear(rm(mejor) - mejorAntes),
  };
}

export interface Punto {
  fecha: string;
  valor: number;
  /** La serie de la que sale el punto: "60 kg × 6", "15 reps", "45 s". En la de nivel, el rango. */
  etiqueta: string;
}

export type ModoGrafica = "1rm" | "sesiones";

/** "60 kg × 6", sin ".0" de más. */
export function textoSerie(s: Serie, tipo: Tipo): string {
  if (tipo === "tiempo") return `${s.reps} s`;
  if (tipo === "cardio") return `${s.reps} min`;
  if (s.peso === null || s.peso === 0) return `${s.reps} reps`;
  return `${redondear(s.peso)} kg × ${s.reps}`;
}

/**
 * Un punto por fecha. `1rm`: el mejor 1RM estimado del día. `sesiones`: la serie más pesada
 * del día, tal cual. Los corporales y los de tiempo no tienen 1RM: su punto es la serie con
 * más reps (o más segundos), con cualquiera de los dos modos.
 */
export function puntosEjercicio(sesiones: readonly Sesion[], ejercicioId: string, tipo: Tipo, modo: ModoGrafica): Punto[] {
  return porFecha(sesiones, ejercicioId).flatMap(({ fecha, series }) => {
    if (tipo === "cardio") {
      // Si ese día usó la máquina dos veces, cuentan los minutos de las dos.
      const minutos = series.reduce((n, s) => n + s.reps, 0);
      return [{ fecha, valor: minutos, etiqueta: `${minutos} min` }];
    }
    if (tipo !== "peso") {
      const mejor = series.reduce((a, b) => (b.reps > a.reps ? b : a));
      return [{ fecha, valor: mejor.reps, etiqueta: textoSerie(mejor, tipo) }];
    }
    const conPeso = series.filter((s) => s.peso !== null && s.peso > 0);
    if (conPeso.length === 0) return [];
    if (modo === "sesiones") {
      const mejor = conPeso.reduce(masPesada);
      return [{ fecha, valor: mejor.peso ?? 0, etiqueta: textoSerie(mejor, tipo) }];
    }
    const mejor = conPeso.reduce((a, b) => (unoRm(b.peso ?? 0, b.reps) > unoRm(a.peso ?? 0, a.reps) ? b : a));
    return [{ fecha, valor: redondear(unoRm(mejor.peso ?? 0, mejor.reps)), etiqueta: textoSerie(mejor, tipo) }];
  });
}

/** Lo que hizo en cada fecha, la más nueva primero: la lista de abajo de la gráfica. */
export function historialEjercicio(sesiones: readonly Sesion[], ejercicioId: string, tipo: Tipo): { fecha: string; series: string[] }[] {
  return porFecha(sesiones, ejercicioId)
    .reverse()
    .map(({ fecha, series }) => ({ fecha, series: series.map((s) => textoSerie(s, tipo)) }));
}

export interface PerfilFuerza { sexo: Sexo; peso: number; edad: number | null; }

/**
 * El nivel del músculo en cada fecha en que lo trabajó, con la cuenta del mapa como si "hoy"
 * fuera esa fecha (mejor marca de las 8 semanas anteriores). Usa su peso y edad de hoy: no hay
 * registro de los de antes. Las fechas sin nivel (ejercicios sin estándares) no salen.
 */
export function nivelesMusculo(
  sesiones: readonly Sesion[],
  banco: readonly EjercicioBanco[],
  grupo: string,
  perfil: PerfilFuerza
): Punto[] {
  const porId = new Map(banco.map((b) => [b.id, b]));
  const fechas = new Set<string>();
  for (const s of sesiones) {
    if (s.ejercicios.some((e) => (porId.get(e.ejercicioId)?.musculos[grupo] ?? 0) >= 1)) fechas.add(s.fecha);
  }
  return [...fechas].sort().flatMap((fecha) => {
    const f = fuerzaPorMusculo(sesiones, banco, perfil.sexo, perfil.peso, fecha, perfil.edad)[grupo];
    return f ? [{ fecha, valor: redondear(f.nivel, 2), etiqueta: nombreRango(f.nivel, perfil.sexo) }] : [];
  });
}
