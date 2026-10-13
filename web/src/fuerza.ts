import type { EjercicioBanco, Sesion, Sexo } from "./datos";

/**
 * Rangos de fuerza por músculo y la comparación con TODA la población (no solo con quienes
 * entrenan).
 *
 * El nivel de un músculo es un número continuo de 0 a 8 que sale de comparar su mejor marca
 * (1RM estimado / peso corporal) con los ocho estándares de cada ejercicio por sexo: nivel 0
 * es no levantar nada, y los niveles 1 a 8 son los de cada rango (`RANGOS`). El cálculo es
 * `fuerzaPorMusculo`, con lo que registra en Registro.
 * Ver `docs/superpowers/specs/2026-10-10-mapa-fuerza-entrenamiento-design.md`.
 *
 * **Porcentajes (estimación, 2026-10-11).** Salen del modelo de
 * `docs/estandares-fuerza/proponer.py` (`percentiles.json`): entre quienes entrenan, la fuerza
 * se reparte como una curva log-normal ajustada a las tablas públicas; quien no entrena
 * levanta en promedio lo de Principiante; y 1 de cada 4 adultos entrena fuerza. Es el
 * promedio de todos los ejercicios y los dos sexos. Antes cada tramo se partía a la mitad y la
 * gráfica salía pareja, y al bajar la parte de arriba los porcentajes quedaban inflados.
 * Élite es el 10 % más fuerte de quienes entrenan (decisión del entrenador).
 */

export interface Rango { nombre: string; desde: number; }

/**
 * Los 8 rangos, ordenados por `desde`: el rango es el último cuyo estándar ya se alcanzó.
 * Principiante va desde 0 porque es donde está todo el que todavía no llega al de Novato.
 * Nombres elegidos por el entrenador (2026-10-11); "Atlético" va en femenino para ellas
 * (`nombreRango`). Los estándares de cada ejercicio, en `docs/estandares-fuerza/`.
 */
export const RANGOS: readonly Rango[] = [
  { nombre: "Principiante", desde: 0 },
  { nombre: "Novato", desde: 2 },
  { nombre: "En forma", desde: 3 },
  { nombre: "Intermedio", desde: 4 },
  { nombre: "Atlético", desde: 5 },
  { nombre: "Fuerte", desde: 6 },
  { nombre: "Avanzado", desde: 7 },
  { nombre: "Élite", desde: 8 },
];

export const NIVEL_MAX = 8;

/**
 * Nivel → porcentaje que queda por debajo: de toda la población y de la gente que entrena.
 * GEMELO: `docs/estandares-fuerza/percentiles.json`, que genera `proponer.py`; si se regeneran, copiarlos aquí.
 */
const PERCENTILES_POBLACION: readonly (readonly [number, number])[] = [
  [0, 1], [1, 38], [2, 60], [3, 72], [4, 82], [5, 88], [6, 90], [7, 93], [8, 97],
];
const PERCENTILES_ENTRENAN: readonly (readonly [number, number])[] = [
  [0, 1], [1, 3], [2, 12], [3, 25], [4, 42], [5, 57], [6, 65], [7, 72], [8, 90],
];

const acotar = (n: number) => Math.min(NIVEL_MAX, Math.max(0, n));

/** El número de su rango en `RANGOS` (0 = Principiante … 7 = Élite): el que decide su color. */
export function indiceRango(nivel: number): number {
  const n = acotar(nivel);
  let i = 0;
  RANGOS.forEach((x, j) => { if (n >= x.desde) i = j; });
  return i;
}

export function rangoDe(nivel: number): Rango {
  const n = acotar(nivel);
  let r = RANGOS[0];
  for (const x of RANGOS) if (n >= x.desde) r = x;
  return r;
}

/** El nombre del rango como se le dice a ella: "Atlética" en las mujeres. */
export function nombreRango(nivel: number, sexo: "H" | "M"): string {
  const { nombre } = rangoDe(nivel);
  return sexo === "M" && nombre === "Atlético" ? "Atlética" : nombre;
}

function interpolar(tabla: readonly (readonly [number, number])[], nivel: number): number {
  const n = acotar(nivel);
  for (let i = 1; i < tabla.length; i++) {
    const [n0, p0] = tabla[i - 1];
    const [n1, p1] = tabla[i];
    if (n <= n1) return Math.round(p0 + ((n - n0) / (n1 - n0)) * (p1 - p0));
  }
  return tabla[tabla.length - 1][1];
}

/** Entero de 1 a 97 contra toda la población: nunca "más fuerte que el 0 %" ni "que el 100 %". */
export function percentilDe(nivel: number): number {
  return interpolar(PERCENTILES_POBLACION, nivel);
}

/** Entero de 1 a 90 contra la gente que entrena. */
export function percentilEntrenanDe(nivel: number): number {
  return interpolar(PERCENTILES_ENTRENAN, nivel);
}

