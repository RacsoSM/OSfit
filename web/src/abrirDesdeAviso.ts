/**
 * Qué abrir cuando la clienta toca una notificación que lo dice (`abrir` del aviso, hoy solo el
 * de `cerrarMes`: Resumen mensual en el mes que cerró). Llega por dos caminos:
 *
 * - con la página cerrada, `sw.js` la abre en `/?abrir=<ventana>&mes=<AAAA-MM>`;
 * - con la página abierta, `sw.js` le manda un `postMessage({ tipo: "abrir", abrir })`.
 *
 * La ventana sigue sin vivir en la dirección (ver `navegacion.ts`): el parámetro solo dice qué
 * abrir al entrar, y `main.ts` lo borra en cuanto lo usa. `resolverSesion` no lo ve: lee la ruta
 * y el `#`, nunca el `?`.
 *
 * Todo se valida contra las ventanas que existen: un aviso viejo o un dato raro no abre nada.
 */

export interface Abrir {
  ventana: string;
  mes: string | null;
}

const ES_MES = /^\d{4}-\d{2}$/;

function validar(ventana: unknown, mes: unknown, ventanas: readonly string[]): Abrir | null {
  if (typeof ventana !== "string" || !ventanas.includes(ventana)) return null;
  return { ventana, mes: typeof mes === "string" && ES_MES.test(mes) ? mes : null };
}

/** De la dirección con la que se abrió la página (`location.search`). */
export function abrirDeLaDireccion(search: string, ventanas: readonly string[]): Abrir | null {
  const p = new URLSearchParams(search);
  return p.has("abrir") ? validar(p.get("abrir"), p.get("mes"), ventanas) : null;
}

/** Del mensaje del service worker. */
export function abrirDelMensaje(data: unknown, ventanas: readonly string[]): Abrir | null {
  const m = data as { tipo?: unknown; abrir?: { ventana?: unknown; mes?: unknown } } | null;
  if (!m || m.tipo !== "abrir" || !m.abrir) return null;
  return validar(m.abrir.ventana, m.abrir.mes, ventanas);
}

/** La dirección sin `abrir` ni `mes`, para dejarla como estaba después de usarlos. */
export function direccionSinAbrir(pathname: string, search: string, hash: string): string {
  const p = new URLSearchParams(search);
  p.delete("abrir");
  p.delete("mes");
  const resto = p.toString();
  return `${pathname}${resto ? `?${resto}` : ""}${hash}`;
}
