/**
 * Interpretación del trío que denormaliza la app Android.
 *
 * GEMELO: `RutinaProgressCalculator.interpretar` en Kotlin. Si cambia allá, cambia acá.
 * Toda la lógica difícil (ancla, historial, clientes anteriores al corte) queda del lado
 * de Kotlin a propósito: acá solo se interpreta el resultado.
 *
 * Única diferencia con el gemelo: sin rutina, Kotlin devuelve 0 (para no romper a quien
 * espera un índice) y acá se devuelve null, porque la página necesita distinguir "día 1"
 * de "todavía no hay rutina" para elegir qué tarjeta mostrar.
 */
export interface DiaDenormalizado {
  dia: number | null;
  fecha: string | null;
  esAncla: boolean;
}

export function interpretar(
  valor: DiaDenormalizado,
  totalDias: number,
  fecha: string
): number | null {
  if (valor.dia === null || totalDias <= 0) return null;
  const acotado = Math.min(Math.max(valor.dia, 0), totalDias - 1);
  if (valor.esAncla) return acotado;
  if (valor.fecha === fecha) return acotado;
  return acotado + 1 >= totalDias ? 0 : acotado + 1;
}