/** Lo que el mapa sabe de un músculo. Ausente = sin datos. */
export interface FuerzaMusculo {
  nivel: number;
  /** De qué ejercicio y serie sale el nivel: lo que usa "te faltan X para el siguiente rango". */
  origen?: OrigenFuerza;
}

/** El ejercicio que le da su nivel a un músculo, con su mejor serie de la ventana. */
export interface OrigenFuerza {
  ejercicioId: string;
  nombre: string;
  tipo: "peso" | "corporal";
  /** Cuánto trabaja al músculo: 1 principal, 0.5 secundario. */
  cuanto: number;
  /** La serie de su mejor marca: el mejor 1RM estimado, o las reps máximas. */
  serie: { reps: number; peso: number | null };
  estandares: readonly number[];
  pesoPorMancuerna: boolean;
}

/** Cómo se llama cada grupo de los SVG (`data-musculo`) en pantalla. */
export const NOMBRES_MUSCULO: Readonly<Record<string, string>> = {
  pecho: "Pecho",
  abdomen: "Abdomen",
  hombro: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebrazo: "Antebrazos",
  trapecio: "Trapecio",
  infraespinoso: "Infraespinoso",
  dorsal: "Dorsales",
  lumbar: "Zona lumbar",
  gluteo: "Glúteos",
  cuadriceps: "Cuádriceps",
  isquiotibiales: "Isquiotibiales",
  pantorrilla: "Pantorrillas",
};

export function nombreMusculo(grupo: string): string {
  return NOMBRES_MUSCULO[grupo] ?? grupo;
}

// ── Cálculo ──────────────────────────────────────────────────────────────────

/** Las 8 marcas de un ejercicio por sexo: 1RM ÷ peso corporal ("peso") o reps ("corporal"). */
export type Estandares = Record<Sexo, readonly number[]>;

/** Sesiones que cuentan para el mapa: las de las últimas 8 semanas. */
export const SEMANAS_VENTANA = 8;
/** Más arriba Epley se infla: 30 reps no dicen que pueda con el doble de peso. */
const REPS_TOPE_EPLEY = 12;

/** 1RM estimado (Epley). Con 1 repetición es el peso tal cual. */
export function unoRm(peso: number, reps: number): number {
  if (reps <= 1) return peso;
  return peso * (1 + Math.min(reps, REPS_TOPE_EPLEY) / 30);
}

/**
 * La marca contra los 8 estándares → nivel continuo de 0 a 8. Por debajo del primero va en
 * línea recta desde 0; entre dos estándares, en proporción; arriba del último se queda en 8.
 */
export function nivelDe(marca: number, estandares: readonly number[]): number {
  if (!(marca > 0) || estandares.length === 0) return 0;
  const e = estandares;
  if (marca < e[0]) return marca / e[0];
  for (let i = 0; i < e.length - 1; i++) {
    if (marca < e[i + 1]) return i + 1 + (marca - e[i]) / (e[i + 1] - e[i]);
  }
  return e.length;
}

