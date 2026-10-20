import { describe, expect, it } from "vitest";
import { errorSinDatos, esWifi, guardarFaltantes, modoSinDatos, sugerirApagar } from "./sinDatos";
import { rechazoDefinitivo } from "./cola";

describe("modo sin datos", () => {
  it("sin nada guardado arranca apagado", () => {
    expect(modoSinDatos()).toBe(false);
  });

  it("el error de las llamadas no es un rechazo definitivo: el entrenamiento se queda en la cola", () => {
    expect(rechazoDefinitivo(errorSinDatos())).toBe(false);
    expect(errorSinDatos().code).toBe("functions/unavailable");
  });

  it("Wi-Fi y cable cuentan como Wi-Fi; datos móviles o sin dato, no", () => {
    expect(esWifi("wifi")).toBe(true);
    expect(esWifi("ethernet")).toBe(true);
    expect(esWifi("cellular")).toBe(false);
    expect(esWifi(undefined)).toBe(false);
  });

  it("sugiere apagarlo solo con el modo puesto, en Wi-Fi y sin haber dicho que no", () => {
    expect(sugerirApagar(true, "wifi", false)).toBe(true);
    expect(sugerirApagar(false, "wifi", false)).toBe(false);
    expect(sugerirApagar(true, "cellular", false)).toBe(false);
    expect(sugerirApagar(true, "wifi", true)).toBe(false);
    // iPhone: el navegador no dice el tipo de conexión.
    expect(sugerirApagar(true, undefined, false)).toBe(false);
  });
});

describe("guardarFaltantes", () => {
  it("baja solo los que faltan, sin repetir, y avisa el avance", async () => {
    const guardados = new Set(["a"]);
    const bajados: string[] = [];
    const avance: string[] = [];
    const r = await guardarFaltantes(["a", "b", "c", "b"], {
      tiene: async (u) => guardados.has(u),
      bajar: async (u) => { bajados.push(u); guardados.add(u); },
    }, (h, t) => avance.push(`${h}/${t}`), 1);
    expect(bajados).toEqual(["b", "c"]);
    expect(avance).toEqual(["0/2", "1/2", "2/2"]);
    expect(r.fallidos).toBe(0);
  });

  it("uno que falla no detiene a los demás", async () => {
    const r = await guardarFaltantes(["a", "b", "c"], {
      tiene: async () => false,
      bajar: async (u) => { if (u === "b") throw new Error("sin red"); },
    }, () => {});
    expect(r.fallidos).toBe(1);
  });
});

