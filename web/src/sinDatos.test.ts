import { describe, expect, it } from "vitest";
import { errorSinDatos, esWifi, modoSinDatos, sugerirApagar } from "./sinDatos";
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
