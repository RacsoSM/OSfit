import { describe, expect, it } from "vitest";
import type { EntornoSesion, MemoriaToken, ResultadoSesion } from "./sesion";
import {
  LLAVE_TOKEN,
  lecturaDelStatus,
  memoriaToken,
  resolverSesion,
  tokenEnLaUrl,
} from "./sesion";

/** Un `Storage` de mentiras, con la opción de tirar como tira el modo privado. */
function almacen(opciones: { tira?: boolean } = {}): Storage {
  const datos = new Map<string, string>();
  const revisar = (): void => {
    if (opciones.tira) throw new DOMException("bloqueado", "SecurityError");
  };
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    key: (i: number) => [...datos.keys()][i] ?? null,
    getItem: (k: string) => {
      revisar();
      return datos.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      revisar();
      datos.set(k, v);
    },
    removeItem: (k: string) => {
      revisar();
      datos.delete(k);
    },
  };
}

describe("tokenEnLaUrl", () => {
  it("saca el token de la ruta del link mágico", () => {
    expect(tokenEnLaUrl("/c/abc123XYZ")).toBe("abc123XYZ");
  });

  it("no ve token en la ruta a la que se llega después de canjear", () => {
    expect(tokenEnLaUrl("/mi")).toBe(null);
  });

  it("no ve token en la raíz ni en rutas parecidas", () => {
    expect(tokenEnLaUrl("/")).toBe(null);
    expect(tokenEnLaUrl("/c/")).toBe(null);
    expect(tokenEnLaUrl("/c/abc/def")).toBe(null);
    expect(tokenEnLaUrl("/c/abc-def")).toBe(null);
  });
});

describe("lecturaDelStatus", () => {
  it("200 es un canje bueno", () => {
    expect(lecturaDelStatus(200)).toBe("canjeado");
  });

  it("404 es el link revocado o inventado", () => {
    expect(lecturaDelStatus(404)).toBe("sin-acceso");
    expect(lecturaDelStatus(400)).toBe("sin-acceso");
  });

  it("un backend caído o saturado es la red, no el link", () => {
    // Lo importante de estos tres: NO queman el token ni mandan a pedir uno nuevo. Un
    // arranque en frío de Cloud Run no debería costarle un link a la clienta.
    expect(lecturaDelStatus(429)).toBe("sin-conexion");
    expect(lecturaDelStatus(500)).toBe("sin-conexion");
    expect(lecturaDelStatus(503)).toBe("sin-conexion");
  });
});

describe("memoriaToken", () => {
  it("lo que se recuerda se vuelve a encontrar", () => {
    const memoria = memoriaToken([almacen(), almacen()]);
    memoria.recordar("tok1");
    expect(memoria.recordado()).toBe("tok1");
  });

  it("sin nada recordado no inventa un token", () => {
    expect(memoriaToken([almacen()]).recordado()).toBe(null);
  });

  it("escribe en todos los almacenes, para que baste con que uno sobreviva", () => {
    const sesion = almacen();
    const local = almacen();
    memoriaToken([sesion, local]).recordar("tok1");
    expect(sesion.getItem(LLAVE_TOKEN)).toBe("tok1");
    expect(local.getItem(LLAVE_TOKEN)).toBe("tok1");
  });

  it("si un almacén se vació, lo encuentra en el otro", () => {
    const sesion = almacen();
    const local = almacen();
    const memoria = memoriaToken([sesion, local]);
    memoria.recordar("tok1");
    sesion.clear(); // Safari borrando almacenamiento por su cuenta.
    expect(memoria.recordado()).toBe("tok1");
  });

  it("un almacén que tira no tumba al otro", () => {
    const roto = almacen({ tira: true });
    const bueno = almacen();
    const memoria = memoriaToken([roto, bueno]);
    expect(() => memoria.recordar("tok1")).not.toThrow();
    expect(memoria.recordado()).toBe("tok1");
  });

  it("sin ningún almacén sigue funcionando, solo que sin memoria", () => {
    const memoria = memoriaToken([null, null]);
    expect(() => memoria.recordar("tok1")).not.toThrow();
    expect(memoria.recordado()).toBe(null);
    expect(() => memoria.olvidar()).not.toThrow();
  });

  it("olvidar lo borra de todos lados", () => {
    const sesion = almacen();
    const local = almacen();
    const memoria = memoriaToken([sesion, local]);
    memoria.recordar("tok1");
    memoria.olvidar();
    expect(memoria.recordado()).toBe(null);
    expect(sesion.getItem(LLAVE_TOKEN)).toBe(null);
    expect(local.getItem(LLAVE_TOKEN)).toBe(null);
  });

  it("un link nuevo reemplaza al viejo en los dos almacenes", () => {
    const sesion = almacen();
    const local = almacen();
    const memoria = memoriaToken([sesion, local]);
    memoria.recordar("viejo");
    memoria.recordar("nuevo");
    expect(sesion.getItem(LLAVE_TOKEN)).toBe("nuevo");
    expect(local.getItem(LLAVE_TOKEN)).toBe("nuevo");
  });
});

