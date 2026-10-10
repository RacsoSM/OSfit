/**
 * La parte pura de la carga del banco de ejercicios: validar la semilla y armar cada
 * documento de `ejercicios/{id}`. Vive aparte del script para poder probarla sin Firebase.
 *
 * Ver `docs/superpowers/specs/2026-10-10-mapa-fuerza-entrenamiento-design.md` (sección
 * "Banco de ejercicios") y `docs/superpowers/plans/2026-10-10-banco-ejercicios-gifs.md`.
 */

/**
 * Los grupos de los cuatro SVG (`data-musculo`). Una clave fuera de esta lista no se pinta en
 * ningún mapa, así que casi seguro es un error de dedo en la semilla.
 *
 * GEMELO: `NOMBRES_MUSCULO` en `web/src/fuerza.ts`.
 */
export const MUSCULOS_SVG = [
  "pecho", "abdomen", "hombro", "biceps", "triceps", "antebrazo", "trapecio",
  "infraespinoso", "dorsal", "lumbar", "gluteo", "cuadriceps", "isquiotibiales", "pantorrilla",
];

export const TIPOS = ["peso", "corporal", "tiempo"];

/**
 * El dataset de donde salen los GIF, fijado a un commit: si el autor renombra o reemplaza un
 * archivo, volver a correr la carga sube exactamente lo mismo que la primera vez.
 */
export const DATASET = {
  repo: "hasaneyldrm/exercises-dataset",
  commit: "7455efae41b330c265e7cd4b78dfa848e7ce5ebd",
};

/** Los términos del dataset piden conservar esta atribución junto a cada GIF. */
export const ATRIBUCION = "© Gym visual — https://gymvisual.com/";

export function urlDelDataset(ruta) {
  return `https://raw.githubusercontent.com/${DATASET.repo}/${DATASET.commit}/${ruta}`;
}

/**
 * Cómo se compara un nombre de la rutina contra el banco. Es `claveEjercicio` más quitar
 * acentos: el entrenador escribe rápido desde el teléfono y "Sentadilla bulgara" tiene que
 * caer en "Sentadilla búlgara". No se toca `claveEjercicio` porque con ella están guardadas
 * las llaves de `pesoPorEjercicio`, y cambiarla despegaría esos pesos.
 *
 * GEMELO: `claveBanco` en `web/src/banco.ts`.
 */
export function claveBanco(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Los errores de la semilla, en texto para la consola. Vacío = se puede cargar.
 *
 * Lo más importante que revisa es que ninguna clave (nombre o alias, ya normalizados) se
 * repita entre dos ejercicios: si "remo" apuntara a dos, cuál GIF sale dependería del orden.
 */
export function validarSemilla(semilla, idsDelDataset) {
  const errores = [];
  const ids = new Set();
  const duenoDeClave = new Map();

  for (const e of semilla) {
    const donde = e.id ?? JSON.stringify(e).slice(0, 40);
    if (typeof e.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) {
      errores.push(`${donde}: el id tiene que ser minúsculas y guiones`);
    } else if (ids.has(e.id)) {
      errores.push(`${donde}: id repetido`);
    }
    ids.add(e.id);

    if (typeof e.nombre !== "string" || e.nombre.trim() === "") {
      errores.push(`${donde}: falta el nombre`);
    }
    if (!TIPOS.includes(e.tipo)) errores.push(`${donde}: tipo "${e.tipo}" no existe`);

    const musculos = Object.entries(e.musculos ?? {});
    if (musculos.length === 0) errores.push(`${donde}: sin músculos`);
    for (const [m, peso] of musculos) {
      if (!MUSCULOS_SVG.includes(m)) errores.push(`${donde}: músculo "${m}" no está en los SVG`);
      if (peso !== 1 && peso !== 0.5) errores.push(`${donde}: ${m} pesa ${peso}, va 1 o 0.5`);
    }

    if (idsDelDataset && !idsDelDataset.has(e.gifOrigen)) {
      errores.push(`${donde}: el GIF ${e.gifOrigen} no está en el dataset`);
    }

    for (const texto of [e.nombre ?? "", ...(e.alias ?? [])]) {
      const clave = claveBanco(texto);
      const dueno = duenoDeClave.get(clave);
      if (dueno && dueno !== e.id) {
        errores.push(`${donde}: "${texto}" ya es de ${dueno}`);
      }
      duenoDeClave.set(clave, e.id);
    }
  }
  return errores;
}

/** Donde vive el GIF de un ejercicio en Storage. */
export function rutaGif(id) {
  return `ejercicios/${id}.webp`;
}

/**
 * El documento `ejercicios/{id}`. Sin `estandares`: todavía no se decide quién los llena
 * (pregunta abierta del spec), y la carga escribe con `merge` para no borrarlos cuando
 * lleguen. `gifOrigen` tampoco va: es dato de la carga, no de la página.
 */
export function documentoDe(e, conGif) {
  return {
    nombre: e.nombre,
    alias: e.alias ?? [],
    tipo: e.tipo,
    musculos: e.musculos,
    gifRuta: conGif ? rutaGif(e.id) : null,
    atribucion: conGif ? ATRIBUCION : null,
  };
}
