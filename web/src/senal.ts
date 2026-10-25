/**
 * La señal "dudosa": Wi-Fi o datos prendidos, pero sin internet de verdad (una red sin salida,
 * una barra de señal que no alcanza). El teléfono dice que hay red, así que nada falla rápido:
 * los pedidos se quedan esperando y la página se quedaba pensando. Con Wi-Fi y datos apagados,
 * en cambio, todo falla al instante y la página entraba sin internet como debe (decisión del
 * entrenador, 2026-10-25: que con señal dudosa entre igual).
 *
 * Por eso el arranque no le cree al teléfono: pregunta algo chiquito con un plazo corto
 * (`hayRed`) y, si no llega, se porta como sin señal. Mientras tanto vuelve a preguntar solo
 * (`esperarRed`), porque el evento `online` no llega: para el teléfono nunca se fue.
 */

/** El error de un plazo vencido. Lleva el código de red del SDK para tratarlo igual. */
export function errorDePlazo(): Error & { code: string } {
  return Object.assign(new Error("La red no respondió a tiempo."), { code: "auth/network-request-failed" });
}

/** [promesa], o un fallo de red si no resuelve en [ms]. No la cancela: solo deja de esperarla. */
export function conPlazo<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(errorDePlazo()), ms);
    promesa.then(
      (v) => { clearTimeout(reloj); resolver(v); },
      (e) => { clearTimeout(reloj); rechazar(e); }
    );
  });
}

/**
 * Cuánto se espera la pregunta de prueba. `/version.json` pesa unos bytes: con internet de
 * verdad, aun lento, llega muy por debajo de esto.
 */
export const PLAZO_PRUEBA_MS = 3000;

/** Si [pedir] contesta a tiempo. Cualquier respuesta cuenta: lo que se prueba es la salida. */
export async function hayRed(pedir: () => Promise<unknown>, ms = PLAZO_PRUEBA_MS): Promise<boolean> {
  try {
    await conPlazo(pedir(), ms);
    return true;
  } catch {
    return false;
  }
}

/** Cada cuánto se vuelve a probar mientras la señal sigue dudosa. */
export const CADA_MS = 15_000;

/**
 * Vuelve a probar cada [cada] ms (y cuando [alVolver] avisa) hasta que haya red, y entonces
 * llama a [alHaber] una sola vez.
 */
export function esperarRed(
  probar: () => Promise<boolean>,
  alHaber: () => void,
  entorno: { cada: (f: () => void, ms: number) => () => void; alVolver: (f: () => void) => void },
  cada = CADA_MS
): void {
  let listo = false;
  let probando = false;
  const intentar = async () => {
    if (listo || probando) return;
    probando = true;
    const ok = await probar();
    probando = false;
    if (!ok || listo) return;
    listo = true;
    parar();
    alHaber();
  };
  const parar = entorno.cada(intentar, cada);
  entorno.alVolver(intentar);
}
