import { describe, expect, it } from "vitest";
import { archivosMapa, prepararSvg, tarjetaMusculos } from "./mapaMuscular";
import frenteH from "../../public/mapa-muscular-frente.svg?raw";
import espaldaH from "../../public/mapa-muscular-espalda.svg?raw";
import frenteM from "../../public/mapa-muscular-frente-mujer.svg?raw";
import espaldaM from "../../public/mapa-muscular-espalda-mujer.svg?raw";

const SVGS: Record<string, string> = {
  "/mapa-muscular-frente.svg": frenteH,
  "/mapa-muscular-espalda.svg": espaldaH,
  "/mapa-muscular-frente-mujer.svg": frenteM,
  "/mapa-muscular-espalda-mujer.svg": espaldaM,
};
const publico = (archivo: string): string => SVGS[archivo] ?? "";

describe("archivosMapa", () => {
  it("a la mujer le tocan los mapas de mujer", () => {
    expect(archivosMapa("M")).toEqual({
      frente: "/mapa-muscular-frente-mujer.svg", espalda: "/mapa-muscular-espalda-mujer.svg",
    });
  });

  it("al hombre, los de hombre", () => {
    expect(archivosMapa("H")).toEqual({
      frente: "/mapa-muscular-frente.svg", espalda: "/mapa-muscular-espalda.svg",
    });
  });

  it("los cuatro archivos existen", () => {
    for (const s of ["H", "M"] as const) {
      const a = archivosMapa(s);
      expect(publico(a.frente)).toContain("<svg");
      expect(publico(a.espalda)).toContain("<svg");
    }
  });
});

describe("prepararSvg", () => {
  const original = publico("/mapa-muscular-frente.svg");
  const listo = prepararSvg(original, "mapa-frente");

  it("le pone su id y su clase a la raíz", () => {
    expect(listo.startsWith('<svg id="mapa-frente" class="mapa-svg"')).toBe(true);
  });

  it("todos los ids y referencias quedan con el prefijo", () => {
    const ids = [...listo.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) expect(id.startsWith("mapa-frente")).toBe(true);
    const refs = [...listo.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(ids).toContain(r);
  });

  it("los ids de los músculos se pueden seguir buscando", () => {
    expect(listo).toContain('id="mapa-frente-musculo-pecho-der"');
    expect(listo).toContain('data-musculo="pecho"');
  });

  it("no deja los colores de la foto ni reglas globales", () => {
    const css = listo.match(/<style>([\s\S]*?)<\/style>/)![1];
    expect(css).not.toContain("data-musculo");
    for (const regla of css.split("\n")) expect(regla.startsWith("#mapa-frente ")).toBe(true);
  });

  it("sin el rectángulo negro de fondo", () => {
    expect(listo).not.toContain("fondo");
  });

  it("sin declaración XML ni comentarios", () => {
    expect(listo).not.toContain("<?xml");
    expect(listo).not.toContain("<!--");
  });

  it("frente y espalda juntos no repiten ningún id, en hombre y en mujer", () => {
    for (const s of ["H", "M"] as const) {
      const a = archivosMapa(s);
      const juntos = prepararSvg(publico(a.frente), "mapa-frente") +
        prepararSvg(publico(a.espalda), "mapa-espalda");
      const ids = [...juntos.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("tarjetaMusculos", () => {
  const listos = {
    "/mapa-muscular-frente.svg": { estado: "listo", svg: frenteH },
    "/mapa-muscular-espalda.svg": { estado: "listo", svg: espaldaH },
  } as const;

  it("sin tarjeta: el cuerpo va directo en la página", () => {
    expect(tarjetaMusculos("H", listos)).not.toContain('class="tarjeta');
  });

  it("arranca de frente, con la espalda detrás y oculta al lector de pantalla", () => {
    const h = tarjetaMusculos("H", listos);
    expect(h).not.toContain("girado");
    expect(h).toContain('mapa-cara mapa-cara-espalda" aria-hidden="true"');
    expect(h).not.toContain('mapa-cara mapa-cara-frente" aria-hidden');
    expect(h).toContain("Ver espalda");
  });

  it("mientras cargan, muestra el esqueleto", () => {
    expect(tarjetaMusculos("H", {})).toContain("mapa-cargando");
  });

  it("si falla un lado lo dice, sin tumbar el otro", () => {
    const h = tarjetaMusculos("H", {
      "/mapa-muscular-frente.svg": { estado: "error" },
      "/mapa-muscular-espalda.svg": { estado: "listo", svg: espaldaH },
    });
    expect(h).toContain("No se pudo cargar");
    expect(h).toContain('id="mapa-espalda"');
  });

  it("a la mujer no le pinta el mapa del hombre", () => {
    const h = tarjetaMusculos("M", {
      "/mapa-muscular-frente.svg": { estado: "listo", svg: "<svg>hombre</svg>" },
      "/mapa-muscular-frente-mujer.svg": { estado: "listo", svg: "<svg>mujer</svg>" },
    });
    expect(h).toContain("mujer");
    expect(h).not.toContain("hombre");
  });
});
