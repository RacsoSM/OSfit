/**
 * Lo puro del envio de avisos: a quien, en cuantas tandas y que tokens tirar.
 *
 * Vive aparte de `enviarNotificacion.ts` para probarse en Node sin Firestore ni FCM, como
 * `rachas.ts` respecto de `ranking.ts`.
 */

/**
 * Largo maximo del texto de un aviso. Un aviso de mas no rompe nada, pero en la pantalla
 * bloqueada se corta a las pocas lineas, asi que un texto largo se lee a medias.
 *
 * GEMELO: `Avisos.LARGO_MAXIMO` en `app/.../domain/Avisos.kt`.
 */
export const LARGO_MAXIMO_TEXTO = 500;

/** Maximo de tokens por llamada a `sendEachForMulticast`. Lo fija FCM. */
const TANDA_FCM = 500;

export interface ClienteParaAviso {
  id: string;
  activo: boolean;
  notificacionesWeb: boolean;
}

export interface Aviso {
  titulo: string;
  texto: string;
  destino: "todas" | "elegidas";
  clientesElegidos: string[];
}

/** Campos ausentes o de tipo raro cuentan como `false`: ante la duda, no se manda. */
export function clienteParaAvisoDesdeDoc(id: string, data: Record<string, unknown>): ClienteParaAviso {
  return {
    id,
    activo: data.activo === true,
    notificacionesWeb: data.notificacionesWeb === true,
  };
}

export function avisoDesdeDoc(data: Record<string, unknown>): Aviso | null {
  const texto = typeof data.texto === "string" ? data.texto.trim() : "";
  if (texto === "" || texto.length > LARGO_MAXIMO_TEXTO) return null;
  const titulo = typeof data.titulo === "string" && data.titulo.trim() !== "" ? data.titulo.trim() : "OSfit";
  const destino = data.destino === "elegidas" ? "elegidas" : "todas";
  const clientesElegidos = Array.isArray(data.clientesElegidos)
    ? data.clientesElegidos.filter((x): x is string => typeof x === "string")
    : [];
  return { titulo, texto, destino, clientesElegidos };
}

/**
 * A quien le llega. La llave del entrenador (`notificacionesWeb`) manda siempre: elegir a
 * una clienta en la lista no la habilita. Asi apagar el interruptor de alguien basta para
 * que deje de recibir, sin revisar avisos viejos ni listas guardadas.
 *
 * GEMELO: `Avisos.destinatarias` en `app/.../domain/Avisos.kt` (la app lo usa para decir
 * cuantas lo van a recibir antes de enviar).
 */
export function destinatarias(clientes: ClienteParaAviso[], aviso: Aviso): string[] {
  const habilitadas = clientes.filter((c) => c.activo && c.notificacionesWeb);
  if (aviso.destino === "todas") return habilitadas.map((c) => c.id);
  const elegidas = new Set(aviso.clientesElegidos);
  return habilitadas.filter((c) => elegidas.has(c.id)).map((c) => c.id);
}

export function enTandas<T>(xs: T[], tamano: number = TANDA_FCM): T[][] {
  const tandas: T[][] = [];
  for (let i = 0; i < xs.length; i += tamano) tandas.push(xs.slice(i, i + tamano));
  return tandas;
}

/**
 * Si FCM dice que ese token ya no existe: la clienta desinstalo la pagina o le quito el
 * permiso. Solo esos se borran. `invalid-argument` NO esta aqui a proposito: tambien sale
 * cuando el mensaje esta mal armado, y en ese caso borraria los tokens de todas de un golpe.
 */
export function esTokenMuerto(codigo: string | undefined): boolean {
  return (
    codigo === "messaging/registration-token-not-registered" ||
    codigo === "messaging/invalid-registration-token"
  );
}
