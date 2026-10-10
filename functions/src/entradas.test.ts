import { describe, expect, it } from "vitest";
import { MAXIMO_ENTRADAS, conNuevaEntrada, plataformaValida } from "./entradas";

describe("plataformaValida", () => {
  it("deja pasar iPhone y Android", () => {
    expect(plataformaValida("ios")).toBe("ios");
    expect(plataformaValida("android")).toBe("android");
  });

  it("todo lo demás es 'otro'", () => {
    expect(plataformaValida("windows")).toBe("otro");
    expect(plataformaValida(undefined)).toBe("otro");
    expect(plataformaValida(42)).toBe("otro");
  });
});

describe("conNuevaEntrada", () => {
  const e = (n: number) => ({ cuando: n, plataforma: "ios" as const });

  it("en una lista vacía queda sola", () => {
    expect(conNuevaEntrada([], e(1))).toEqual([e(1)]);
  });

  it("la nueva va primero", () => {
    expect(conNuevaEntrada([e(2), e(1)], e(3))).toEqual([e(3), e(2), e(1)]);
  });

  it(`con ${MAXIMO_ENTRADAS} se descarta la más vieja`, () => {
    const llena = [e(5), e(4), e(3), e(2), e(1)];
    expect(conNuevaEntrada(llena, e(6))).toEqual([e(6), e(5), e(4), e(3), e(2)]);
  });

  it("un dato que no es lista (viejo o roto) se trata como vacío", () => {
    expect(conNuevaEntrada(undefined, e(1))).toEqual([e(1)]);
    expect(conNuevaEntrada("basura", e(1))).toEqual([e(1)]);
  });
});
