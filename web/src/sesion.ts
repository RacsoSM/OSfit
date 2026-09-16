/**
 * Las decisiones del arranque: qué token hay a la mano y qué significa lo que respondió
 * `sesion`.
 *
 * Vive aparte de `firebase.ts` a propósito. Acá no se importa el SDK ni se toca `location`,
 * así que todo esto se prueba con datos en vez de con un navegador; `firebase.ts` se queda
 * solo con lo que sí necesita uno.
 */

/**
 * En qué quedó el intento de meter a la clienta a su sesión.
 *
 * Los dos fracasos están separados porque se arreglan distinto, y confundirlos es
 * justamente lo que la mandaba a pedir un link nuevo sin necesidad: `sin-acceso` es un link
 * que ya no sirve —revocado o inventado— y el único camino es que el entrenador comparta
 * otro; `sin-conexion` es la red, y el camino es volver a intentar en un minuto.
 */
export type ResultadoSesion =
  | { estado: "lista"; clienteId: string }
  | { estado: "sin-acceso" }
  | { estado: "sin-conexion" };

const RUTA_CON_TOKEN = /^\/c\/([A-Za-z0-9]+)$/;

/** El token del link mágico si la ruta es la del link; `null` en cualquier otra. */
export function tokenEnLaUrl(ruta: string): string | null {
  return ruta.match(RUTA_CON_TOKEN)?.[1] ?? null;
}

/**
 * Qué significa el status con el que respondió `sesion`.
 *
 * El 429 y los 5xx van con la red y no con el link: un arranque en frío de Cloud Run que
 * tarda de más se ve igual que un bache de señal, y en ninguno de los dos casos el token
 * tiene nada de malo. Leerlos como "link inválido" le costaría a la clienta un link nuevo
 * cada vez que el backend tose.
 */
export function lecturaDelStatus(status: number): "canjeado" | "sin-acceso" | "sin-conexion" {
  if (status === 200) return "canjeado";
  if (status === 429 || status >= 500) return "sin-conexion";
  return "sin-acceso";
}

/** Dónde se guarda el token recordado. Con prefijo para no chocar con las llaves del SDK. */
export const LLAVE_TOKEN = "osfit:acceso";

export interface MemoriaToken {
  recordar(token: string): void;
  recordado(): string | null;
  olvidar(): void;
}

/**
 * Guarda el token del link para poder volver a canjearlo.
 *
 * Esto es lo que quita el callejón sin salida. Antes el token se usaba una vez y
 * desaparecía con el `replaceState`, así que la sesión guardada por el SDK era el único
 * hilo del que colgaba todo: si ese hilo se cortaba —y en iOS se corta solo, porque Safari
 * borra el almacenamiento de un sitio con el que no interactúas en una semana, y el
 * navegador interno de WhatsApp ni siquiera comparte el almacén con Safari— la clienta caía
 * en `/mi` sin sesión y sin nada con qué recuperarla. El token guardado es el segundo hilo.
 *
 * Escribe en los dos almacenes porque fallan en momentos distintos: `sessionStorage`
 * aguanta una recarga incluso donde `localStorage` está bloqueado o ya fue borrado, y
 * `localStorage` aguanta cerrar la pestaña. Basta con que uno sobreviva.
 *
 * Guardar el token no deshace la razón del `replaceState`: lo que se buscaba era que el
 * token no quedara *a la vista* —en una captura, o al pasarle la dirección a alguien— y en
 * el almacén del propio sitio no está a la vista de nadie. Y no es un secreto nuevo: es el
 * mismo que vive para siempre en su chat de WhatsApp, junto al token de sesión que el SDK
 * ya guarda ahí al lado.
 *
 * Cada acceso va en su `try`: en modo privado, con la cuota llena o dentro de un navegador
 * embebido, leer `setItem` puede tirar. Se pierde el respaldo, nunca la página.
 */
