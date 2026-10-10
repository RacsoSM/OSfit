import type { ConfigGrupos, EjercicioBanco } from "./datos";
import { claveBanco } from "./banco";

/**
 * Cómo se agrupa el grid de Registro: si hoy le toca "Pecho, hombro y tríceps", salen primero
 * "Pecho:" con sus ejercicios, luego "Hombro:", luego "Tríceps:", y después los demás grupos.
 *
 * Los ejercicios de cada grupo los configura el entrenador desde la app (una sola lista para
 * todas las clientas, en `configEjercicios/grupos`). Mientras no configura un grupo, salen los
 * del banco que pertenecen a él (`EjercicioBanco.grupo`), para que nunca aparezca vacío.
 */

export interface Grupo { id: string; nombre: string; }

/**
 * En este orden salen los grupos que no son del día.
 *
 * GEMELO: `GRUPOS` en `functions/scripts/bancoEjercicios.mjs` y `GruposEjercicio` en
 * `app/.../domain/GruposEjercicio.kt`.
 */
export const GRUPOS: readonly Grupo[] = [
  { id: "pecho", nombre: "Pecho" },
  { id: "espalda", nombre: "Espalda" },
  { id: "hombro", nombre: "Hombro" },
  { id: "biceps", nombre: "Bíceps" },
  { id: "triceps", nombre: "Tríceps" },
  { id: "cuadriceps", nombre: "Cuádriceps" },
  { id: "gluteo", nombre: "Glúteo" },
  { id: "femoral", nombre: "Femoral" },
  { id: "pantorrilla", nombre: "Pantorrilla" },
  { id: "abdomen", nombre: "Abdomen" },
  { id: "cardio", nombre: "Cardio y funcional" },
];

/** Palabra del nombre del día (ya sin acentos ni mayúsculas) → grupo. */
const PALABRAS: Readonly<Record<string, string>> = {
  pecho: "pecho", pectoral: "pecho", pectorales: "pecho",
  espalda: "espalda", dorsal: "espalda", dorsales: "espalda",
  hombro: "hombro", hombros: "hombro", deltoides: "hombro",
  biceps: "biceps",
  triceps: "triceps",
  cuadriceps: "cuadriceps", cuads: "cuadriceps",
  gluteo: "gluteo", gluteos: "gluteo", pompa: "gluteo",
  femoral: "femoral", femorales: "femoral", isquios: "femoral", isquiotibiales: "femoral",
  pantorrilla: "pantorrilla", pantorrillas: "pantorrilla", gemelos: "pantorrilla",
  abdomen: "abdomen", abdominal: "abdomen", abdominales: "abdomen", abs: "abdomen", core: "abdomen",
  cardio: "cardio", funcional: "cardio",
};

const PIERNA = ["cuadriceps", "gluteo", "femoral", "pantorrilla"];
const SUPERIOR = ["pecho", "espalda", "hombro", "biceps", "triceps"];

/** Palabras que nombran varios grupos a la vez. */
const EXPANSIONES: Readonly<Record<string, readonly string[]>> = {
  pierna: PIERNA, piernas: PIERNA, inferior: PIERNA,
  superior: SUPERIOR, torso: SUPERIOR,
  brazo: ["biceps", "triceps"], brazos: ["biceps", "triceps"],
};

/**
 * Los grupos de un día, leídos de su nombre, en el orden en que aparecen.
 *
 * Lo que se nombra directo va primero y lo que sale de una palabra general después: en
 * "Pierna (Glúteo)" el día es de glúteo, así que Glúteo encabeza y el resto de la pierna
 * sigue. Un nombre sin nada reconocible ("Día 1") no da grupos, y el grid muestra todos en
 * su orden normal.
 */
export function gruposDelDia(nombreDia: string): string[] {
  const palabras = claveBanco(nombreDia).replace(/[^a-z]+/g, " ").split(" ").filter(Boolean);
  const directos: string[] = [];
  const generales: string[] = [];
  for (const p of palabras) {
    const g = PALABRAS[p];
    if (g && !directos.includes(g)) directos.push(g);
    for (const x of EXPANSIONES[p] ?? []) if (!generales.includes(x)) generales.push(x);
  }
  return [...directos, ...generales.filter((g) => !directos.includes(g))];
}

/**
 * Los ejercicios de un grupo: la lista del entrenador si la configuró (en su orden, saltando
 * ids que ya no estén en el banco), o si no, los del banco de ese grupo por nombre.
 * Una lista configurada vacía cuenta: es que él vació el grupo.
 */
export function listaDeGrupo(
  grupo: string,
  config: ConfigGrupos | null,
  banco: readonly EjercicioBanco[]
): EjercicioBanco[] {
  const ids = config?.porGrupo?.[grupo];
  if (ids) {
    const porId = new Map(banco.map((e) => [e.id, e]));
    return ids.map((id) => porId.get(id)).filter((e): e is EjercicioBanco => e !== undefined);
  }
  return banco
    .filter((e) => e.grupo === grupo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export interface Seccion {
  titulo: string;
  /** Es uno de los grupos que le tocan hoy. */
  delDia: boolean;
  ejercicios: EjercicioBanco[];
}

/**
 * Las secciones del grid: los grupos del día, luego los demás en el orden de `GRUPOS`, y al
 * final "Otros" con lo del banco que no quedó en ningún grupo (para que todo el banco se
 * pueda elegir, ya que el grid no tiene buscador). Los grupos vacíos no salen.
 */
export function seccionesRegistro(
  nombreDia: string | null,
  banco: readonly EjercicioBanco[],
  config: ConfigGrupos | null
): Seccion[] {
  const delDia = nombreDia ? gruposDelDia(nombreDia) : [];
  const orden = [...delDia, ...GRUPOS.map((g) => g.id).filter((g) => !delDia.includes(g))];
  const secciones: Seccion[] = orden.map((id) => ({
    titulo: GRUPOS.find((g) => g.id === id)?.nombre ?? id,
    delDia: delDia.includes(id),
    ejercicios: listaDeGrupo(id, config, banco),
  }));
  const usados = new Set(secciones.flatMap((s) => s.ejercicios.map((e) => e.id)));
  const otros = banco
    .filter((e) => !usados.has(e.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  secciones.push({ titulo: "Otros", delDia: false, ejercicios: otros });
  return secciones.filter((s) => s.ejercicios.length > 0);
}
