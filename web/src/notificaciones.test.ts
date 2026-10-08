import { describe, expect, it } from "vitest";
import {
  estadoNotificaciones,
  plataforma,
  versionIos,
  type EntornoNotificaciones,
} from "./notificaciones";

const IPHONE_17 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_16_3 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

const entorno = (campos: Partial<EntornoNotificaciones> = {}): EntornoNotificaciones => ({
  ua: IPHONE_17, instalada: false, tienePush: false, permiso: "sin-api", tokenEnRuta: true, ...campos,
});

describe("estadoNotificaciones", () => {
  it("sin la llave del entrenador no se ofrece nada, en ningun telefono", () => {
    expect(estadoNotificaciones(false, entorno())).toBe("no-habilitada");
    expect(estadoNotificaciones(false, entorno({ ua: ANDROID, tienePush: true, permiso: "default" })))
      .toBe("no-habilitada");
  });

  // Review Focus: en Safari (o dentro de WhatsApp) sin instalar, nunca el boton de permiso.
  it("iPhone sin instalar: pasos para instalar", () => {
    expect(estadoNotificaciones(true, entorno())).toBe("instalar");
  });

  // Review Focus: desde /mi no hay token que la pagina instalada pueda usar para entrar.
  it("iPhone sin instalar y sin token en la ruta: primero abrir su link", () => {
    expect(estadoNotificaciones(true, entorno({ tokenEnRuta: false }))).toBe("instalar-desde-link");
  });

  it("iPhone con iOS anterior a 16.4: no soportado", () => {
    expect(estadoNotificaciones(true, entorno({ ua: IPHONE_16_3 }))).toBe("no-soportado");
  });

  it("iPhone instalado: pedir permiso, activadas o bloqueadas segun el permiso", () => {
    const instalada = { instalada: true, tienePush: true };
    expect(estadoNotificaciones(true, entorno({ ...instalada, permiso: "default" }))).toBe("pedir-permiso");
    expect(estadoNotificaciones(true, entorno({ ...instalada, permiso: "granted" }))).toBe("activadas");
    expect(estadoNotificaciones(true, entorno({ ...instalada, permiso: "denied" }))).toBe("bloqueadas");
  });

  it("iPhone instalado pero sin Push API: no soportado", () => {
    expect(estadoNotificaciones(true, entorno({ instalada: true, tienePush: false }))).toBe("no-soportado");
  });

  it("Android no necesita instalar", () => {
    expect(estadoNotificaciones(true, entorno({ ua: ANDROID, tienePush: true, permiso: "default" })))
      .toBe("pedir-permiso");
  });
});

describe("versionIos y plataforma", () => {
  it("lee la version de iOS del user agent", () => {
    expect(versionIos(IPHONE_17)).toEqual([17, 5]);
    expect(versionIos(IPHONE_16_3)).toEqual([16, 3]);
    expect(versionIos(ANDROID)).toBeNull();
  });

  it("clasifica la plataforma", () => {
    expect(plataforma(IPHONE_17)).toBe("ios");
    expect(plataforma(ANDROID)).toBe("android");
    expect(plataforma("Mozilla/5.0 (Windows NT 10.0)")).toBe("otro");
  });
});
