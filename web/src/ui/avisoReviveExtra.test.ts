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

/** Lo que se lee, sin etiquetas ni saltos: el texto lleva negritas en medio. */
const texto = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

describe("avisoReviveExtra", () => {
  it("sale al llegar a 30 y dice los números", () => {
    const html = avisoReviveExtra(corrida("2026-08-03", 30), false, false);
    expect(texto(html)).toContain("Cumpliste 30 días de racha");
    expect(texto(html)).toContain("comodín extra para revivir tu racha");
    expect(texto(html)).toContain("4 comodines al mes en vez de 3");
    expect(texto(html)).toContain("tu llama ahora es azul");
    expect(html).toContain('class="llama-azul"');
    expect(html).toContain('id="revive-extra-visto"');
  });

  it("no sale antes de 30", () => {
    expect(avisoReviveExtra(corrida("2026-08-03", 29), false, false)).toBe("");
  });

  it("sale también con el revive extra dado a mano, sin racha de 30", () => {
    expect(texto(avisoReviveExtra(corrida("2026-08-03", 3), false, true))).toContain("tu llama ahora es azul");
  });

  it("es una ventana emergente, y la entrada no se repite en cada repintado", () => {
    avisoReviveExtra(corrida("2026-08-03", 30), false, false);
    const otra = avisoReviveExtra(corrida("2026-08-03", 30), false, false);
    expect(otra).toContain('role="dialog"');
    expect(otra).toContain('class="logro-velo"');
    expect(otra).not.toContain("entrando");
  });

  it("no vuelve a salir una vez cerrado", () => {
    expect(avisoReviveExtra(corrida("2026-08-03", 30), true, false)).toBe("");
  });
});