/** Un entorno de mentiras, con la cuenta de canjes y si la URL se limpió. */
function entorno(campos: {
  ruta?: string;
  guardada?: string | null;
  canje?: (token: string) => ResultadoSesion;
  recordado?: string;
}): EntornoSesion & { canjes: string[]; escondio: boolean; memoria: MemoriaToken } {
  const sesion = almacen();
  const local = almacen();
  const memoria = memoriaToken([sesion, local]);
  if (campos.recordado) memoria.recordar(campos.recordado);
  const estado = {
    canjes: [] as string[],
    escondio: false,
    memoria,
    rutaActual: () => campos.ruta ?? "/mi",
    sesionGuardada: async () => campos.guardada ?? null,
    esconderToken: () => {
      estado.escondio = true;
    },
    canjear: async (token: string) => {
      estado.canjes.push(token);
      return campos.canje?.(token) ?? ({ estado: "lista", clienteId: "c1" } as ResultadoSesion);
    },
  };
  return estado;
}

describe("resolverSesion", () => {
  it("con el token en la URL lo canjea, lo recuerda y lo esconde", () => {
    const e = entorno({ ruta: "/c/tok1" });
    return resolverSesion(e).then((r) => {
      expect(r).toEqual({ estado: "lista", clienteId: "c1" });
      expect(e.canjes).toEqual(["tok1"]);
      expect(e.memoria.recordado()).toBe("tok1");
      expect(e.escondio).toBe(true);
    });
  });

  it("un link muerto no se recuerda ni esconde el token", async () => {
    const e = entorno({ ruta: "/c/muerto", canje: () => ({ estado: "sin-acceso" }) });
    expect(await resolverSesion(e)).toEqual({ estado: "sin-acceso" });
    expect(e.memoria.recordado()).toBe(null);
    expect(e.escondio).toBe(false);
  });

  it("con la sesión guardada entra directo, sin molestar al backend", async () => {
    const e = entorno({ ruta: "/mi", guardada: "c1" });
    expect(await resolverSesion(e)).toEqual({ estado: "lista", clienteId: "c1" });
    expect(e.canjes).toEqual([]);
  });

  /**
   * EL BUG. Recargar en Safari borraba la sesión guardada, y como el token ya se había ido
   * de la URL no quedaba nada con qué volver: la clienta veía "este enlace ya no es válido"
   * con un link que seguía vivo. Ahora el token recordado la vuelve a meter sola.
   */
  it("si la sesión guardada se perdió, el token recordado la recupera", async () => {
    const e = entorno({ ruta: "/mi", guardada: null, recordado: "tok1" });
    expect(await resolverSesion(e)).toEqual({ estado: "lista", clienteId: "c1" });
    expect(e.canjes).toEqual(["tok1"]);
  });

  it("sin sesión y sin token recordado sí es un callejón, y se dice", async () => {
    const e = entorno({ ruta: "/mi", guardada: null });
    expect(await resolverSesion(e)).toEqual({ estado: "sin-acceso" });
    expect(e.canjes).toEqual([]);
  });

  it("si al recuperar falla la red, el token recordado NO se quema", async () => {
    // Lo importante: la siguiente recarga con señal tiene que poder recuperarla. Olvidar el
    // token acá la dejaría pidiendo un link nuevo por un bache de señal.
    const e = entorno({ guardada: null, recordado: "tok1", canje: () => ({ estado: "sin-conexion" }) });
    expect(await resolverSesion(e)).toEqual({ estado: "sin-conexion" });
    expect(e.memoria.recordado()).toBe("tok1");
  });

  it("si el entrenador revocó el acceso, el token recordado se olvida", async () => {
    const e = entorno({ guardada: null, recordado: "tok1", canje: () => ({ estado: "sin-acceso" }) });
    expect(await resolverSesion(e)).toEqual({ estado: "sin-acceso" });
    expect(e.memoria.recordado()).toBe(null);
  });

  it("un link nuevo gana sobre el recordado, aunque el viejo siga guardado", async () => {
    const e = entorno({ ruta: "/c/tok2", guardada: "c1", recordado: "tok1" });
    expect(await resolverSesion(e)).toEqual({ estado: "lista", clienteId: "c1" });
    expect(e.canjes).toEqual(["tok2"]);
    expect(e.memoria.recordado()).toBe("tok2");
  });
});
