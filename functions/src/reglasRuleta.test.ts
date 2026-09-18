import { describe, expect, it } from "vitest";
import {
  PROBABILIDAD_GANAR,
  castigoDelMes,
  mesAnterior,
  motivoDeRechazo,
  resolverTirada,
  type EstadoParaJugar,
  type TiradaParaCastigo,
} from "./reglasRuleta";

const puedeJugar = (campos: Partial<EstadoParaJugar> = {}): EstadoParaJugar => ({
  activo: true,
  faltaRota: "2026-09-16",
  disponibles: 0,
  yaJugo: false,
  ...campos,
});

describe("motivoDeRechazo", () => {
  it("con todo en su lugar deja jugar", () => {
    expect(motivoDeRechazo(puedeJugar())).toBeNull();
  });

  it("rechaza la cuenta pausada", () => {
    expect(motivoDeRechazo(puedeJugar({ activo: false }))).toBe("cuenta_pausada");
  });

  it("rechaza si no hay falta reparable", () => {
    expect(motivoDeRechazo(puedeJugar({ faltaRota: null }))).toBe("sin_falta_reparable");
  });

  // El juego solo existe donde hay una pared: con cupo, el cliente revive gratis y no
  // tiene por qué arriesgar el mes que viene.
  it("rechaza si todavia le queda cupo", () => {
    expect(motivoDeRechazo(puedeJugar({ disponibles: 1 }))).toBe("todavia_tiene_cupo");
  });

  it("rechaza la segunda tirada del mes", () => {
    expect(motivoDeRechazo(puedeJugar({ yaJugo: true }))).toBe("ya_jugo");
  });

  // La cuenta pausada se revisa primero: es el único motivo que el cliente no puede
  // resolver solo, y es el mensaje que necesita leer.
  it("la cuenta pausada gana sobre los demas motivos", () => {
    expect(motivoDeRechazo(puedeJugar({ activo: false, yaJugo: true }))).toBe("cuenta_pausada");
  });
});

describe("resolverTirada", () => {
  it("cae en el color apostado cuando el azar entra en la probabilidad", () => {
    expect(resolverTirada("primario", 0)).toEqual({ gano: true, color: "primario" });
    expect(resolverTirada("ambar", 0.69)).toEqual({ gano: true, color: "ambar" });
  });

  it("cae en el otro color cuando el azar la pasa", () => {
    expect(resolverTirada("primario", 0.7)).toEqual({ gano: false, color: "ambar" });
    expect(resolverTirada("ambar", 0.99)).toEqual({ gano: false, color: "primario" });
  });

  // El 0.7 es el contrato con el entrenador y el único lugar donde vive. Si alguien lo
  // mueve sin querer, este test lo dice antes que los clientes.
  it("la probabilidad de ganar es 0.7", () => {
    expect(PROBABILIDAD_GANAR).toBe(0.7);
  });

  it("de 1000 tiradas con azar parejo gana cerca del 70 por ciento", () => {
    const ganadas = Array.from({ length: 1000 }, (_, i) =>
      resolverTirada("primario", i / 1000)
    ).filter((t) => t.gano).length;
    expect(ganadas).toBe(700);
  });
});

// Gemelos de los tests de web/src/tirada.test.ts: mismos casos, mismo mesAnterior y
// castigoDelMes, duplicados porque functions/ y web/ son proyectos npm separados.
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
  const tirada = (campos: Partial<TiradaParaCastigo> = {}): TiradaParaCastigo => ({
    gano: false,
    ...campos,
  });

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
