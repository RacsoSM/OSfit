/**
 * Las reglas del juego, sin Firestore y sin red: qué impide jugar, y cómo se resuelve una
 * tirada. Vive aparte de `jugarRuleta.ts` para poder probarse en Node, que es donde tiene
 * que estar probada la única función que regala premios y aplica castigos.
 */

/**
 * Cuántas veces de cada diez cae en el color que el cliente apostó.
 *
 * ESTE NÚMERO NO SALE DE `functions/`. La ruleta se dibuja mitad y mitad en la página: si el
 * navegador conociera la probabilidad, cualquiera que abra la consola sabría que está
 * cargada. Ver "Riesgo aceptado" en el spec.
 */
export const PROBABILIDAD_GANAR = 0.7;

/**
 * Los dos colores de la ruleta. **Son fijos y no salen de la paleta de la clienta**, al revés
 * que todo lo demás de la página.
 *
 * Hasta el 2026-09-22 eran `["primario", "ambar"]` —nombres de variable CSS— para que el
 * sector tomara el color que el entrenador le hubiera elegido a cada clienta. Se revirtió por
 * dos motivos: con el color cambiando por cliente **el acuse no podía nombrarlo** ("Cayó en
 * morado" con la rueda turquesa, entrada 26 del backlog), y cualquier rediseño del dibujo
 * tenía que quedar bien con las cinco paletas. Rojo y negro son además los de una ruleta de
 * verdad, que es hacia donde va el dibujo (entrada 28).
 *
 * El valor viaja a Firestore tal cual, en `ruletas/{cliente}_{mes}.color`. Se pudo renombrar
 * sin migración porque nadie había jugado todavía; a partir de la primera tirada, ya no.
 */
export const COLORES = ["rojo", "negro"] as const;
export type Color = (typeof COLORES)[number];

export type MotivoRechazo =
  | "cuenta_pausada"
  | "sin_falta_reparable"
  | "todavia_tiene_cupo"
  | "ya_jugo";

export interface EstadoParaJugar {
  activo: boolean;
  /** La fecha de la falta reparable, o `null` si no hay ninguna en la ventana. */
  faltaRota: string | null;
  /** Revives que le quedan este mes. El juego solo se ofrece con esto en cero. */
  disponibles: number;
  yaJugo: boolean;
}

/**
 * El primer motivo por el que este cliente no puede jugar, o `null` si puede.
 *
 * El orden importa: la cuenta pausada va primero porque es el único motivo que el cliente no
 * puede resolver solo, y devolverle "ya jugaste" a alguien cuya cuenta está pausada lo manda
 * a esperar al mes que viene en vez de a hablar con su entrenador.
 */
export function motivoDeRechazo(estado: EstadoParaJugar): MotivoRechazo | null {
  if (!estado.activo) return "cuenta_pausada";
  if (estado.faltaRota === null) return "sin_falta_reparable";
  if (estado.disponibles > 0) return "todavia_tiene_cupo";
  if (estado.yaJugo) return "ya_jugo";
  return null;
}

/**
 * Resuelve una tirada. [azar] entra como parámetro en vez de llamar a `Math.random()` acá
 * adentro para que se pueda fijar en las pruebas: un sorteo que no se puede fijar es un
 * sorteo que no se puede probar.
 */
export function resolverTirada(apostado: Color, azar: number): { gano: boolean; color: Color } {
  const gano = azar < PROBABILIDAD_GANAR;
  const otro: Color = apostado === "rojo" ? "negro" : "rojo";
  return { gano, color: gano ? apostado : otro };
}

/** [mes] en formato `AAAA-MM`. Devuelve el mes anterior en el mismo formato.
 *
 * GEMELO: `mesAnterior` en `web/src/tirada.ts`. Se duplica a propósito: `functions/` y
 * `web/` son proyectos npm separados y no se importan entre sí.
 */
export function mesAnterior(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  const previo = numero === 1 ? { anio: anio - 1, numero: 12 } : { anio, numero: numero - 1 };
  return `${previo.anio}-${String(previo.numero).padStart(2, "0")}`;
}

/** Lo mínimo que necesita `castigoDelMes` de la tirada del mes anterior. */
export interface TiradaParaCastigo {
  gano: boolean;
}

/**
 * Cuántos revives pierde el cliente este mes por haber perdido la ruleta el mes pasado.
 *
 * No se acumula: el piso es un castigo de 1. Un cliente en 0 revives permanentes es un
 * cliente al que la página ya solo le da malas noticias.
 *
 * Se calcula, no se guarda, por lo mismo que el cupo: si el documento de la ruleta se borra,
 * el castigo desaparece solo y no queda un contador viejo que nadie mira.
 *
 * GEMELO: `castigoDelMes` en `web/src/tirada.ts`. Tienen que dar el mismo número: el
 * servidor lo usa para calcular el cupo antes de decidir `todavia_tiene_cupo`, y si no
 * coincidiera con lo que la página ya mostró, a una clienta castigada (cupo 0 en su
 * pantalla) el servidor le calcularía cupo 1 y le rechazaría la tirada que la página le
 * ofreció.
 */
export function castigoDelMes(tiradaMesAnterior: TiradaParaCastigo | null): number {
  return tiradaMesAnterior !== null && !tiradaMesAnterior.gano ? 1 : 0;
}
