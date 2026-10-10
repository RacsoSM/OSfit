import type { EjercicioBanco } from "./datos";

/**
 * El banco de ejercicios del lado de la página: ligar por nombre los ejercicios de la rutina
 * con su entrada del banco y armar la URL de cada GIF. Lo usa Registro.
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
 * La URL pública de un GIF o video del banco, armada sin preguntarle a Storage. Los GIF del banco son catálogo y
 * `storage.rules` los deja leer sin sesión justo para esto: un grid de veinte ejercicios
 * serían veinte `getDownloadURL` antes de poder pintar, y además no hace falta cargar el SDK
 * de Storage en la página.
 *
 * GEMELO del bucket: `storageBucket` en `firebase.ts`.
 */
const BUCKET = "osfit-cccfe.firebasestorage.app";

function urlPublica(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(ruta)}?alt=media`;
}

export function urlGif(ruta: string | null | undefined): string | null {
  return urlPublica(ruta);
}

/** Igual que `urlGif`: los videos viven en la misma carpeta pública `ejercicios/`. */
export function urlVideo(ruta: string | null | undefined): string | null {
  return urlPublica(ruta);
}
