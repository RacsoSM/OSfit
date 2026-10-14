import { describe, expect, it } from "vitest";
import {
  encolar, enviarPendientes, leerCola, pendientesDe, quitar, rechazoDefinitivo,
  type Almacen, type Pendiente,
} from "./cola";
import type { Envio } from "./registro";

const envio = (id: string): Envio => ({
  id, fecha: "2026-10-14", ejercicios: [{ ejercicioId: "press-banca", series: [{ reps: 10, peso: 40 }] }],
});
const de = (clienteId: string, id: string): Pendiente => ({ clienteId, envio: envio(id) });

function enMemoria(inicial: Pendiente[] = []): Almacen {
  let cola = inicial;
  return { leer: () => cola, guardar: (c) => { cola = c; } };
}

describe("leerCola", () => {
  it("vacía si no hay nada o el texto está dañado", () => {
    expect(leerCola(null)).toEqual([]);
    expect(leerCola("{roto")).toEqual([]);
    expect(leerCola('{"no":"es lista"}')).toEqual([]);
  });

  it("descarta lo que no tiene forma de pendiente", () => {
    const texto = JSON.stringify([de("c1", "s1234567"), { clienteId: "c1" }, 3]);
    expect(leerCola(texto)).toEqual([de("c1", "s1234567")]);
  });
});

describe("encolar y quitar", () => {
  it("el mismo id se reemplaza en vez de duplicarse", () => {
    const cola = encolar(encolar([], de("c1", "s1234567")), de("c1", "s1234567"));
    expect(cola).toHaveLength(1);
  });

  it("quita por id y filtra por clienta", () => {
    const cola = [de("c1", "a1234567"), de("c2", "b1234567"), de("c1", "c1234567")];
    expect(quitar(cola, "a1234567").map((p) => p.envio.id)).toEqual(["b1234567", "c1234567"]);
    expect(pendientesDe(cola, "c1")).toHaveLength(2);
  });
});

describe("rechazoDefinitivo", () => {
  it("solo un dato inválido es definitivo; la red y lo demás se reintentan", () => {
    expect(rechazoDefinitivo({ code: "functions/invalid-argument" })).toBe(true);
    expect(rechazoDefinitivo({ code: "functions/internal" })).toBe(false);
    expect(rechazoDefinitivo({ code: "functions/unavailable" })).toBe(false);
    expect(rechazoDefinitivo(new Error("x"))).toBe(false);
  });
});

describe("enviarPendientes", () => {
  it("manda los de la clienta en orden y los quita de la cola", async () => {
    const almacen = enMemoria([de("c1", "a1234567"), de("c2", "b1234567"), de("c1", "c1234567")]);
    const mandados: string[] = [];
    const quedan = await enviarPendientes(almacen, "c1", async (e) => { mandados.push(e.id); });
    expect(mandados).toEqual(["a1234567", "c1234567"]);
    expect(quedan).toBe(0);
    expect(almacen.leer().map((p) => p.envio.id)).toEqual(["b1234567"]);
  });

  it("sin red se detiene y no pierde nada", async () => {
    const almacen = enMemoria([de("c1", "a1234567"), de("c1", "c1234567")]);
    let intentos = 0;
    const quedan = await enviarPendientes(almacen, "c1", async () => {
      intentos++;
      throw { code: "functions/internal" };
    });
    expect(intentos).toBe(1);
    expect(quedan).toBe(2);
  });

  it("uno que el servidor rechaza se quita y sigue con el siguiente", async () => {
    const almacen = enMemoria([de("c1", "a1234567"), de("c1", "c1234567")]);
    const quedan = await enviarPendientes(almacen, "c1", async (e) => {
      if (e.id === "a1234567") throw { code: "functions/invalid-argument" };
    });
    expect(quedan).toBe(0);
  });
});
