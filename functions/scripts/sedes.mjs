/**
 * Validación de las sedes antes de cargarlas (`cargarSedes.mjs`). Pura, para probarla sin
 * Firestore. El archivo es `docs/sedes/sedes.json` (ver su README).
 */

/** Más allá de esto no es otra marca de máquina: es un error de dedo. */
export const FACTOR_MIN = 0.2;
export const FACTOR_MAX = 5;

/**
 * Los errores del archivo de sedes contra la semilla del banco; vacío = se puede cargar. Cada
 * sede: id en minúsculas y guiones, nombre, y factores solo de ejercicios de peso que existan,
 * cada uno un número razonable. Lo que no sea de peso no tiene kilos que convertir.
 */
export function erroresSedes(archivo, semilla) {
  const porId = new Map(semilla.map((e) => [e.id, e]));
  const errores = [];
  for (const [id, sede] of Object.entries(archivo)) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) errores.push(`${id}: el id tiene que ser minúsculas y guiones`);
    if (typeof sede?.nombre !== "string" || sede.nombre.trim() === "") errores.push(`${id}: falta el nombre`);
    const factores = sede?.factores;
    if (typeof factores !== "object" || factores === null || Array.isArray(factores)) {
      errores.push(`${id}: factores tiene que ser un objeto`);
      continue;
    }
    for (const [ej, f] of Object.entries(factores)) {
      const e = porId.get(ej);
      if (!e) errores.push(`${id} ${ej}: no está en la semilla`);
      else if (e.tipo !== "peso") errores.push(`${id} ${ej}: es de ${e.tipo}, no tiene kilos que convertir`);
      if (typeof f !== "number" || !(f >= FACTOR_MIN && f <= FACTOR_MAX)) {
        errores.push(`${id} ${ej}: el factor tiene que ser un número entre ${FACTOR_MIN} y ${FACTOR_MAX}`);
      }
    }
  }
  return errores;
}
