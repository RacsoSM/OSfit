/**
 * La tirada de ruleta de un cliente en un mes. Hay a lo más una: el id del documento es
 * `{clienteId}_{AAAA-MM}`, así que "una tirada por mes" lo garantiza Firestore y no una
 * validación que se pueda olvidar.
 *
 * GEMELO: `Tirada` en `functions/src/reglasRuleta.ts` y `Tirada` en Kotlin.
 */
export interface Tirada {
  mes: string;
  color: string;
  gano: boolean;
  fecha: string;
}

/** [mes] en formato `AAAA-MM`. Devuelve el mes anterior en el mismo formato. */
export function mesAnterior(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  const previo = numero === 1 ? { anio: anio - 1, numero: 12 } : { anio, numero: numero - 1 };
  return `${previo.anio}-${String(previo.numero).padStart(2, "0")}`;
}

/**
 * Cuántos revives pierde el cliente este mes por haber perdido la ruleta el mes pasado.
 *
 * No se acumula: el piso es un castigo de 1. Un cliente en 0 revives permanentes es un
 * cliente al que la página ya solo le da malas noticias.
 *
 * Se calcula, no se guarda, por lo mismo que el cupo: si el documento de la ruleta se borra,
 * el castigo desaparece solo y no queda un contador viejo que nadie mira.
 */
export function castigoDelMes(tiradaMesAnterior: Tirada | null): number {
  return tiradaMesAnterior !== null && !tiradaMesAnterior.gano ? 1 : 0;
}
