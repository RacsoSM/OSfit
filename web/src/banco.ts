import type { EjercicioBanco } from "./datos";

/**
 * El banco de ejercicios del lado de la página: ligar por nombre los ejercicios de la rutina
 * con su entrada del banco, buscar en él y armar la URL de cada GIF. Lo usa Registro.
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

/**
 * Los ejercicios del banco que corresponden a esos nombres, en ese orden y sin repetir. Un
 * nombre que no casa con nada se queda fuera: sin entrada en el banco no hay GIF ni se puede
 * registrar contra el mapa de fuerza.
 */
export function delBanco(nombres: readonly string[], indice: IndiceBanco): EjercicioBanco[] {
  const vistos = new Set<string>();
  const salida: EjercicioBanco[] = [];
  for (const nombre of nombres) {
    const e = indice.get(claveBanco(nombre));
    if (e && !vistos.has(e.id)) {
      vistos.add(e.id);
      salida.push(e);
    }
  }
  return salida;
}

/**
 * Los ejercicios cuyo nombre o algún alias contiene todas las palabras buscadas, ordenados por
 * nombre. Por palabras y no por frase exacta: "curl manc" tiene que encontrar "Curl con
 * mancuernas". Vacío si no se buscó nada, para no tirar el banco entero de golpe en el grid.
 */
export function buscarEnBanco(texto: string, banco: readonly EjercicioBanco[]): EjercicioBanco[] {
  const palabras = claveBanco(texto).split(" ").filter(Boolean);
  if (palabras.length === 0) return [];
  return banco
    .filter((e) => {
      const textos = [e.nombre, ...(e.alias ?? [])].map(claveBanco);
      return palabras.every((p) => textos.some((t) => t.includes(p)));
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * La URL pública del GIF, armada sin preguntarle a Storage. Los GIF del banco son catálogo y
 * `storage.rules` los deja leer sin sesión justo para esto: un grid de veinte ejercicios
 * serían veinte `getDownloadURL` antes de poder pintar, y además no hace falta cargar el SDK
 * de Storage en la página.
 *
 * GEMELO del bucket: `storageBucket` en `firebase.ts`.
 */
const BUCKET = "osfit-cccfe.firebasestorage.app";

export function urlGif(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(ruta)}?alt=media`;
}
