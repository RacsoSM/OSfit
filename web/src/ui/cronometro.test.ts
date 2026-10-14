import { describe, expect, it } from "vitest";
import { cronometro, tiempoTranscurrido } from "./cronometro";

describe("tiempoTranscurrido", () => {
  it("minutos y segundos, y horas cuando pasa de una", () => {
    expect(tiempoTranscurrido(0)).toBe("0:00");
    expect(tiempoTranscurrido(247_000)).toBe("4:07");
    expect(tiempoTranscurrido(3_909_000)).toBe("1:05:09");
  });
  it("un reloj adelantado no da negativos", () => {
    expect(tiempoTranscurrido(-5000)).toBe("0:00");
  });
});

describe("cronometro", () => {
  it("pinta lo que lleva y deja la hora de inicio para el intervalo", () => {
    const html = cronometro(1_000, 61_000);
    expect(html).toContain('data-desde="1000"');
    expect(html).toContain("1:00");
  });
});
