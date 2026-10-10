import type { EjercicioBanco, Rutina } from "./datos";

/**
 * El banco de ejercicios del lado de la página: ligar por nombre los ejercicios de la rutina
 * con su entrada del banco, para mostrar su GIF.
 *
 * Por nombre y no por un id guardado en la rutina: las rutinas que ya existen no tienen ese id,
 * y el entrenador escribe el nombre como le sale. El `Ejercicio.ejercicioId` del spec llegará
 * con el buscador en el editor de rutinas; mientras, esto liga todo lo que ya existe.
 * Ver `docs/superpowers/specs/2026-10-10-mapa-fuerza-entrenamiento-design.md`.
 */

/**
 * Es `claveEjercicio` (pesosPropios.ts) más quitar acentos: "Sentadilla bulgara", escrito
 * rápido en el teléfono, tiene que caer en "Sentadilla búlgara". `claveEjercicio` no se toca
 * porque con ella están guardadas las llaves de `pesoPorEjercicio`.
 *
 * GEMELO: `claveBanco` en `functions/scripts/bancoEjercicios.mjs`, que valida que ninguna
 * clave se repita entre dos ejercicios de la semilla.
 */
export function claveBanco(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export type IndiceBanco = ReadonlyMap<string, EjercicioBanco>;

export function indiceBanco(banco: readonly EjercicioBanco[]): IndiceBanco {
  const indice = new Map<string, EjercicioBanco>();
  for (const e of banco) {
    for (const nombre of [e.nombre, ...(e.alias ?? [])]) indice.set(claveBanco(nombre), e);
  }
  return indice;
}

/** Todos los nombres de la rutina, de todos los días y variaciones. */
export function nombresDeLaRutina(rutina: Rutina | null | undefined): string[] {
  return (rutina?.dias ?? []).flatMap((d) =>
    [d.ejercicios ?? [], ...(d.variaciones ?? []).map((v) => v.ejercicios ?? [])]
      .flat()
      .map((e) => e.nombre ?? "")
  );
}

/**
 * Los GIF que hay que pedirle a Storage: los de su rutina, no los del banco entero. Cada URL
 * cuesta un viaje, y la rutina de una clienta toca una veintena de ejercicios de cien.
 */
export function rutasDeGifs(rutina: Rutina | null | undefined, indice: IndiceBanco): string[] {
  const rutas = new Set<string>();
  for (const nombre of nombresDeLaRutina(rutina)) {
    const ruta = indice.get(claveBanco(nombre))?.gifRuta;
    if (ruta) rutas.add(ruta);
  }
  return [...rutas];
}

/**
 * Nombre de ejercicio → URL de su GIF, o null. Null también mientras la URL no se resolvió:
 * la fila se pinta sin imagen y aparece en el repintado siguiente, en vez de un cuadro roto.
 */
export function gifsPorRuta(
  indice: IndiceBanco,
  urls: Readonly<Record<string, string>>
): (nombre: string) => string | null {
  return (nombre) => {
    const ruta = indice.get(claveBanco(nombre))?.gifRuta;
    return (ruta && urls[ruta]) || null;
  };
}
