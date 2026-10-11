/**
 * Validación de los estándares de fuerza antes de cargarlos (`cargarEstandares.mjs`). Pura,
 * para probarla sin Firestore. El archivo lo genera `docs/estandares-fuerza/proponer.py`.
 */

export const NIVELES = 8;

/**
 * Los errores del archivo de estándares contra la semilla del banco; vacío = se puede cargar.
 * Cada ejercicio: 8 marcas por sexo, positivas y cada una mayor que la anterior (si dos
 * fueran iguales, uno de los niveles nunca se vería), y solo de ejercicios de peso o
 * corporales que existan en la semilla.
 */
export function erroresEstandares(archivo, semilla) {
  const porId = new Map(semilla.map((e) => [e.id, e]));
  const errores = [];
  for (const [id, x] of Object.entries(archivo)) {
    const e = porId.get(id);
    if (!e) { errores.push(`${id}: no está en la semilla`); continue; }
    if (e.tipo === "tiempo") errores.push(`${id}: es de tiempo, no lleva estándares`);
    if (typeof x?.pesoPorMancuerna !== "boolean") errores.push(`${id}: falta pesoPorMancuerna`);
    if (x?.pesoPorMancuerna && e.tipo !== "peso") errores.push(`${id}: por mancuerna sin ser de peso`);
    for (const sexo of ["H", "M"]) {
      const v = x?.estandares?.[sexo];
      const ok = Array.isArray(v) && v.length === NIVELES
        && v.every((n, i) => typeof n === "number" && Number.isFinite(n) && n > 0 && (i === 0 || n > v[i - 1]));
      if (!ok) errores.push(`${id} ${sexo}: tienen que ser ${NIVELES} números, cada uno mayor que el anterior`);
    }
  }
  return errores;
}
