/**
 * El modo sin datos: un interruptor de Ajustes para que la página no use internet, pensado
 * para cuando la clienta anda con datos móviles y no quiere gastarlos.
 *
 * Con el modo puesto la página se porta como sin señal, que es un camino que ya existe
 * (backlog 2, punto 11): Firestore muestra lo guardado en el teléfono, lo que se termina en
 * Registro se queda en la cola (`cola.ts`) y las acciones que necesitan al servidor fallan
 * como fallarían sin red, sin llegar a intentarlo. El service worker (`public/sw.js`) es la
 * red de seguridad: con el modo puesto no deja salir ningún pedido y contesta solo con lo
 * guardado, así que lo que se le escape a la página (un GIF nuevo, una fuente, la renovación
 * del token) tampoco gasta datos.
 *
 * Se guarda en este teléfono (`localStorage`) y también en el caché del service worker,
 * porque el service worker no puede leer `localStorage` y se apaga y se vuelve a prender solo.
 */

export const LLAVE_SIN_DATOS = "osfit:modo-sin-datos";
/** GEMELO de `CACHE_MEDIOS` en `public/sw.js`: donde el service worker guarda los GIF. */
export const CACHE_MEDIOS = "osfit-medios-v1";
/** GEMELOS de `CACHE_AJUSTES` y `MARCA_SIN_DATOS` en `public/sw.js`. */
export const CACHE_AJUSTES = "osfit-ajustes";
export const MARCA_SIN_DATOS = "/__modo-sin-datos";

let activo = leerGuardado();

function leerGuardado(): boolean {
  try { return localStorage.getItem(LLAVE_SIN_DATOS) === "1"; } catch { return false; }
}

export function modoSinDatos(): boolean {
  return activo;
}

/**
 * Prende o apaga el modo en el teléfono y avisa al service worker. Lo de Firestore y la cola
 * lo hace quien llama (`main.ts`): este módulo no carga Firebase para poder probarse en Node.
 */
export async function guardarModoSinDatos(nuevo: boolean): Promise<void> {
  activo = nuevo;
  try {
    if (nuevo) localStorage.setItem(LLAVE_SIN_DATOS, "1");
    else localStorage.removeItem(LLAVE_SIN_DATOS);
  } catch {
    /* Sin almacén dura lo que la página abierta; al recargar vuelve a estar apagado. */
  }
  try {
    const cache = await caches.open(CACHE_AJUSTES);
    if (nuevo) await cache.put(MARCA_SIN_DATOS, new Response("1"));
    else await cache.delete(MARCA_SIN_DATOS);
  } catch {
    /* Sin Cache API tampoco hay service worker que avisar. */
  }
  // El service worker que ya está despierto guarda el modo en memoria: se le avisa para que
  // no siga con el de antes hasta que se apague.
  navigator.serviceWorker?.controller?.postMessage({ tipo: "modo-sin-datos", activo: nuevo });
}

/**
 * El error con el que fallan las llamadas al servidor con el modo puesto. Lleva el mismo
 * código que el SDK da sin red, así que cada pantalla lo trata como ya trata la falta de señal.
 */
export function errorSinDatos(): Error & { code: string } {
  return Object.assign(new Error("Modo sin datos: desactívalo en Ajustes para usar internet."), {
    code: "functions/unavailable",
  });
}

let alBloquearEscucha: (() => void) | null = null;

/**
 * Quién se entera cuando la clienta toca algo que necesita internet con el modo puesto
 * (`main.ts` ofrece apagarlo). Las llamadas que la página hace sola no avisan.
 */
export function alBloquear(escucha: () => void): void {
  alBloquearEscucha = escucha;
}

export function avisarBloqueo(): void {
  alBloquearEscucha?.();
}

/**
 * Si la conexión es Wi-Fi, según lo que diga el navegador. Solo Chrome y los navegadores de
 * Android dicen el tipo (`navigator.connection.type`); Safari y los de iPhone no lo dicen, y
 * ahí nunca se sugiere: no hay forma de saberlo.
 */
export function esWifi(tipo: string | undefined): boolean {
  return tipo === "wifi" || tipo === "ethernet";
}

/**
 * Si toca sugerir que apague el modo: está puesto, el teléfono está en Wi-Fi y no dijo
 * "Ahora no" desde la última vez que entró al Wi-Fi.
 */
export function sugerirApagar(activoAhora: boolean, tipo: string | undefined, descartado: boolean): boolean {
  return activoAhora && esWifi(tipo) && !descartado;
}

/** La parte de `navigator.connection` que se usa. No viene en los tipos de TypeScript. */
export interface Conexion {
  type?: string;
  addEventListener(evento: "change", escucha: () => void): void;
}

export function conexionDelNavegador(): Conexion | null {
  return (navigator as Navigator & { connection?: Conexion }).connection ?? null;
}

/** Lo que usa `guardarFaltantes`, inyectado para probarlo sin navegador. */
export interface AlmacenMedios {
  tiene(url: string): Promise<boolean>;
  bajar(url: string): Promise<void>;
}

/**
 * Baja al teléfono los GIF que todavía no tiene, unos cuantos a la vez, avisando el avance. Se
 * llama al prender el modo sin datos (entrenador, 2026-10-20): sin esto solo se ven sin datos
 * los GIF que se mostraron alguna vez con internet. Uno que falla no detiene a los demás.
 */
export async function guardarFaltantes(
  urls: readonly string[],
  almacen: AlmacenMedios,
  alAvanzar: (hechos: number, total: number) => void,
  simultaneos = 6
): Promise<{ fallidos: number }> {
  const faltan: string[] = [];
  for (const u of new Set(urls)) if (!(await almacen.tiene(u).catch(() => false))) faltan.push(u);
  let hechos = 0, fallidos = 0, siguiente = 0;
  alAvanzar(0, faltan.length);
  const trabajador = async () => {
    while (siguiente < faltan.length) {
      const u = faltan[siguiente++];
      try { await almacen.bajar(u); } catch { fallidos++; }
      alAvanzar(++hechos, faltan.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(simultaneos, faltan.length) }, trabajador));
  return { fallidos };
}

/**
 * Los GIF en el mismo caché que usa el service worker. Se piden con `cors`, como él (ver
 * `medioGuardado` en `public/sw.js`): así la respuesta se guarda con su tamaño real.
 *
 * `cache: "reload"`: el caché HTTP del navegador puede tener el GIF de antes de que el bucket
 * tuviera CORS (2026-10-20), sin `Access-Control-Allow-Origin` ni `Vary: Origin` y vigente 30
 * días. Pedido con CORS, el navegador contestaba con esa copia y lo bloqueaba: así fallaron 115
 * de 121 en el teléfono del entrenador. "reload" lo baja de la red y deja la copia buena.
 */
export function almacenDelNavegador(): AlmacenMedios {
  return {
    async tiene(url) {
      return (await (await caches.open(CACHE_MEDIOS)).match(url)) !== undefined;
    },
    async bajar(url) {
      const respuesta = await fetch(url, { mode: "cors", credentials: "omit", cache: "reload" });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      await (await caches.open(CACHE_MEDIOS)).put(url, respuesta);
    },
  };
}

