import { describe, expect, it } from "vitest";
import { armarComparacion, clienteCompararDesdeDoc, type ClienteComparar } from "./comparar";

const banco = [{ id: "curl", tipo: "peso" as const, musculos: { biceps: 1 },
  estandares: { H: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5], M: [0.05, 0.08, 0.1, 0.13, 0.16, 0.2, 0.24, 0.3] } }];
const con = (id: string, campos: Partial<ClienteComparar> = {}): ClienteComparar => ({
  id, nombre: id, sexo: "M", peso: 60, grasa: null, anioNacimiento: null, sinAcceso: false, muestra: true, ...campos,
});
const curl = [{ fecha: "2026-10-10", ejercicios: [{ ejercicioId: "curl", series: [{ reps: 10, peso: 8 }] }] }];
const hoy = "2026-10-14";

describe("armarComparacion", () => {
  it("tú primero y luego alfabético, sin importar acentos ni mayúsculas", () => {
    const clientes = [con("Zoe"), con("ana"), con("yo", { nombre: "Mía" }), con("Álvaro", { sexo: "H", peso: 80 })];
    const ses = new Map(clientes.map((c) => [c.id, curl]));
    const r = armarComparacion(clientes, ses, banco, "yo", hoy);
    expect(r.map((p) => p.nombre)).toEqual(["Mía", "Álvaro", "ana", "Zoe"]);
    expect(r[0].esTuyo).toBe(true);
    expect(r[0].niveles.biceps).toBeGreaterThan(0);
  });
  it("deja fuera a quien no tiene músculos con datos, sexo o peso, y a quien se escondió", () => {
    const clientes = [con("sin-sesiones"), con("sin-sexo", { sexo: null }), con("sin-peso", { peso: null }), con("escondida", { muestra: false }), con("sin-acceso", { sinAcceso: true }), con("ok")];
    const ses = new Map(clientes.filter((c) => c.id !== "sin-sesiones").map((c) => [c.id, curl]));
    expect(armarComparacion(clientes, ses, banco, "x", hoy).map((p) => p.nombre)).toEqual(["ok"]);
  });
  it("quien se escondió se sigue viendo a sí misma", () => {
    const r = armarComparacion([con("yo", { muestra: false })], new Map([["yo", curl]]), banco, "yo", hoy);
    expect(r).toHaveLength(1);
  });
  it("no manda pesos ni ids", () => {
    const r = armarComparacion([con("ok")], new Map([["ok", curl]]), banco, "x", hoy);
    expect(Object.keys(r[0]).sort()).toEqual(["esTuyo", "niveles", "nombre", "sexo"]);
  });
});

describe("clienteCompararDesdeDoc", () => {
  it("lee los campos y tolera los raros", () => {
    expect(clienteCompararDesdeDoc("a", { nombre: " Ana ", sexo: "M", peso: 61, mostrarEnAmigos: true, sinAccesoAmigos: true }))
      .toMatchObject({ nombre: "Ana", sexo: "M", peso: 61, muestra: true, sinAcceso: true });
    // Sin elegir todavía: no sale.
    expect(clienteCompararDesdeDoc("b", { sexo: "X", peso: "70" }))
      .toMatchObject({ nombre: "Sin nombre", sexo: null, peso: null, muestra: false, sinAcceso: false });
  });
});
