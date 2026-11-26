import { describe, expect, it, vi } from "vitest";
import { alCargar, cargando, perezoso } from "./perezoso";

describe("perezoso", () => {
  it("la primera vez da null y lo pide; al llegar repinta y ya lo da", async () => {
    const repintar = vi.fn();
    alCargar(repintar);
    const cargar = vi.fn(() => Promise.resolve({ hola: 1 }));
    const parte = perezoso(cargar);
    expect(parte.ya()).toBeNull();
    expect(parte.ya()).toBeNull();
    await parte.pedir();
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(repintar).toHaveBeenCalledTimes(1);
    expect(parte.ya()).toEqual({ hola: 1 });
  });

  it("listo() no lo pide", () => {
    const cargar = vi.fn(() => Promise.resolve(1));
    const parte = perezoso(cargar);
    expect(parte.listo()).toBeNull();
    expect(cargar).not.toHaveBeenCalled();
  });

  it("si falla (sin señal y sin copia), se puede volver a pedir", async () => {
    alCargar(() => {});
    let intento = 0;
    const parte = perezoso(() => (++intento === 1 ? Promise.reject(new Error("red")) : Promise.resolve("ok")));
    await expect(parte.pedir()).rejects.toThrow("red");
    expect(parte.listo()).toBeNull();
    await expect(parte.pedir()).resolves.toBe("ok");
    expect(parte.listo()).toBe("ok");
  });

  it("mientras llega, la ventana dice que está cargando", () => {
    expect(cargando()).toContain("Cargando");
  });
});