export function memoriaToken(almacenes: (Storage | null)[]): MemoriaToken {
  const vivos = almacenes.filter((a): a is Storage => a !== null);
  return {
    recordar(token: string): void {
      for (const almacen of vivos) {
        try {
          almacen.setItem(LLAVE_TOKEN, token);
        } catch {
          /* Almacén lleno o bloqueado: que lo intente el siguiente. */
        }
      }
    },
    recordado(): string | null {
      for (const almacen of vivos) {
        try {
          const token = almacen.getItem(LLAVE_TOKEN);
          if (token) return token;
        } catch {
          /* Igual que arriba: leer también puede tirar. */
        }
      }
      return null;
    },
    olvidar(): void {
      for (const almacen of vivos) {
        try {
          almacen.removeItem(LLAVE_TOKEN);
        } catch {
          /* Si no se puede borrar, el siguiente canje lo va a volver a rechazar igual. */
        }
      }
    },
  };
}

/**
 * Los almacenes del navegador, o `null` donde no se pueda ni nombrarlos.
 *
 * El `try` no es paranoia: con las cookies de terceros bloqueadas, en un iframe o en algunos
 * navegadores embebidos, *acceder* a `localStorage` tira `SecurityError` antes de que uno
 * alcance a leer nada.
 */
export function almacenesDelNavegador(): (Storage | null)[] {
  return [alcanzar(() => sessionStorage), alcanzar(() => localStorage)];
}

function alcanzar(traer: () => Storage): Storage | null {
  try {
    return traer();
  } catch {
    return null;
  }
}

/**
 * Lo que `resolverSesion` necesita del mundo de afuera.
 *
 * Existe para que la escalera de abajo se pueda probar. Todo lo que toca un navegador o el
 * SDK entra por acá, así que el test la corre con cuatro funciones de mentiras y sin jsdom.
 */
export interface EntornoSesion {
  /** La ruta que la clienta tiene abierta. */
  rutaActual(): string;
  /** Canjea un token por una sesión. Nunca tira: las fallas vuelven como estado. */
  canjear(token: string): Promise<ResultadoSesion>;
  /** El `clienteId` de la sesión que el SDK haya restaurado, o `null` si no hay. */
  sesionGuardada(): Promise<string | null>;
  /** Saca el token de la barra de direcciones. */
  esconderToken(): void;
  memoria: MemoriaToken;
}

/**
 * La escalera del arranque: tres formas de probar que es ella, de la más a la mano a la
 * menos.
 *
 * 1. **Token en la URL.** Vino del link de WhatsApp. Se canjea, se recuerda, y la URL pasa a
 *    `/mi` para que el token no quede a la vista en una captura ni al pasarle la dirección a
 *    alguien.
 * 2. **Sesión guardada.** El camino normal de la segunda visita en adelante.
 * 3. **Token recordado.** El paracaídas: la sesión guardada se perdió, pero todavía nos
 *    acordamos del token, así que se canjea otra vez y la clienta ni se entera.
 *
 * El escalón 3 es la razón de todo esto. Sin él, después del `replaceState` la sesión
 * guardada era lo único que quedaba, y perderla dejaba a la clienta en un callejón sin
 * salida: `/mi`, sin sesión, sin token, y una pantalla pidiéndole que le pida otro link al
 * entrenador aunque el suyo siguiera perfectamente vivo. En iOS ese callejón no es raro:
 * Safari borra el almacenamiento de un sitio con el que no interactúas en una semana, y
 * abrir el link desde el navegador de WhatsApp puede ni siquiera usar el mismo almacén que
 * Safari.
 */
export async function resolverSesion(entorno: EntornoSesion): Promise<ResultadoSesion> {
  const deLaUrl = tokenEnLaUrl(entorno.rutaActual());
  if (deLaUrl) {
    const resultado = await entorno.canjear(deLaUrl);
    if (resultado.estado === "lista") {
      // Primero recordar, después esconder. Al revés, una falla al guardar dejaría
      // exactamente el callejón sin salida que veníamos a tapar.
      entorno.memoria.recordar(deLaUrl);
      entorno.esconderToken();
    }
    return resultado;
  }

  const guardada = await entorno.sesionGuardada();
  if (guardada) return { estado: "lista", clienteId: guardada };

  const recordado = entorno.memoria.recordado();
  if (!recordado) return { estado: "sin-acceso" };

  const resultado = await entorno.canjear(recordado);
  // Se olvida solo cuando el backend dijo que el token ya no vale. Si lo que falló fue la
  // red, se queda: es la única copia que nos queda del link.
  if (resultado.estado === "sin-acceso") entorno.memoria.olvidar();
  return resultado;
}
