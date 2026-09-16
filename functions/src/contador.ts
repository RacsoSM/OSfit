import { FieldValue } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

/**
 * Suma una entrada al acceso web del cliente.
 *
 * Cuenta **canjes del link**, que no es lo mismo que visitas ni que personas: la pagina
 * vuelve a canjear en cada carga donde no hay sesion viva, y en el navegador que WhatsApp
 * abre encima eso es siempre, porque ahi no sobrevive nada guardado. Asi que una recarga
 * suma, y dos clientas con el mismo uso pero distinto navegador no dan el mismo numero.
 * Sirve para ver quien usa su pagina y quien nunca la abrio; no para comparar a una con otra.
 *
 * `ultimoAcceso` viaja en la misma escritura porque sin el, el numero no se puede leer: 14
 * entradas dice algo muy distinto si la ultima fue ayer o en julio.
 *
 * `increment` y no leer-sumar-escribir: es atomico del lado del servidor, asi que dos canjes
 * a la vez no se pisan.
 *
 * Y nunca tira. El contador es un extra encima del canje; la clienta entra aunque contar
 * falle. Al reves seria cambiarle el acceso a su pagina por una estadistica.
 */
export async function contarEntrada(acceso: DocumentReference): Promise<void> {
  try {
    await acceso.update({
      entradas: FieldValue.increment(1),
      ultimoAcceso: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("No se pudo contar la entrada", { acceso: acceso.id, error });
  }
}
