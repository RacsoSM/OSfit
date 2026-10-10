/**
 * Las últimas aperturas de la página de una clienta, para la ficha de la app.
 * Ver docs/superpowers/specs/2026-10-10-ultimas-entradas-design.md.
 */

export type Plataforma = "ios" | "android" | "otro";

/** Cuántas se guardan. La ficha solo muestra las más recientes. */
export const MAXIMO_ENTRADAS = 5;

/** Lo que manda el navegador no se cree: fuera de iPhone y Android, todo es "otro". */
export function plataformaValida(valor: unknown): Plataforma {
  return valor === "ios" || valor === "android" ? valor : "otro";
}

/**
 * La lista con la entrada nueva al principio, recortada a `MAXIMO_ENTRADAS`. Lo guardado se
 * recibe como `unknown`: un documento viejo no tiene el campo, y uno roto no debe impedir
 * anotar la entrada.
 */
export function conNuevaEntrada<T>(guardadas: unknown, nueva: T): T[] {
  const previas = Array.isArray(guardadas) ? (guardadas as T[]) : [];
  return [nueva, ...previas].slice(0, MAXIMO_ENTRADAS);
}