/** AAAA-MM-DD de `dias` antes de `hoy` (también AAAA-MM-DD). */
function diasAntes(hoy: string, dias: number): string {
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/**
 * El nivel de cada músculo con lo que registró en las últimas 8 semanas. Ver la spec,
 * "Cálculo de fuerza":
 *
 * - Por ejercicio, su mejor marca: el mejor 1RM estimado entre su peso corporal en los de
 *   peso; las reps máximas en una serie en los corporales (el lastre no cuenta, por ahora).
 *   Los de tiempo no pintan el mapa, ni los que no tienen estándar.
 * - Por músculo, el **máximo** de `nivel del ejercicio × lo que lo trabaja` (1 principal,
 *   0.5 secundario): un accesorio ligero no le baja el nivel.
 * - Un músculo sin ejercicios registrados no aparece: es "sin datos", distinto de nivel 0.
 */
export function fuerzaPorMusculo(
  sesiones: readonly Sesion[],
  banco: readonly EjercicioBanco[],
  sexo: Sexo,
  pesoCorporal: number,
  hoy: string
): Record<string, FuerzaMusculo> {
  if (!(pesoCorporal > 0)) return {};
  const desde = diasAntes(hoy, SEMANAS_VENTANA * 7);
  const porId = new Map(banco.map((e) => [e.id, e]));

  const mejor = new Map<string, { marca: number; serie: { reps: number; peso: number | null } }>();
  for (const s of sesiones) {
    if (s.fecha < desde || s.fecha > hoy) continue;
    for (const e of s.ejercicios) {
      const b = porId.get(e.ejercicioId);
      if (!b || !b.estandares || b.tipo === "tiempo") continue;
      for (const serie of e.series) {
        const marca = b.tipo === "peso"
          ? (serie.peso ?? 0) > 0 ? unoRm(serie.peso as number, serie.reps) / pesoCorporal : 0
          : serie.reps;
        if (marca > (mejor.get(b.id)?.marca ?? 0)) mejor.set(b.id, { marca, serie });
      }
    }
  }

  const fuerza: Record<string, FuerzaMusculo> = {};
  for (const [id, { marca, serie }] of mejor) {
    const b = porId.get(id)!;
    const estandares = b.estandares![sexo];
    const nivel = nivelDe(marca, estandares);
    for (const [musculo, cuanto] of Object.entries(b.musculos)) {
      const n = nivel * cuanto;
      if (n > (fuerza[musculo]?.nivel ?? -1)) {
        fuerza[musculo] = {
          nivel: n,
          origen: {
            ejercicioId: id, nombre: b.nombre, tipo: b.tipo as "peso" | "corporal", cuanto,
            serie: { reps: serie.reps, peso: serie.peso }, estandares,
            pesoPorMancuerna: b.pesoPorMancuerna === true,
          },
        };
      }
    }
  }
  return fuerza;
}

// ── Reparto y siguiente rango (el detalle del músculo) ────────────────────────

export type Comparacion = "todos" | "entrenan";

/**
 * Qué porcentaje de cada grupo cae en cada rango, de Principiante a Élite: la gráfica de
 * barras del detalle. Sale de las mismas tablas que los porcentajes (lo que hay entre el
 * inicio de un rango y el del siguiente), así que suma 100. Es una estimación de las tablas
 * públicas, no de las clientas del gym.
 */
export function repartoRangos(contra: Comparacion): number[] {
  const p = contra === "todos" ? percentilDe : percentilEntrenanDe;
  return RANGOS.map((r, i) => {
    const desde = i === 0 ? 0 : p(r.desde);
    const hasta = i === RANGOS.length - 1 ? 100 : p(RANGOS[i + 1].desde);
    return hasta - desde;
  });
}

/** La marca que da el nivel `nivel` con estos estándares: lo contrario de `nivelDe`. */
export function marcaPara(nivel: number, estandares: readonly number[]): number {
  const e = estandares;
  if (nivel <= 1) return Math.max(0, nivel) * e[0];
  const k = Math.floor(nivel);
  if (k >= e.length) return e[e.length - 1];
  return e[k - 1] + (nivel - k) * (e[k] - e[k - 1]);
}

export type Siguiente =
  /** Ya está en Élite. */
  | { tipo: "maximo" }
  /** Con su mismo ejercicio: cuánto le falta, en kg (a sus mismas reps) o en reps. */
  | {
      tipo: "falta"; rango: number; avance: number; ejercicio: string; porMancuerna: boolean;
      mejor: { reps: number; peso: number | null };
      objetivo: { reps: number; peso: number | null };
    }
  /** Su nivel sale de un ejercicio que trabaja el músculo de lado: con ese no llega. */
  | { tipo: "otroEjercicio"; rango: number; avance: number };

/**
 * El siguiente rango y qué le falta para llegar. `avance` es cuánto lleva del camino entre el
 * inicio de su rango y el del siguiente (0 a 1). En los de peso, el objetivo es el peso que
 * tendría que mover **a las mismas reps** de su mejor serie, redondeado hacia arriba a 0.5 kg:
 * es lo que puede intentar en su próximo entrenamiento.
 */
export function siguienteRango(f: FuerzaMusculo, pesoCorporal: number): Siguiente {
  const i = indiceRango(f.nivel);
  if (i >= RANGOS.length - 1) return { tipo: "maximo" };
  const inicio = RANGOS[i].desde;
  const meta = RANGOS[i + 1].desde;
  const avance = Math.min(1, Math.max(0, (acotar(f.nivel) - inicio) / (meta - inicio)));
  const o = f.origen;
  const nivelEjercicio = o ? meta / o.cuanto : Infinity;
  if (!o || nivelEjercicio > NIVEL_MAX) return { tipo: "otroEjercicio", rango: i + 1, avance };

  const marca = marcaPara(nivelEjercicio, o.estandares);
  let objetivo: { reps: number; peso: number | null };
  if (o.tipo === "peso") {
    const reps = o.serie.reps;
    const factor = reps <= 1 ? 1 : 1 + Math.min(reps, REPS_TOPE_EPLEY) / 30;
    let peso = Math.ceil(((marca * pesoCorporal) / factor) * 2) / 2;
    if (o.serie.peso !== null && peso <= o.serie.peso) peso = o.serie.peso + 0.5;
    objetivo = { reps, peso };
  } else {
    objetivo = { reps: Math.max(Math.ceil(marca), o.serie.reps + 1), peso: null };
  }
  return {
    tipo: "falta", rango: i + 1, avance, ejercicio: o.nombre, porMancuerna: o.pesoPorMancuerna,
    mejor: o.serie, objetivo,
  };
}
