import { claveBanco } from "./banco";
import type { EjercicioBanco } from "./datos";

/**
 * La búsqueda de la pantalla "elegir" de Registro (entrenador, 2026-10-31). Sin acentos ni
 * mayúsculas (`claveBanco`, como el ligado de la rutina), sobre el nombre y los alias del banco,
 * y cada palabra de lo que escribe tiene que aparecer en alguna parte: "curl manc" encuentra
 * "Curl con mancuernas", "jalon" encuentra "Jalón al pecho".
 */

/** El texto en que se busca: nombre y alias, ya normalizados. Va en `data-buscar` de cada opción. */
export function textoBusqueda(e: Pick<EjercicioBanco, "nombre" | "alias">): string {
  return [e.nombre, ...(e.alias ?? [])].map(claveBanco).join(" | ");
}

/** Si un texto de `textoBusqueda` coincide con lo escrito. Vacío coincide con todo. */
export function coincide(texto: string, consulta: string): boolean {
  const palabras = claveBanco(consulta).split(" ").filter(Boolean);
  return palabras.every((p) => texto.includes(p));
}
