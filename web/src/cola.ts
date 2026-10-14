/**
 * Los entrenamientos que se terminaron sin internet y esperan a mandarse (backlog 2, punto 11).
 *
 * "Terminar entrenamiento" pasa por la función `registrarSesion`, que necesita red. Sin señal,
 * el entrenamiento se guarda aquí, en el teléfono, y se manda solo cuando vuelve: al abrir la
 * página, al recuperar la conexión y cada minuto mientras quede alguno.
 *
 * Mandarlo dos veces no lo duplica: el id lo pone el borrador y la función lo usa como id del
 * documento. Por eso, si la respuesta se pierde, reintentar es seguro.
 *
 * Cada pendiente lleva de quién es: en un teléfono compartido, lo de una clienta no se manda
 * con la sesión de otra.
 */
import type { Envio } from "./registro";

export const LLAVE_COLA = "osfit:cola-sesiones";

export interface Pendiente {
  clienteId: string;
  envio: Envio;
}

/** La cola guardada, o vacía si no hay o está dañada: un texto roto no tumba la página. */
export function leerCola(texto: string | null): Pendiente[] {
  if (!texto) return [];
  try {
    const datos: unknown = JSON.parse(texto);
    if (!Array.isArray(datos)) return [];
    return datos.filter(
      (p): p is Pendiente =>
        typeof p === "object" && p !== null &&
        typeof (p as Pendiente).clienteId === "string" &&
        typeof (p as Pendiente).envio?.id === "string" &&
        Array.isArray((p as Pendiente).envio?.ejercicios)
    );
  } catch {
    return [];
  }
}

/** Agrega uno; si ya estaba (mismo id), lo reemplaza en vez de duplicarlo. */
export function encolar(cola: readonly Pendiente[], p: Pendiente): Pendiente[] {
  return [...cola.filter((x) => x.envio.id !== p.envio.id), p];
}

export function quitar(cola: readonly Pendiente[], id: string): Pendiente[] {
  return cola.filter((x) => x.envio.id !== id);
}

export function pendientesDe(cola: readonly Pendiente[], clienteId: string): Pendiente[] {
  return cola.filter((x) => x.clienteId === clienteId);
}

/**
 * Si el servidor dijo que el entrenamiento no sirve: ese no se reintenta, nunca va a pasar.
 * Todo lo demás —sin red (el SDK lo reporta como `internal`), un servidor que tose, una
 * sesión que no se pudo renovar— se queda en la cola para el siguiente intento.
 */
export function rechazoDefinitivo(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "functions/invalid-argument";
}

/** La cola en el `localStorage` del teléfono. Si no se puede leer o escribir, queda vacía. */
export interface Almacen {
  leer(): Pendiente[];
  guardar(cola: Pendiente[]): void;
}

export function almacenCola(almacen: Storage | null): Almacen {
  return {
    leer() {
      try {
        return leerCola(almacen?.getItem(LLAVE_COLA) ?? null);
      } catch {
        return [];
      }
    },
    guardar(cola) {
      try {
        if (cola.length === 0) almacen?.removeItem(LLAVE_COLA);
        else almacen?.setItem(LLAVE_COLA, JSON.stringify(cola));
      } catch {
        /* Almacén lleno o bloqueado: el entrenamiento sigue en el borrador si no se pudo. */
      }
    },
  };
}

/**
 * Manda los pendientes de esta clienta, uno por uno y en orden. Se detiene en el primero que
 * falla por la red: los demás tampoco van a pasar. Devuelve cuántos quedan.
 */
export async function enviarPendientes(
  almacen: Almacen,
  clienteId: string,
  enviar: (envio: Envio) => Promise<unknown>
): Promise<number> {
  for (const p of pendientesDe(almacen.leer(), clienteId)) {
    try {
      await enviar(p.envio);
    } catch (error) {
      if (!rechazoDefinitivo(error)) break;
      console.warn("Entrenamiento rechazado por el servidor, se quita de la cola", p.envio.id, error);
    }
    almacen.guardar(quitar(almacen.leer(), p.envio.id));
  }
  return pendientesDe(almacen.leer(), clienteId).length;
}
