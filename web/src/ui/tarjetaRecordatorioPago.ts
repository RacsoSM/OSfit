import type { RecordatorioPago } from "../pago";

/**
 * La tarjeta "Tu periodo de entrenamiento vence en X días" de Inicio. Solo informa: sin botones
 * ni montos. Va verde mientras el periodo sigue vigente (incluido el día del pago) y roja cuando
 * ya venció; se queda roja hasta que el entrenador registre el pago y se mueva la fecha.
 *
 * Solo lleva números, así que no hay nada de Firestore que escapar.
 */
export function tarjetaRecordatorioPago(r: RecordatorioPago): string {
  if (!r.visible) return "";
  const clase = r.vencido ? "vencido" : "vigente";
  return `
    <div class="tarjeta recordatorio-pago ${clase}" role="status">
      <p class="recordatorio-pago-texto">${frase(r.dias)}</p>
    </div>`;
}

/** "En 0 días" y "en -3 días" se leen como un error: hoy y vencido tienen su propia frase. */
function frase(dias: number): string {
  const base = "Tu periodo de entrenamiento";
  if (dias === 0) return `${base} vence hoy`;
  if (dias > 0) return `${base} vence en ${conUnidad(dias)}`;
  return `${base} venció hace ${conUnidad(-dias)}`;
}

function conUnidad(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}
