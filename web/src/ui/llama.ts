/**
 * La llama de la racha. Azul para quien alguna vez llegó a una racha de 30, la misma condición
 * del revive extra (`tieneReviveExtra` en `cupo.ts`; en el ranking la manda el servidor),
 * decisión del entrenador del 2026-10-17.
 *
 * No hay emoji de llama azul: es el 🔥 con el tono rotado por CSS (`.llama-azul`). Así se ve
 * igual de "emoji" que la roja en cada teléfono.
 */
export function llama(azul: boolean): string {
  return azul ? `<span class="llama-azul" role="img" aria-label="llama azul">🔥</span>` : "🔥";
}
