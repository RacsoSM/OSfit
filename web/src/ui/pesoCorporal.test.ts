import { beforeEach, describe, expect, it } from "vitest";
import { bloquePeso, necesitaPeso, pesoValido, reiniciarPeso } from "./pesoCorporal";

beforeEach(reiniciarPeso);

describe("pesoValido", () => {
  it("acepta kilos con punto o coma y deja un decimal", () => {
    expect(pesoValido("62")).toBe(62);
    expect(pesoValido(" 62.5 ")).toBe(62.5);
    expect(pesoValido("62,5")).toBe(62.5);
    expect(pesoValido("70,46")).toBe(70.5);
  });

  it("rechaza lo que no es un peso de persona", () => {
    for (const t of ["", "abc", "0", "24.9", "301", "-60", "62 kg", "1e2", "6.2.5"]) {
      expect(pesoValido(t), t).toBeNull();
    }
  });
});

describe("necesitaPeso", () => {
  it("sin peso, o con uno que no sirve, no deja pasar", () => {
    expect(necesitaPeso(undefined)).toBe(true);
    expect(necesitaPeso(null)).toBe(true);
    expect(necesitaPeso(0)).toBe(true);
    expect(necesitaPeso(62)).toBe(false);
  });
});

describe("bloquePeso", () => {
  it("sin peso pinta el aviso que bloquea, sin forma de cerrarlo", () => {
    const html = bloquePeso(undefined);
    expect(html).toContain("peso-velo");
    expect(html).toContain("Para acceder a esta función, necesitas ingresar tu peso corporal");
    expect(html).toContain('id="peso-input"');
    expect(html).not.toContain("peso-cancelar");
  });

  it("con peso no bloquea: deja una línea para actualizarlo", () => {
    const html = bloquePeso(62.5);
    expect(html).not.toContain("peso-velo");
    expect(html).toContain("62.5 kg");
    expect(html).toContain('id="peso-actualizar"');
  });
});
