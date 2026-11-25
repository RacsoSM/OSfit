import { describe, expect, it } from "vitest";
import { marcasDe, nombreCorto } from "./marcasRecords";
import type { TablaDiscos } from "./juegoDiscos";

const t = (filas: [number, string, number, boolean?][], tuMejor = 0): TablaDiscos =>
  ({ filas: filas.map(([puesto, nombre, puntos, esTuyo]) => ({ puesto, nombre, puntos, esTuyo: !!esTuyo })), tuMejor });

describe("marcas de los records", () => {
  it("una por puntuación, de las demás, con corona la más alta; la tuya aparte, ordenadas de abajo arriba", () => {
    const m = marcasDe(t([[1, "Brianda Torres", 142], [2, "Valeria Ruiz", 100, true], [3, "Said", 96], [4, "Karla Medina", 41]], 100));
    expect(m.map((x) => [x.puntos, x.texto, x.tuya, x.campeon])).toEqual([
      [41, "Karla M.", false, false], [96, "Said", false, false], [100, "Tu récord", true, false], [142, "Brianda T.", false, true],
    ]);
  });
  it("las que empataron van juntas; más de dos, resumidas", () => {
    expect(marcasDe(t([[1, "Ana Soto", 20], [1, "Bety Cruz", 20]]))[0]!.texto).toBe("Ana S. y Bety C.");
    expect(marcasDe(t([[1, "Ana", 9], [1, "Bety", 9], [1, "Caro", 9]]))[0]!.texto).toBe("Ana y 2 más");
  });
  it("si alguien tiene tu mismo récord, va en tu misma marca", () => {
    const m = marcasDe(t([[1, "Karla Medina", 21], [1, "Valeria Ruiz", 21, true]], 21));
    expect(m).toEqual([{ puntos: 21, texto: "Tú y Karla M.", tuya: true, campeon: true }]);
  });

  it("solo las más altas, para no llenar la pantalla; sin tabla, ninguna", () => {
    const muchas = t(Array.from({ length: 15 }, (_, i) => [i + 1, `P${i}`, 100 - i] as [number, string, number]));
    const m = marcasDe(muchas, 8);
    expect(m).toHaveLength(8);
    expect(Math.min(...m.map((x) => x.puntos))).toBe(93);
    expect(marcasDe(null)).toEqual([]);
  });
  it("nombreCorto", () => {
    expect(nombreCorto("Brianda Torres Ruiz")).toBe("Brianda T.");
    expect(nombreCorto("Said")).toBe("Said");
  });
});
