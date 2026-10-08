import { describe, expect, it } from "vitest";
import {
  CLAVE_ESTILO, ESTILOS, ESTILO_POR_DEFECTO, FUENTES, ONOMATOPEYAS, aplicarEstilo, estiloGuardado,
  guardarEstilo, onomatopeya, retrasosDeCortina, type AlmacenEstilo,
} from "./estilo";

import indexHtml from "../index.html?raw";


function almacen(inicial: Record<string, string> = {}): AlmacenEstilo & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => datos[k] ?? null,
    setItem: (k, v) => { datos[k] = v; },
  };
}

const roto: AlmacenEstilo = {
  getItem() { throw new Error("SecurityError"); },
  setItem() { throw new Error("QuotaExceededError"); },
};

/** Una raíz de mentira: solo los atributos que toca `aplicarEstilo`. */
function raiz() {
  const atributos = new Map<string, string>();
  return {
    atributos,
    setAttribute(n: string, v: string) { atributos.set(n, v); },
    removeAttribute(n: string) { atributos.delete(n); },
  };
}

describe("el catálogo de estilos", () => {
  it("empieza por el clásico, que es el de siempre", () => {
    expect(ESTILO_POR_DEFECTO).toBe("clasico");
    expect(ESTILOS[0].id).toBe("clasico");
  });

  it("trae clásico, pixel art, neón, cómic, minimalista, sakura y halloween, en ese orden", () => {
    expect(ESTILOS.map((e) => e.nombre)).toEqual(["Clásico", "Pixel art", "Neón", "Cómic", "Minimalista", "Sakura", "Halloween"]);
  });

  it("tiene ids únicos", () => {
    expect(new Set(ESTILOS.map((e) => e.id)).size).toBe(ESTILOS.length);
  });
});

/**
 * El script en línea de `index.html` repite la clave y las fuentes, porque corre antes de que
 * exista el bundle. Si se desincronizan, el estilo parpadea al cargar o pide la letra
 * equivocada, y nada más lo avisaría.
 */
describe("index.html y los estilos van de la mano", () => {
  const html = indexHtml;
  const otros = ESTILOS.filter((e) => e.id !== "clasico");

  it("el script de arranque usa la misma clave", () => {
    expect(html).toContain(`localStorage.getItem("${CLAVE_ESTILO}")`);
  });

  it.each(otros.map((e) => e.id))("%s: el script pide las mismas fuentes", (id) => {
    expect(html).toContain(`${id}: "${FUENTES[id as keyof typeof FUENTES]}"`);
  });

  it.each(otros.map((e) => e.id))("%s: su hoja está enlazada", (id) => {
    expect(html).toContain(`href="/src/estilo${id[0].toUpperCase()}${id.slice(1)}.css"`);
  });

  it("las hojas de estilo van después de la clásica, para ganarle a igual especificidad", () => {
    const clasica = html.indexOf(`href="/src/estilos.css"`);
    for (const e of otros) {
      expect(html.indexOf(`/src/estilo${e.id[0].toUpperCase()}${e.id.slice(1)}.css`)).toBeGreaterThan(clasica);
    }
  });
});

describe("onomatopeya", () => {
  it("siempre grita una de la lista, en los dos extremos del azar", () => {
    expect(onomatopeya(() => 0)).toBe(ONOMATOPEYAS[0]);
    expect(onomatopeya(() => 0.9999)).toBe(ONOMATOPEYAS[ONOMATOPEYAS.length - 1]);
  });
});

describe("estiloGuardado", () => {
  it("sin nada guardado es el clásico", () => {
    expect(estiloGuardado(almacen())).toBe("clasico");
  });

  it("devuelve lo que se guardó", () => {
    expect(estiloGuardado(almacen({ [CLAVE_ESTILO]: "pixel" }))).toBe("pixel");
  });

  it("recuerda cualquiera de los estilos", () => {
    for (const e of ESTILOS) expect(estiloGuardado(almacen({ [CLAVE_ESTILO]: e.id }))).toBe(e.id);
  });

  it("un estilo que ya no existe cae en el clásico", () => {
    expect(estiloGuardado(almacen({ [CLAVE_ESTILO]: "vaporwave" }))).toBe("clasico");
  });

  it("sin almacén, o con uno que tira, cae en el clásico", () => {
    expect(estiloGuardado(null)).toBe("clasico");
    expect(estiloGuardado(roto)).toBe("clasico");
  });
});

describe("guardarEstilo", () => {
  it("lo deja para la próxima carga", () => {
    const a = almacen();
    guardarEstilo("pixel", a);
    expect(estiloGuardado(a)).toBe("pixel");
  });

  it("un almacén que tira no rompe nada", () => {
    expect(() => guardarEstilo("pixel", roto)).not.toThrow();
  });
});

describe("aplicarEstilo", () => {
  it("cada estilo que no es el clásico se marca en la raíz", () => {
    for (const id of ["pixel", "neon", "comic", "minimalista", "sakura", "halloween"] as const) {
      const r = raiz();
      aplicarEstilo(id, r);
      expect(r.atributos.get("data-estilo")).toBe(id);
    }
  });

  it("cambiar de un estilo a otro deja solo el último", () => {
    const r = raiz();
    aplicarEstilo("neon", r);
    aplicarEstilo("comic", r);
    expect(r.atributos.get("data-estilo")).toBe("comic");
  });

  it("el clásico no deja atributo: su CSS es exactamente el de siempre", () => {
    const r = raiz();
    aplicarEstilo("pixel", r);
    aplicarEstilo("clasico", r);
    expect(r.atributos.has("data-estilo")).toBe(false);
  });
});

describe("retrasosDeCortina", () => {
  const sinRuido = () => 0;

  it("da un retraso por celda", () => {
    expect(retrasosDeCortina(8, 5, 400)).toHaveLength(40);
  });

  it("barre en diagonal: arranca arriba a la izquierda y termina abajo a la derecha", () => {
    const r = retrasosDeCortina(4, 3, 400, sinRuido);
    expect(r[0]).toBe(0);
    expect(Math.max(...r)).toBe(r[r.length - 1]);
    // La misma diagonal sale a la vez.
    expect(r[1]).toBe(r[4]);
  });

  it("nunca se pasa del barrido, ni con todo el ruido", () => {
    const r = retrasosDeCortina(8, 14, 400, () => 0.999);
    expect(Math.max(...r)).toBeLessThanOrEqual(400);
  });

  it("una sola celda no divide entre cero", () => {
    expect(retrasosDeCortina(1, 1, 400, sinRuido)).toEqual([0]);
  });
});
