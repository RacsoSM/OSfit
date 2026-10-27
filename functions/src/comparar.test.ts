import { describe, expect, it } from "vitest";
import {
  armarComparacion, candidatosAmigos, clienteCompararDesdeDoc, eleccionValida, type ClienteComparar,
} from "./comparar";

const banco = [{ id: "curl", tipo: "peso" as const, musculos: { biceps: 1 },
  estandares: { H: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5], M: [0.05, 0.08, 0.1, 0.13, 0.16, 0.2, 0.24, 0.3] } }];
const con = (id: string, campos: Partial<ClienteComparar> = {}): ClienteComparar => ({
  id, nombre: id, sexo: "M", peso: 60, grasa: null, anioNacimiento: null, sinAcceso: false, activo: true, admin: false, modo: "todos", compartirCon: [], sede: null, ...campos,
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
    const clientes = [con("sin-sesiones"), con("sin-sexo", { sexo: null }), con("sin-peso", { peso: null }), con("escondida", { modo: "nadie" }), con("sin-elegir", { modo: null }), con("sin-acceso", { sinAcceso: true }), con("ok"), con("x")];
    const ses = new Map(clientes.filter((c) => c.id !== "sin-sesiones" && c.id !== "x").map((c) => [c.id, curl]));
    expect(armarComparacion(clientes, ses, banco, "x", hoy).map((p) => p.nombre)).toEqual(["ok"]);
  });
  it("quien se escondió se sigue viendo a sí misma", () => {
    const r = armarComparacion([con("yo", { modo: "nadie" })], new Map([["yo", curl]]), banco, "yo", hoy);
    expect(r).toHaveLength(1);
  });
  // Los mismos kilos valen menos donde la máquina pesa la mitad (sede con factor 0.5).
  it("cada quien contra los estándares de su sede", () => {
    const clientes = [con("focus"), con("smart", { sede: "smart-fit" })];
    const ses = new Map(clientes.map((c) => [c.id, curl]));
    const r = armarComparacion(clientes, ses, banco, "focus", hoy, new Map([["smart-fit", { curl: 0.5 }]]));
    const nivel = (n: string) => r.find((p) => p.nombre === n)!.niveles.biceps;
    expect(nivel("smart")).toBeLessThan(nivel("focus"));
  });
  it("una sede que no existe cuenta como Focus", () => {
    const clientes = [con("focus"), con("rara", { sede: "no-existe" })];
    const ses = new Map(clientes.map((c) => [c.id, curl]));
    const r = armarComparacion(clientes, ses, banco, "focus", hoy, new Map());
    expect(r[0].niveles.biceps).toBe(r[1].niveles.biceps);
  });
  it("no manda pesos ni ids", () => {
    const r = armarComparacion([con("ok"), con("x")], new Map([["ok", curl]]), banco, "x", hoy);
    expect(Object.keys(r[0]).sort()).toEqual(["esTuyo", "niveles", "nombre", "sexo"]);
  });
});

describe("clienteCompararDesdeDoc", () => {
  it("lee los campos y tolera los raros", () => {
    expect(clienteCompararDesdeDoc("a", { nombre: " Ana ", sexo: "M", peso: 61, mostrarEnAmigos: true, sinAccesoAmigos: true }))
      .toMatchObject({ nombre: "Ana", sexo: "M", peso: 61, modo: "todos", sinAcceso: true });
    expect(clienteCompararDesdeDoc("c", { visibilidadAmigos: "algunos", compartirAmigosCon: ["x", 3], mostrarEnAmigos: true }))
      .toMatchObject({ modo: "algunos", compartirCon: ["x"] });
    // Sin elegir todavía: no sale.
    expect(clienteCompararDesdeDoc("b", { sexo: "X", peso: "70" }))
      .toMatchObject({ nombre: "Sin nombre", sexo: null, peso: null, modo: null, sinAcceso: false });
  });
});

describe("Amigos: quién ve a quién", () => {
  const nombres = (clientes: ClienteComparar[], yoId: string) => {
    const ses = new Map(clientes.map((c) => [c.id, curl]));
    return armarComparacion(clientes, ses, banco, yoId, hoy).map((p) => p.nombre);
  };
  it("quien se oculta solo se ve a sí misma", () => {
    expect(nombres([con("yo", { modo: "nadie" }), con("ana")], "yo")).toEqual(["yo"]);
  });
  it("quien no ha elegido tampoco ve a nadie", () => {
    expect(nombres([con("yo", { modo: null }), con("ana")], "yo")).toEqual(["yo"]);
  });
  it("solo a algunas: la ven las escogidas y nadie más", () => {
    const clientes = [con("bea", { modo: "algunos", compartirCon: ["yo"] }), con("cris", { modo: "algunos", compartirCon: ["otra"] }), con("yo")];
    expect(nombres(clientes, "yo")).toEqual(["yo", "bea"]);
  });
  it("quien comparte con algunas ve a todas las que se muestran a ella", () => {
    const clientes = [con("yo", { modo: "algunos", compartirCon: ["bea"] }), con("ana"), con("bea")];
    expect(nombres(clientes, "yo")).toEqual(["yo", "ana", "bea"]);
  });
  it("el administrador ve a todos con datos, aunque se oculten, no elijan o no tengan acceso", () => {
    const clientes = [con("yo", { admin: true, modo: "nadie" }), con("oculta", { modo: "nadie" }), con("sin-elegir", { modo: null }),
      con("vetada", { sinAcceso: true }), con("algunas", { modo: "algunos", compartirCon: ["otra"] }), con("sin-peso", { peso: null })];
    expect(nombres(clientes, "yo")).toEqual(["yo", "algunas", "oculta", "sin-elegir", "vetada"]);
  });
  it("lo que ve el administrador no cambia lo que ven los demás de él", () => {
    expect(nombres([con("yo"), con("admin", { admin: true, modo: "nadie" })], "yo")).toEqual(["yo"]);
  });
  it("candidatos: las demás activas con acceso, en orden", () => {
    const clientes = [con("yo"), con("Zoe"), con("ana"), con("baja", { activo: false }), con("vetada", { sinAcceso: true })];
    expect(candidatosAmigos(clientes, "yo")).toEqual([{ id: "ana", nombre: "ana" }, { id: "Zoe", nombre: "Zoe" }]);
  });
  it("valida lo que manda la web", () => {
    expect(eleccionValida({ modo: "todos", con: ["x"] })).toEqual({ modo: "todos", con: [] });
    expect(eleccionValida({ modo: "algunos", con: ["a", "a", 3, ""] })).toEqual({ modo: "algunos", con: ["a"] });
    expect(eleccionValida({ modo: "algunos", con: [] })).toBeNull();
    expect(eleccionValida({ modo: "otro" })).toBeNull();
    expect(eleccionValida({ mostrar: false })).toEqual({ modo: "nadie", con: [] });
  });
});
