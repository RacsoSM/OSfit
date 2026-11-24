import { afterEach, describe, expect, it, vi } from "vitest";
import { alternarSonido, sonar, sonidoActivo, sonidosDeLaEscena } from "./sonidos";
import { ESCENA } from "./resumenMensual";

describe("preferencia de sonido", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("está encendido de entrada y la bocina lo apaga y lo recuerda", () => {
    const guardado = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
    });
    expect(sonidoActivo()).toBe(true);
    expect(alternarSonido()).toBe(false);
    expect(guardado.get("osfit:sonido")).toBe("no");
    expect(sonidoActivo()).toBe(false);
    expect(alternarSonido()).toBe(true);
    expect(sonidoActivo()).toBe(true);
  });

  it("sin audio del navegador no hace nada ni falla", () => {
    expect(() => sonar("remate")).not.toThrow();
  });
});

describe("sonidosDeLaEscena", () => {
  it("cada tarjeta: el reflector, el volteo y, si tiene número, la cuenta; al final el remate", () => {
    const s = sonidosDeLaEscena([false, true], 0, ESCENA);
    expect(s.map((x) => x.sonido)).toEqual(["foco", "voltear", "foco", "voltear", "contar", "remate"]);
    expect(s[0]!.en).toBeCloseTo(ESCENA.intro - ESCENA.apuntar);
    expect(s[4]!.en).toBeCloseTo(ESCENA.intro + ESCENA.paso + ESCENA.voltear);
    expect(s.at(-1)!.en).toBeCloseTo(ESCENA.remate);
  });

  it("retomada a media función no repite los que ya sonaron", () => {
    const s = sonidosDeLaEscena([true, true, true], ESCENA.intro + ESCENA.paso + 0.1, ESCENA);
    expect(s.every((x) => x.en > 0)).toBe(true);
    expect(s[0]!.sonido).toBe("contar");
    expect(sonidosDeLaEscena([true], ESCENA.total, ESCENA)).toEqual([]);
  });
});
