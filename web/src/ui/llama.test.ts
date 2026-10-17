import { describe, expect, it } from "vitest";
import type { Asistencia } from "../datos";
import { tarjetaRanking } from "./tarjetaRanking";
import { tarjetasStats } from "./tarjetasStats";

/** `dias` asistencias seguidas (todos los días) desde `desde`. */
function corrida(desde: string, dias: number): Asistencia[] {
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(`${desde}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { fecha: d.toISOString().slice(0, 10), asistio: true, justificada: false };
  });
}

// Llama azul para quien alguna vez llegó a una racha de 30 (entrenador, 2026-10-17).
describe("la llama de la racha", () => {
  it("en Inicio es roja antes de 30 y azul desde 30, aunque la racha se rompa", () => {
    expect(tarjetasStats(corrida("2026-08-03", 29), "2026-10-17")).not.toContain("llama-azul");
    expect(tarjetasStats(corrida("2026-08-03", 30), "2026-10-17")).toContain('class="llama-azul"');
  });

  it("en Inicio también es azul con el revive extra dado a mano", () => {
    expect(tarjetasStats(corrida("2026-08-03", 3), "2026-10-17", null, true)).toContain('class="llama-azul"');
  });

  it("en el ranking la pinta azul la fila que lo trae del servidor", () => {
    const html = tarjetaRanking({
      estado: "listo",
      datos: {
        actual: [
          { puesto: 1, nombre: "Ana", racha: 40, esTuyo: false, llamaAzul: true },
          { puesto: 2, nombre: "Beto", racha: 3, esTuyo: true },
        ],
        historica: [],
      },
    });
    const [ana, beto] = html.split('class="ranking-fila').slice(1);
    expect(ana).toContain('class="llama-azul"');
    expect(beto).not.toContain("llama-azul");
    expect(beto).toContain("🔥 3");
  });
});
