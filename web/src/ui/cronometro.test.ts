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

describe("cronometro con descanso", () => {
  it("sin el ajuste, solo el tiempo entrenando", () => {
    expect(cronometro(0, 1_000)).not.toContain("cronometro-descanso");
  });
  it("prendido y sin series todavía, el descanso va escondido", () => {
    expect(cronometro(0, 1_000, null)).toMatch(/cronometro-descanso" hidden/);
  });
  it("prendido, cuenta desde la última serie", () => {
    const html = cronometro(0, 100_000, 10_000);
    expect(html).toContain('data-desde="10000"');
    expect(html).toContain("1:30");
    expect(html).not.toMatch(/cronometro-descanso" hidden/);
  });
});
