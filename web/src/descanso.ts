import { companero, serieCompleta, type Borrador } from "./registro";

/**
 * El cronómetro de descanso entre series (entrenador, 2026-10-31). Se prende en Ajustes y no
 * tiene una duración fija: solo cuenta cuánto lleva descansando.
 *
 * Es automático: cada vez que una serie queda completa, el descanso vuelve a 0:00, y lo que
 * llevaba se anota en esa serie como "lo que descansó antes de ella". No hay un botón de "ya
 * terminé la serie", así que la serie cuenta como hecha en cuanto se escribe (o en cuanto
 * "+ Serie" la agrega ya copiada): lo anotado es el tiempo entre una serie y la siguiente.
 *
 * Todo vive en el borrador, en este teléfono, mientras el entrenamiento está abierto. No se
 * envía (`paraEnviar` arma las series de cero) y al terminar se borra con el borrador.
 */
const LLAVE = "osfit:registro-descanso";

export function descansoActivo(): boolean {
  try {
    return localStorage.getItem(LLAVE) === "1";
  } catch {
    return false;
  }
}

export function guardarDescansoActivo(activo: boolean): void {
  try {
    if (activo) localStorage.setItem(LLAVE, "1");
    else localStorage.removeItem(LLAVE);
  } catch {
    // Sin almacenamiento solo se olvida: queda apagado.
  }
}

/**
 * Si la serie `iSerie` del ejercicio `iEj` acaba de quedar completa: la marca como hecha, le
 * anota lo que descansó desde la serie anterior y reinicia el descanso. Si no aplica, el mismo
 * borrador, sin copiarlo (así quien llama sabe que no cambió nada):
 *  - una serie ya contada (corregir un número no reinicia el descanso);
 *  - una a medio llenar, el cardio, o la corrección de un entrenamiento pasado.
 *
 * En una biserie el descanso es entre rondas: la B se hace justo después de la A, así que la B
 * reinicia el descanso pero no anota uno propio.
 */
export function marcarDescanso(b: Borrador, iEj: number, iSerie: number, ahora: number): Borrador {
  const e = b.ejercicios[iEj];
  const s = e?.series[iSerie];
  if (!e || !s || b.edicion || e.tipo === "cardio" || s.hecha !== undefined) return b;
  if (!serieCompleta(b, e, s)) return b;
  const otro = companero(b, iEj);
  const esB = otro !== null && otro < iEj;
  const previa = b.ultimaSerie;
  const descanso = !esB && previa !== undefined && ahora > previa ? ahora - previa : undefined;
  const marcada = { ...s, hecha: ahora, ...(descanso !== undefined ? { descanso } : {}) };
  return {
    ...b,
    ultimaSerie: ahora,
    ejercicios: b.ejercicios.map((x, i) => (i !== iEj ? x
      : { ...x, series: x.series.map((y, j) => (j === iSerie ? marcada : y)) })),
  };
}
