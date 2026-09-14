import { describe, expect, it } from "vitest";
import type { PaletaWeb } from "./paleta";
import { aplicarPaleta } from "./paleta";

/** Un doble de HTMLElement que sólo sabe lo que `aplicarPaleta` usa. */
function raizFalsa() {
  const escritas: Record<string, string> = {};
  const raiz = {
    style: {
      setProperty(nombre: string, valor: string) {
        escritas[nombre] = valor;
      },
    },
  } as unknown as HTMLElement;
  return { raiz, escritas };
}

const OCEANO: PaletaWeb = {
  id: "oceano",
  primario: "#6BB6FF",
  primarioOscuro: "#123A75",
  primarioClaro: "#D2E8FF",
  sobrePrimario: "#04162B",
};

describe("aplicarPaleta", () => {
  it("vuelca los cuatro colores como variables CSS", () => {
    const { raiz, escritas } = raizFalsa();
    aplicarPaleta(OCEANO, raiz);
    expect(escritas).toEqual({
      "--primario": "#6BB6FF",
      "--primario-oscuro": "#123A75",
      "--primario-claro": "#D2E8FF",
      "--sobre-primario": "#04162B",
    });
  });

  /** Una clienta sin paleta asignada: se quedan los valores de :root, que son el morado. */
  it("sin paleta no escribe nada", () => {
    const { raiz, escritas } = raizFalsa();
    aplicarPaleta(undefined, raiz);
    aplicarPaleta(null, raiz);
    expect(escritas).toEqual({});
  });

  /** Un campo corrupto degrada a morado en ese color y sólo en ese: la página es lo único
   *  que la clienta tiene, y no puede quedarse en blanco por un hex mal escrito. */
  it("descarta el color invalido y aplica los demas", () => {
    const { raiz, escritas } = raizFalsa();
    aplicarPaleta({ ...OCEANO, primario: "rojo" }, raiz);
    expect(escritas["--primario"]).toBeUndefined();
    expect(escritas["--primario-oscuro"]).toBe("#123A75");
    expect(escritas["--primario-claro"]).toBe("#D2E8FF");
    expect(escritas["--sobre-primario"]).toBe("#04162B");
  });

  it("descarta un campo ausente o de otro tipo", () => {
    const { raiz, escritas } = raizFalsa();
    aplicarPaleta({ id: "roto", primario: "#6BB6FF" } as unknown as PaletaWeb, raiz);
    expect(escritas).toEqual({ "--primario": "#6BB6FF" });
  });

  it("acepta hex en minusculas", () => {
    const { raiz, escritas } = raizFalsa();
    aplicarPaleta({ ...OCEANO, primario: "#6bb6ff" }, raiz);
    expect(escritas["--primario"]).toBe("#6bb6ff");
  });
});
