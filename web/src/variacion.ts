import type { Asistencia } from "./datos";

/**
 * Qué variación de un día del ciclo le toca hoy a la clienta.
 *
 * GEMELO: `VariacionCalculator.variacionQueToca` en Kotlin. Si cambia allá, cambia acá.
 *
 * A diferencia del día, esto **no se denormaliza** al documento del cliente. El día se
 * denormalizó porque su cálculo es difícil (ancla, FECHA_CORTE, clientes anteriores al corte) y
 * no valía la pena reescribirlo acá. La variación es una búsqueda del máximo sobre asistencias
 * que la página ya tiene descargadas con `observarAsistencias`, así que denormalizarla sólo
 * agregaría un campo capaz de quedar viejo, sin ahorrar nada.
 */
export function variacionQueToca(
  diaDelCiclo: number,
  asistencias: Asistencia[],
  hoy: string,
  totalVariaciones: number
): number {
  // 0 variaciones es un día normal y 1 no tiene a dónde rotar.
  if (totalVariaciones <= 1) return 0;

  let ultima: Asistencia | null = null;
  for (const a of asistencias) {
    if (!a.asistio || a.diaRutinaRealizado !== diaDelCiclo) continue;
    if (a.fecha > hoy) continue;
    if (ultima === null || a.fecha > ultima.fecha) ultima = a;
  }
  if (ultima === null) return 0;

  // `== null` a propósito, no `===`: Firestore omite los campos que nunca se escribieron, así
  // que toda asistencia anterior a esta feature llega con `undefined` y no con `null`. Es la
  // misma trampa que documentó `dia.ts`, donde con `===` se coló un NaN hasta indexar dias[NaN].
  const realizada = ultima.variacionRealizada == null ? 0 : ultima.variacionRealizada;
  const acotada = Math.min(Math.max(realizada, 0), totalVariaciones - 1);

  // Si ya entrenó hoy se queda en la que hizo: puede tener la página abierta mientras entrena y
  // los ejercicios no deben saltarle a otros a media jornada.
  return ultima.fecha === hoy ? acotada : (acotada + 1) % totalVariaciones;
}
