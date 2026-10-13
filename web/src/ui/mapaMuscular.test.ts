import { beforeEach, describe, expect, it } from "vitest";
import {
  archivosMapa, ayudaMapa, conNiveles, detalleMusculo, prepararSvg, reiniciarMapa, tarjetaMusculos,
} from "./mapaMuscular";
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

  it("cada línea interna dice de qué músculo es, en los cuatro mapas", () => {
    for (const [archivo, texto] of Object.entries(SVGS)) {
      const listo2 = prepararSvg(texto, "m");
      const grupos = new Set([...listo2.matchAll(/data-musculo="([^"]+)"/g)].map((m) => m[1]));
      for (const l of listo2.matchAll(/<path class="linea"([^>]*)>/g)) {
        const de = l[1].match(/data-de="([^"]+)"/)?.[1];
        const recorte = l[1].match(/url\(#m-recorte-([^)]+)\)/)?.[1];
        if (recorte?.startsWith("gris")) {
          expect(de, `${archivo}: ${recorte}`).toBeUndefined();
        } else {
          expect(de && grupos.has(de), `${archivo}: ${de}`).toBe(true);
          if (recorte) expect(de).toBe(recorte);
        }
      }
    }
  });

  it("los tramos sueltos sin recorte son del cuádriceps", () => {
    expect(listo).toMatch(/<path class="linea" data-de="cuadriceps" d=/);
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
  beforeEach(reiniciarMapa);

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
    expect(h).toContain('aria-label="Ver espalda"');
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

describe("detalleMusculo", () => {
  it("sin músculo tocado, la leyenda invita a tocar", () => {
    const h = detalleMusculo(null, undefined, "M");
    expect(h).toContain("Toca un músculo");
    expect(h).not.toContain("mapa-detalle\"");
  });

  it("sin datos, dice el músculo y cómo conseguir su rango", () => {
    const h = detalleMusculo("pecho", undefined, "M");
    expect(h).toContain("Pecho");
    expect(h).toContain("Sin datos");
    expect(h).toContain("Registra ejercicios de pecho");
    expect(h).toContain("comparada");
    expect(h).not.toContain("hoja-grafica");
  });

  it("a él se le habla en masculino", () => {
    expect(detalleMusculo("pecho", undefined, "H")).toContain("comparado");
  });

  it("con datos: su rango con insignia, contra quienes entrenan por omisión", () => {
    const h = detalleMusculo("cuadriceps", { nivel: 5.5 }, "M");
    expect(h).toContain("Cuádriceps");
    expect(h).toContain('class="hoja-rango">Atlética<');
    expect(h).toContain("insignia-rango");
    expect(h).toContain("que entrenan en el mundo, el <strong>8&nbsp;%</strong> está en este rango");
    expect(h).toContain("más fuerte que el <strong>61&nbsp;%</strong> de ellas");
    expect(h).toContain("Contra toda la población (también quien no entrena), eres más fuerte que el 89&nbsp;%");
    expect(h).toContain('data-comparar="entrenan" aria-pressed="true"');
  });

  it("la gráfica trae los 8 rangos y marca el suyo", () => {
    const h = detalleMusculo("cuadriceps", { nivel: 5.5 }, "M");
    expect(h.match(/class="h-col/g)).toHaveLength(8);
    expect(h.match(/class="h-col yo"/g)).toHaveLength(1);
    expect(h).toContain("TÚ");
  });

  it("el rango va en masculino para ellos", () => {
    expect(detalleMusculo("pecho", { nivel: 5.5 }, "H")).toContain("Atlético");
  });

  it("con su peso, dice qué le falta para el siguiente rango", () => {
    const f = {
      nivel: 1.05,
      origen: {
        ejercicioId: "press-banca", nombre: "Press de banca", tipo: "peso" as const, cuanto: 1,
        serie: { reps: 8, peso: 30 }, estandares: [0.5, 0.625, 0.75, 0.875, 1, 1.137, 1.275, 1.7],
        pesoPorMancuerna: false,
      },
    };
    const h = detalleMusculo("pecho", f, "H", 75);
    expect(h).toContain("Siguiente: <strong");
    expect(h).toContain(">Novato</strong>");
    expect(h).toContain("Te faltan <strong>7.5 kg</strong> en <strong>Press de banca</strong> para llegar al siguiente rango.");
    expect(h).toContain("Tu mejor serie: 30 kg × 8.");
  });

  it("en los corporales cuenta repeticiones, y en singular si falta una", () => {
    const f = {
      nivel: 4.4,
      origen: {
        ejercicioId: "lagartijas", nombre: "Lagartijas", tipo: "corporal" as const, cuanto: 1,
        serie: { reps: 14, peso: null }, estandares: [1, 3, 5, 10, 15, 18, 20, 34], pesoPorMancuerna: false,
      },
    };
    expect(detalleMusculo("pecho", f, "M", 60)).toContain("Te falta <strong>1 repetición</strong> en <strong>Lagartijas</strong>");
  });

  it("en mancuernas dice que es por mancuerna", () => {
    const f = {
      nivel: 1.05,
      origen: {
        ejercicioId: "press-mancuernas", nombre: "Press con mancuernas", tipo: "peso" as const, cuanto: 1,
        serie: { reps: 8, peso: 12 }, estandares: [0.19, 0.24, 0.29, 0.33, 0.38, 0.43, 0.48, 0.65],
        pesoPorMancuerna: true,
      },
    };
    expect(detalleMusculo("pecho", f, "H", 75)).toMatch(/Te faltan <strong>[\d.]+ kg por mancuerna<\/strong>/);
  });

  it("sin su peso no promete kilos", () => {
    expect(detalleMusculo("pecho", { nivel: 1.05 }, "H")).not.toContain("para llegar al siguiente rango");
  });
});

describe("conNiveles", () => {
  const svg = '<path class="musculo" data-musculo="pecho" d="M0"/><path class="musculo" data-musculo="biceps" d="M1"/>';

  it("le pone a cada músculo con datos el número de su rango", () => {
    // 3.7 está entre En forma (3) e Intermedio (4): En forma, el tercero (2).
    expect(conNiveles(svg, { pecho: { nivel: 3.7 } })).toContain('data-musculo="pecho" data-rango="2"');
  });

  it("sin datos se queda sin rango (gris)", () => {
    expect(conNiveles(svg, { pecho: { nivel: 3 } })).toContain('data-musculo="biceps" d="M1"');
  });

  it("debajo de Novato es Principiante, aunque sea poco", () => {
    expect(conNiveles(svg, { biceps: { nivel: 0.4 } })).toContain('data-musculo="biceps" data-rango="0"');
  });

  it("Élite es el último", () => {
    expect(conNiveles(svg, { pecho: { nivel: 8 } })).toContain('data-rango="7"');
  });
});

describe("ayudaMapa", () => {
  it("lista los 8 rangos en orden, del más bajo al más alto, cada uno con su color", () => {
    const h = ayudaMapa("H");
    const nombres = [...h.matchAll(/ayuda-rango-nombre">\d\. ([^<]+)</g)].map((m) => m[1]);
    expect(nombres).toEqual([
      "Principiante", "Novato", "En forma", "Intermedio", "Atlético", "Fuerte", "Avanzado", "Élite",
    ]);
    for (let i = 0; i < 8; i++) expect(h).toContain(`data-rango="${i}"`);
  });

  it("para ellas dice Atlética", () => {
    expect(ayudaMapa("M")).toContain("5. Atlética");
  });

  it("explica el gris y a quién supera cada rango", () => {
    const h = ayudaMapa("M");
    expect(h).toContain("sin datos");
    expect(h).toContain("88 % · 57 %");
    expect(h).toContain('id="cerrar-ayuda"');
  });
});

describe("tarjetaMusculos y la ayuda", () => {
  it("trae el ? y ya no la barra de degradado", () => {
    const h = tarjetaMusculos("H", {});
    expect(h).toContain('id="abrir-ayuda"');
    expect(h).not.toContain("mapa-escala");
    expect(h).not.toContain("ayuda-velo");
  });
});

