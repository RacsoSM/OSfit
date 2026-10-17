import { describe, expect, it } from "vitest";
import type { Asistencia } from "../datos";
import { avisoReviveExtra } from "./avisoReviveExtra";

/** `dias` asistencias seguidas (todos los días) desde `desde`. */
function corrida(desde: string, dias: number): Asistencia[] {
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(`${desde}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { fecha: d.toISOString().slice(0, 10), asistio: true, justificada: false };
  });
}

describe("avisoReviveExtra", () => {
  it("sale al llegar a 30 y dice los números", () => {
    const html = avisoReviveExtra(corrida("2026-08-03", 30), false);
    expect(html).toContain("Cumpliste 30 días de racha");
    expect(html).toMatch(/4 revives al mes en vez de 3/);
    expect(html).toContain("tu llama ahora es azul");
    expect(html).toContain('class="llama-azul"');
    expect(html).toContain('id="revive-extra-visto"');
  });

  it("no sale antes de 30", () => {
    expect(avisoReviveExtra(corrida("2026-08-03", 29), false)).toBe("");
  });

  it("no vuelve a salir una vez cerrado", () => {
    expect(avisoReviveExtra(corrida("2026-08-03", 30), true)).toBe("");
  });
});
