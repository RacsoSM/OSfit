import { describe, expect, it } from "vitest";
import { fechaAviso, leerVisto, marcarVistas, sinLeer, ventanaBuzon } from "./buzon";
import type { EntradaBuzon } from "../datos";

const ts = (iso: string) => ({ toDate: () => new Date(iso) }) as unknown as EntradaBuzon["fecha"];
const e = (id: string, iso: string | null, extra: Partial<EntradaBuzon> = {}): EntradaBuzon =>
  ({ id, titulo: "Coaches", texto: "Ya llegamos", fecha: iso ? ts(iso) : null, ...extra });

describe("fechaAviso", () => {
  const hoy = "2026-11-16";
  it("hoy y ayer con su hora, en Mazatlán", () => {
    expect(fechaAviso(new Date("2026-11-16T16:05:00Z"), hoy)).toBe("Hoy · 9:05 a.m.");
    expect(fechaAviso(new Date("2026-11-15T23:30:00Z"), hoy)).toBe("Ayer · 4:30 p.m.");
  });
  it("antes, el día en palabras; con año si es de otro año", () => {
    expect(fechaAviso(new Date("2026-11-03T16:05:00Z"), hoy)).toBe("martes, 3 de noviembre · 9:05 a.m.");
    expect(fechaAviso(new Date("2025-12-31T16:05:00Z"), hoy)).toContain("2025");
  });
});

describe("ventanaBuzon", () => {
  it("cargando y vacío", () => {
    expect(ventanaBuzon(null, "2026-11-16")).toContain("Cargando");
    expect(ventanaBuzon([], "2026-11-16")).toContain("Todavía no tienes notificaciones");
  });
  it("cada aviso con su fecha, escapado, y marcado el que se tocó", () => {
    const html = ventanaBuzon([e("a", "2026-11-16T16:05:00Z", { texto: "<b>hola</b>" }), e("b", null)], "2026-11-16", "a");
    expect(html).toContain("Hoy · 9:05 a.m.");
    expect(html).toContain("&lt;b&gt;hola&lt;/b&gt;");
    expect(html).toContain(`class="tarjeta aviso marcado" data-aviso="a"`);
    expect(html).toContain(`class="tarjeta aviso" data-aviso="b"`);
    expect(html).toContain("Ahora");
  });
  it("el botón para ir adonde llevaba el aviso", () => {
    const html = ventanaBuzon([e("r", "2026-11-01T16:00:00Z", { abrir: { ventana: "resumenMensual", mes: "2026-10" } })], "2026-11-16");
    expect(html).toContain(`data-abrir-ventana="resumenMensual"`);
    expect(html).toContain(`data-abrir-mes="2026-10"`);
    expect(html).toContain("Ver mi resumen");
  });
});

describe("sin leer", () => {
  const a = e("a", "2026-11-16T16:05:00Z");
  const b = e("b", "2026-11-10T16:05:00Z");
  it("cuenta las posteriores a lo visto; sin buzón, cero", () => {
    expect(sinLeer([a, b], 0)).toBe(2);
    expect(sinLeer([a, b], new Date("2026-11-12T00:00:00Z").getTime())).toBe(1);
    expect(sinLeer(null, 0)).toBe(0);
  });
  it("abrir Notificaciones las marca todas y lo guarda en el teléfono", () => {
    const guardado: Record<string, string> = {};
    const almacen = { setItem: (k: string, v: string) => { guardado[k] = v; }, getItem: (k: string) => guardado[k] ?? null };
    const visto = marcarVistas([a, b], almacen, 0);
    expect(sinLeer([a, b], visto)).toBe(0);
    expect(leerVisto(almacen)).toBe(visto);
    expect(leerVisto(null)).toBe(0);
  });
});
