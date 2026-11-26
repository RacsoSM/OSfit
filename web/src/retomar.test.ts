import { describe, expect, it } from "vitest";
import { LLAVE_RETOMAR, VIGENCIA_MS, anotarLugar, lugarARetomar, type AlmacenRetomar } from "./retomar";

function almacen(): AlmacenRetomar & { datos: Record<string, string> } {
  const datos: Record<string, string> = {};
  return { datos, getItem: (k) => datos[k] ?? null, setItem: (k, v) => { datos[k] = v; } };
}
const VENTANAS = ["inicio", "registro", "estadisticas", "arcade", "juego", "kettlebell", "boxjump"];

describe("retomar", () => {
  it("al volver pronto, retoma la ventana y el scroll", () => {
    const a = almacen();
    anotarLugar(a, "estadisticas", 640.4, 1_000);
    expect(lugarARetomar(a, 1_000 + 5 * 60_000, VENTANAS)).toEqual({ ventana: "estadisticas", scroll: 640, cuando: 1_000 });
  });

  it("pasada la vigencia abre en Inicio", () => {
    const a = almacen();
    anotarLugar(a, "registro", 0, 1_000);
    expect(lugarARetomar(a, 1_000 + VIGENCIA_MS + 1, VENTANAS)).toBeNull();
  });

  it("un juego a media partida vuelve al Arcade, arriba", () => {
    const a = almacen();
    anotarLugar(a, "boxjump", 300, 1_000);
    expect(lugarARetomar(a, 2_000, VENTANAS)).toEqual({ ventana: "arcade", scroll: 0, cuando: 1_000 });
  });

  it("Inicio, ventanas que ya no existen y datos rotos no retoman nada", () => {
    const a = almacen();
    anotarLugar(a, "inicio", 100, 1_000);
    expect(lugarARetomar(a, 2_000, VENTANAS)).toBeNull();
    anotarLugar(a, "medallas", 0, 1_000);
    expect(lugarARetomar(a, 2_000, VENTANAS)).toBeNull();
    a.datos[LLAVE_RETOMAR] = "{no es json";
    expect(lugarARetomar(a, 2_000, VENTANAS)).toBeNull();
    expect(lugarARetomar(null, 2_000, VENTANAS)).toBeNull();
  });

  it("un reloj que se fue para atrás no retoma", () => {
    const a = almacen();
    anotarLugar(a, "registro", 0, 10_000);
    expect(lugarARetomar(a, 5_000, VENTANAS)).toBeNull();
  });

  it("un almacén que truena no rompe nada", () => {
    const roto: AlmacenRetomar = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } };
    expect(() => anotarLugar(roto, "registro", 0, 1)).not.toThrow();
    expect(lugarARetomar(roto, 1, VENTANAS)).toBeNull();
  });
});
