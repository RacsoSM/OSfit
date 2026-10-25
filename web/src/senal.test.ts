import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conPlazo, esperarRed, hayRed } from "./senal";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const nunca = () => new Promise<never>(() => {});

describe("conPlazo", () => {
  it("deja pasar lo que llega a tiempo", async () => {
    await expect(conPlazo(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  // Con señal dudosa el pedido no falla nunca: se queda colgado. El plazo lo vuelve un fallo
  // de red, que es lo que el arranque ya sabe manejar.
  it("lo que se queda colgado falla como red", async () => {
    const espera = conPlazo(nunca(), 1000);
    vi.advanceTimersByTime(1000);
    await expect(espera).rejects.toMatchObject({ code: "auth/network-request-failed" });
  });
});

describe("hayRed", () => {
  it("con respuesta hay red", async () => {
    await expect(hayRed(() => Promise.resolve(null))).resolves.toBe(true);
  });

  it("sin respuesta a tiempo no hay", async () => {
    const r = hayRed(nunca, 3000);
    vi.advanceTimersByTime(3000);
    await expect(r).resolves.toBe(false);
  });

  it("si el pedido falla no hay", async () => {
    await expect(hayRed(() => Promise.reject(new Error("x")))).resolves.toBe(false);
  });
});

describe("esperarRed", () => {
  function entorno() {
    let tic: (() => void) | null = null;
    let volver: (() => void) | null = null;
    const parada = vi.fn();
    return {
      parada,
      tic: () => tic?.(),
      volver: () => volver?.(),
      e: {
        cada: (f: () => void) => { tic = f; return parada; },
        alVolver: (f: () => void) => { volver = f; },
      },
    };
  }

  it("avisa una sola vez, cuando vuelve la red, y deja de probar", async () => {
    let red = false;
    const alHaber = vi.fn();
    const x = entorno();
    esperarRed(async () => red, alHaber, x.e);
    x.tic();
    await Promise.resolve();
    expect(alHaber).not.toHaveBeenCalled();
    red = true;
    x.tic();
    await Promise.resolve();
    await Promise.resolve();
    x.volver();
    await Promise.resolve();
    await Promise.resolve();
    expect(alHaber).toHaveBeenCalledTimes(1);
    expect(x.parada).toHaveBeenCalled();
  });
});
