import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calificarEsfuerzo, esfuerzosPendientes, reenviarEsfuerzos } from "./esfuerzo";

describe("esfuerzo: se apunta en el teléfono hasta que el servidor contesta", () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("con internet se manda y ya no queda pendiente", async () => {
    const enviar = vi.fn().mockResolvedValue({ ok: true });
    await calificarEsfuerzo("sesion0001", 8, enviar);
    expect(enviar).toHaveBeenCalledWith({ sesionId: "sesion0001", esfuerzo: 8 });
    expect(esfuerzosPendientes()).toEqual({});
  });

  it("sin internet se queda y se manda al reintentar", async () => {
    await calificarEsfuerzo("sesion0001", 6, vi.fn().mockRejectedValue(new Error("sin red")));
    expect(esfuerzosPendientes()).toEqual({ sesion0001: 6 });
    const enviar = vi.fn().mockResolvedValue({ ok: true });
    await reenviarEsfuerzos(enviar);
    expect(enviar).toHaveBeenCalledWith({ sesionId: "sesion0001", esfuerzo: 6 });
    expect(esfuerzosPendientes()).toEqual({});
  });

  it("si cambia de número antes de que conteste, se manda el último", async () => {
    let soltar: () => void = () => {};
    const lento = vi.fn(() => new Promise<void>((r) => { soltar = r; }));
    const primero = calificarEsfuerzo("sesion0001", 5, lento);
    await calificarEsfuerzo("sesion0001", 9, vi.fn().mockRejectedValue(new Error("x")));
    soltar();
    await primero;
    expect(esfuerzosPendientes()).toEqual({ sesion0001: 9 });
  });
});
