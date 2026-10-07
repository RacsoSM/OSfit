import { describe, expect, it } from "vitest";
import {
  CLAVE_ESTILO, ESTILOS, ESTILO_POR_DEFECTO, aplicarEstilo, estiloGuardado, guardarEstilo,
  retrasosDeCortina, type AlmacenEstilo,
} from "./estilo";

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

  it("trae el pixel art", () => {
    expect(ESTILOS.map((e) => e.nombre)).toContain("Pixel art");
  });
});

describe("estiloGuardado", () => {
  it("sin nada guardado es el clásico", () => {
    expect(estiloGuardado(almacen())).toBe("clasico");
  });

  it("devuelve lo que se guardó", () => {
    expect(estiloGuardado(almacen({ [CLAVE_ESTILO]: "pixel" }))).toBe("pixel");
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
  it("el pixel se marca en la raíz", () => {
    const r = raiz();
    aplicarEstilo("pixel", r);
    expect(r.atributos.get("data-estilo")).toBe("pixel");
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
