/**
 * Sedes: el mismo peso en gimnasios con máquinas distintas (entrenador, 2026-10-27; ver
 * `docs/superpowers/specs/2026-10-27-sedes-gimnasio-design.md`). Cada sede trae cuánto vale
 * 1 kg de cada máquina suya en Focus Novum, donde se calibraron los estándares.
 *
 * El factor no toca los kilos que anotó la clienta: se aplica a los estándares de la máquina,
 * divididos entre él. Pedirle 50 / 0.5 = 100 kg donde las máquinas pesan la mitad es lo mismo
 * que contarle sus 100 kg como 50, y así la fórmula del nivel no cambia y lo que se muestra
 * ("te faltan X kg") sale en kilos de su gimnasio.
 *
 * GEMELO de `functions/src/sede.ts`.
 */

export type Factores = Readonly<Record<string, number>>;

/** Los factores de un documento `sedes/{id}`; vacío si no trae o vienen raros. */
export function factoresDesdeDoc(d: Record<string, unknown> | undefined): Record<string, number> {
  const crudo = d?.factores;
  if (typeof crudo !== "object" || crudo === null) return {};
  const factores: Record<string, number> = {};
  for (const [id, f] of Object.entries(crudo as Record<string, unknown>)) {
    if (typeof f === "number" && Number.isFinite(f) && f > 0) factores[id] = f;
  }
  return factores;
}

/** El factor de un ejercicio en la sede: solo los de peso tienen kilos que convertir. */
export function factorEn(factores: Factores, e: { id: string; tipo: string }): number {
  return e.tipo === "peso" ? factores[e.id] ?? 1 : 1;
}

/** El banco con los estándares de cada máquina divididos entre su factor. */
export function bancoEnSede<T extends { id: string; tipo: string; estandares?: Record<string, readonly number[]> | null }>(
  banco: readonly T[],
  factores: Factores
): T[] {
  return banco.map((e) => {
    const f = factorEn(factores, e);
    if (f === 1 || !e.estandares) return e;
    const estandares: Record<string, readonly number[]> = {};
    for (const [sexo, marcas] of Object.entries(e.estandares)) estandares[sexo] = marcas.map((m) => m / f);
    return { ...e, estandares };
  });
}
