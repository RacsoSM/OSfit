import { describe, expect, it } from "vitest";
import { castigoDelMes, mesAnterior, type Tirada } from "./tirada";

const tirada = (campos: Partial<Tirada> = {}): Tirada => ({
  mes: "2026-08",
  color: "rojo",
  gano: false,
  fecha: "2026-08-20",
  ...campos,
});

describe("mesAnterior", () => {
  it("retrocede un mes dentro del mismo año", () => {
    expect(mesAnterior("2026-09")).toBe("2026-08");
  });

  // Enero es el único caso donde restar uno al número del mes no basta.
  it("cruza el año en enero", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
  });

  it("rellena el cero a la izquierda", () => {
    expect(mesAnterior("2026-10")).toBe("2026-09");
  });
});

describe("castigoDelMes", () => {
  it("sin tirada el mes anterior no hay castigo", () => {
    expect(castigoDelMes(null)).toBe(0);
  });

  it("haber ganado el mes anterior no castiga", () => {
    expect(castigoDelMes(tirada({ gano: true }))).toBe(0);
  });

  it("haber perdido el mes anterior cuesta un revive", () => {
    expect(castigoDelMes(tirada({ gano: false }))).toBe(1);
  });
});
