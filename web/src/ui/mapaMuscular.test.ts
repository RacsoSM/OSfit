import { beforeEach, describe, expect, it } from "vitest";
import {
  archivosMapa, ayudaMapa, bloqueRangoGeneral, conNiveles, detalleMusculo, prepararSvg, reiniciarMapa,
  tarjetaMusculos,
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
    expect(h).toContain(">Ascenso</strong>");
    expect(h).toContain("Te faltan <strong>7.5 kg</strong> en <strong>Press de banca</strong> para llegar al siguiente rango.");
    expect(h).toContain("Tu mejor serie: 30 kg × 8.");
  });

  it("el ajuste por edad no se menciona en la página (decisión del entrenador, 2026-10-14)", () => {
    const origen = {
      ejercicioId: "press-banca", nombre: "Press de banca", tipo: "peso" as const, cuanto: 1,
      serie: { reps: 8, peso: 30 }, estandares: [0.5, 0.625, 0.75, 0.875, 1, 1.137, 1.275, 1.7],
      pesoPorMancuerna: false,
    };
    expect(detalleMusculo("pecho", { nivel: 1.2, origen: { ...origen, edad: 52, factorEdad: 1.162 } }, "H", 75))
      .not.toMatch(/edad|años/);
    expect(detalleMusculo("pecho", { nivel: 1.2, origen: { ...origen, edad: 30, factorEdad: 1 } }, "H", 75))
      .not.toMatch(/edad|años/);
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

  it("debajo de Ascenso es Principiante, aunque sea poco", () => {
    expect(conNiveles(svg, { biceps: { nivel: 0.4 } })).toContain('data-musculo="biceps" data-rango="0"');
  });

  it("Élite es el último", () => {
    expect(conNiveles(svg, { pecho: { nivel: 8 } })).toContain('data-rango="7"');
  });

  // Brillo de Élite (entrenador, 2026-10-19): halo, destello y chispas leves; no hay nivel más alto.
  describe("brillo de Élite", () => {
    const mapa = `<svg id="mapa-frente" viewBox="0 0 420 800"><g id="mapa-frente-musculos">`
      // Como en el SVG real: el id va antes de la clase.
      + '<path id="mapa-frente-musculo-pecho" class="musculo" data-musculo="pecho" d="M100,200 C120,210 140,220 160,260 Z"/>'
      + '<path class="musculo" data-musculo="biceps" d="M1"/>'
      + '<path class="musculo" data-musculo="hombro" d="M2"/></g><g id="mapa-frente-lineas"></g></svg>';
    const conPecho = (fuerza: Record<string, { nivel: number }>) => conNiveles(mapa, fuerza as never);

    it("el músculo en Élite lleva el halo, y las definiciones van una sola vez", () => {
      const h = conPecho({ pecho: { nivel: 8 }, biceps: { nivel: 8.4 }, hombro: { nivel: 5 } });
      expect(h).toMatch(/data-musculo="pecho" data-rango="7" filter="url\(#mapa-frente-elite-halo\)"/);
      expect(h).toMatch(/data-musculo="biceps" data-rango="7" filter="url\(#mapa-frente-elite-halo\)"/);
      expect(h).not.toMatch(/data-musculo="hombro"[^>]*filter=/);
      expect(h.match(/<defs>/g)).toHaveLength(1);
      expect(h).toContain('<svg id="mapa-frente" viewBox="0 0 420 800"><defs><filter id="mapa-frente-elite-halo"');
    });

    it("cada músculo en Élite va seguido de su destello, con su misma silueta", () => {
      const h = conPecho({ pecho: { nivel: 8 } });
      expect(h).toContain('filter="url(#mapa-frente-elite-halo)" d="M100,200 C120,210 140,220 160,260 Z"/>'
        + '<path class="destello-elite" d="M100,200 C120,210 140,220 160,260 Z" fill="url(#mapa-frente-elite-destello)"');
      expect(h).toContain('<linearGradient id="mapa-frente-elite-destello"');
    });

    it("dos chispas por músculo en Élite, dentro de su caja, encima de las líneas", () => {
      const h = conPecho({ pecho: { nivel: 8 } });
      const chispas = [...h.matchAll(/<path d="M0 -10[^"]*" fill="#fffbe6" transform="translate\(([\d.]+) ([\d.]+)\)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
      expect(chispas).toHaveLength(2);
      for (const [x, y] of chispas) {
        expect(x).toBeGreaterThanOrEqual(100); expect(x).toBeLessThanOrEqual(160);
        expect(y).toBeGreaterThanOrEqual(200); expect(y).toBeLessThanOrEqual(260);
      }
      expect(h.indexOf('class="chispas-elite"')).toBeGreaterThan(h.indexOf('id="mapa-frente-lineas"'));
    });

    it("los músculos en Élite pasan al final de su grupo, para que el halo quede encima", () => {
      const h = conPecho({ pecho: { nivel: 8 }, hombro: { nivel: 5 } });
      const orden = [...h.matchAll(/data-musculo="(\w+)"/g)].map((m) => m[1]);
      expect(orden).toEqual(["biceps", "hombro", "pecho"]);
      expect(h.indexOf('data-musculo="pecho"')).toBeLessThan(h.indexOf('id="mapa-frente-lineas"'));
    });

    it("sin Élite no cambia nada más que los rangos", () => {
      const h = conPecho({ pecho: { nivel: 7.9 } });
      expect(h).not.toContain("<defs>");
      expect(h).not.toContain("elite");
    });
  });
});

describe("ayudaMapa", () => {
  it("lista los 8 rangos en orden, del más bajo al más alto, cada uno con su color", () => {
    const h = ayudaMapa("H");
    const nombres = [...h.matchAll(/ayuda-rango-nombre">\d\. ([^<]+)</g)].map((m) => m[1]);
    expect(nombres).toEqual([
      "Principiante", "Ascenso", "En forma", "Intermedio", "Atlético", "Fuerte", "Avanzado", "Élite",
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


describe("bloqueRangoGeneral", () => {
  it("su rango general con insignia y en cuántos músculos se basa", () => {
    const h = bloqueRangoGeneral({ pecho: { nivel: 3 }, biceps: { nivel: 5 }, cuadriceps: { nivel: 7 } }, "M");
    expect(h).toContain("Tu rango general");
    expect(h).toContain('class="rango-general-nombre">Atlética<');
    expect(h).toContain("Promedio de tus 3 músculos con rango");
    expect(h).toContain("insignia-rango");
  });

  it("con un solo músculo lo dice en singular", () => {
    expect(bloqueRangoGeneral({ pecho: { nivel: 3 } }, "H")).toContain("Promedio de tu músculo con rango");
  });

  it("sin músculos con rango no pinta nada", () => {
    expect(bloqueRangoGeneral({}, "M")).toBe("");
  });

  it("va arriba del mapa, y el mapa sabe que lo tiene", () => {
    const h = tarjetaMusculos("H", {}, { pecho: { nivel: 3 } });
    expect(h).toContain("con-general");
    expect(h.indexOf("rango-general")).toBeLessThan(h.indexOf("mapa-escena"));
    expect(tarjetaMusculos("H", {}, {})).not.toContain("rango-general");
  });
});

describe("botón de Amigos", () => {
  it("va en el dibujo como ícono, junto al de girar", () => {
    const html = tarjetaMusculos("M", { "/mapa-muscular-frente-mujer.svg": { estado: "listo", svg: frenteM } });
    expect(html).toMatch(/class="mapa-comparar" id="abrir-comparar"[\s\S]*?<svg class="mapa-icono"/);
    expect(html).toContain('id="girar-mapa"');
  });
  it("los dos íconos van en la fila de abajo, con el peso en medio", () => {
    const html = tarjetaMusculos("M", {}, {}, 60, '<p class="peso-linea">PESO</p>');
    expect(html).toMatch(/class="mapa-pie"[\s\S]*?id="abrir-comparar"[\s\S]*?PESO[\s\S]*?id="girar-mapa"/);
  });
  it("sin acceso a Amigos no hay botón, pero su hueco sigue para centrar el peso", () => {
    const html = tarjetaMusculos("M", {}, {}, 60, '<p class="peso-linea">PESO</p>', false);
    expect(html).not.toContain('id="abrir-comparar"');
    expect(html).toMatch(/class="mapa-comparar mapa-hueco" aria-hidden="true"[\s\S]*?PESO/);
  });
});
