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
  | { estado: "sin-acceso"; motivo?: MotivoSinAcceso }
  | { estado: "sin-conexion" };

/**
 * Cuál de los tres escalones dejó a la clienta afuera.
 *
 * No cambia lo que ella ve —siempre el candado—, pero sí lo que podemos averiguar cuando
 * nos avisa: "sin-rastro" es el callejón que este arreglo vino a tapar y no debería volver
 * a aparecer en una recarga; "recordado-rechazado" es el entrenador que revocó el acceso, y
 * "link-rechazado" es un link muerto desde el primer toque. Sin esto, los tres se ven igual
 * desde afuera y la única forma de distinguirlos es adivinando.
 */
export type MotivoSinAcceso = "link-rechazado" | "sin-rastro" | "recordado-rechazado";

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
 * Qué tan vivo está un almacén: `+` guarda, `r` deja leer pero no escribir, `x` ni existe.
 *
 * Es lo único que distingue las dos formas de quedarse sin rastro, que se arreglan al revés:
 * si los almacenes guardan bien y aun así el token no estaba, algo lo borró entre una carga
 * y la otra; si no guardan nada, ninguna red de seguridad que dependa de ellos va a servir
 * —tampoco la del SDK, que guarda la sesión ahí mismo— y hay que sostener el token en otro
 * lado.
 *
 * La prueba escribe de verdad, con su propia llave y borrándola enseguida: en Safari,
 * `setItem` puede tirar por cuota aunque leer funcione, así que preguntar no alcanza.
 */
export function saludDelAlmacen(almacen: Storage | null): "+" | "r" | "x" {
  if (!almacen) return "x";
  const llave = `${LLAVE_TOKEN}:prueba`;
  try {
    almacen.setItem(llave, "1");
    almacen.removeItem(llave);
    return "+";
  } catch {
    return "r";
  }
}

/** Las dos saludes juntas, como `s+l+`, para que quepan en el renglón del candado. */
export function saludDeLosAlmacenes(almacenes: (Storage | null)[]): string {
  const [sesion, local] = almacenes;
  return `s${saludDelAlmacen(sesion ?? null)}l${saludDelAlmacen(local ?? null)}`;
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
  /** El token escondido en la dirección por una versión anterior, si sigue ahí. */
  tokenEscondido(): string | null;
  /** Borra el token escondido, cuando el backend ya lo rechazó. */
  olvidarEscondido(): void;
  memoria: MemoriaToken;
}

/**
 * La escalera del arranque: tres formas de probar que es ella, de la más a la mano a la
 * menos.
 *
 * 1. **Token en la ruta.** Vino del link de WhatsApp. Se canjea y se recuerda, y la ruta se
 *    queda como está: `/c/<token>`.
 *
 *    Antes de acá el token se borraba de la barra con un `replaceState` a `/mi`, para que no
 *    quedara a la vista en una captura. Salía caro y por un lado que no se veía venir: todo
 *    lo que restaura "la última página" —WhatsApp al reabrir su navegador, Safari al
 *    recuperar la pestaña— restauraba `/mi`, que no dice quién es ella, así que la clienta
 *    terminaba en la pantalla de pedir link aunque hubiera entrado por su propio link. Con
 *    el token en la dirección, cualquier cosa que la restaure la deja adentro. Lo que se
 *    paga es que el token se ve en la barra; es el mismo que vive para siempre en su chat de
 *    WhatsApp, y sigue muriendo el día que el entrenador revoca el acceso.
 * 2. **Sesión guardada.** El camino normal de la segunda visita en adelante.
 * 3. **Token escondido en la dirección**, y si no, el recordado en el almacén. El
 *    paracaídas: la sesión guardada se perdió, pero todavía nos acordamos del token, así que
 *    se canjea otra vez y la clienta ni se entera.
 *
 * Lo escondido va antes que el almacén porque aguanta donde nada más aguanta. Medido en el
 * navegador que WhatsApp abre encima de sí mismo: al recargar no volvía el token del
 * almacén, ni el estado de la entrada del historial, ni la sesión que guarda el SDK —los
 * tres vacíos, y con el almacén escribiendo bien—, o sea que esa carga no continúa la
 * anterior: el contexto se rehace entero. Lo único que el navegador vuelve a pedir tal cual
 * es la dirección, y por eso el token viaja ahí.
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
    if (resultado.estado === "lista") entorno.memoria.recordar(deLaUrl);
    return resultado.estado === "sin-acceso"
      ? { estado: "sin-acceso", motivo: "link-rechazado" }
      : resultado;
  }

  const guardada = await entorno.sesionGuardada();
  if (guardada) return { estado: "lista", clienteId: guardada };

  const recordado = entorno.tokenEscondido() ?? entorno.memoria.recordado();
  if (!recordado) return { estado: "sin-acceso", motivo: "sin-rastro" };

  const resultado = await entorno.canjear(recordado);
  // Se olvida solo cuando el backend dijo que el token ya no vale. Si lo que falló fue la
  // red, se queda: es la única copia que nos queda del link.
  if (resultado.estado !== "sin-acceso") return resultado;
  entorno.memoria.olvidar();
  entorno.olvidarEscondido();
  return { estado: "sin-acceso", motivo: "recordado-rechazado" };
}
