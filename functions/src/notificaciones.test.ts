import { describe, expect, it } from "vitest";
import {
  LARGO_MAXIMO_TEXTO,
  avisoDesdeDoc,
  clienteParaAvisoDesdeDoc,
  destinatarias,
  enTandas,
  esTokenMuerto,
  type Aviso,
  type ClienteParaAviso,
} from "./notificaciones";

const c = (id: string, notificacionesWeb = true, activo = true): ClienteParaAviso => ({
  id, notificacionesWeb, activo,
});
const aviso = (campos: Partial<Aviso> = {}): Aviso => ({
  titulo: "OSfit", texto: "Ya llegamos", destino: "todas", clientesElegidos: [], ...campos,
});

describe("destinatarias", () => {
  it("'todas' son las habilitadas y activas", () => {
    const clientes = [c("a"), c("b", false), c("x", true, false)];
    expect(destinatarias(clientes, aviso())).toEqual(["a"]);
  });

  // Review Focus: la llave del entrenador manda aunque la haya elegido a mano.
  it("'elegidas' excluye a las elegidas que no estan habilitadas", () => {
    const clientes = [c("a"), c("b", false), c("d")];
    expect(destinatarias(clientes, aviso({ destino: "elegidas", clientesElegidos: ["a", "b"] })))
      .toEqual(["a"]);
  });

  it("'elegidas' ignora ids que ya no existen", () => {
    expect(destinatarias([c("a")], aviso({ destino: "elegidas", clientesElegidos: ["a", "borrada"] })))
      .toEqual(["a"]);
  });
});

describe("enTandas", () => {
  it("parte en grupos del tamano pedido", () => {
    expect(enTandas([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("por defecto usa el limite de FCM, 500", () => {
    const tandas = enTandas(Array.from({ length: 1001 }, (_, i) => i));
    expect(tandas.map((t) => t.length)).toEqual([500, 500, 1]);
  });

  it("sin elementos no hay tandas", () => {
    expect(enTandas([])).toEqual([]);
  });
});

describe("esTokenMuerto", () => {
  it("borra solo los tokens que FCM declara muertos", () => {
    expect(esTokenMuerto("messaging/registration-token-not-registered")).toBe(true);
    expect(esTokenMuerto("messaging/invalid-registration-token")).toBe(true);
  });

  // Review Focus: un payload mal armado no puede vaciar los dispositivos de todas.
  it("no borra por argumento invalido, errores de red ni codigo ausente", () => {
    expect(esTokenMuerto("messaging/invalid-argument")).toBe(false);
    expect(esTokenMuerto("messaging/internal-error")).toBe(false);
    expect(esTokenMuerto("messaging/server-unavailable")).toBe(false);
    expect(esTokenMuerto(undefined)).toBe(false);
  });
});

describe("lectura de documentos", () => {
  it("un cliente sin los campos queda deshabilitado e inactivo", () => {
    expect(clienteParaAvisoDesdeDoc("a", {})).toEqual({ id: "a", activo: false, notificacionesWeb: false });
    expect(clienteParaAvisoDesdeDoc("b", { activo: true, notificacionesWeb: "si" }))
      .toEqual({ id: "b", activo: true, notificacionesWeb: false });
  });

  it("un aviso valido se lee con sus valores", () => {
    expect(avisoDesdeDoc({ titulo: "Coach", texto: " Ya llegamos ", destino: "elegidas", clientesElegidos: ["a", 3] }))
      .toEqual({ titulo: "Coach", texto: "Ya llegamos", destino: "elegidas", clientesElegidos: ["a"] });
  });

  it("sin titulo usa OSfit, y un destino raro cuenta como 'todas'", () => {
    expect(avisoDesdeDoc({ texto: "Hola", destino: "nadie" }))
      .toEqual({ titulo: "OSfit", texto: "Hola", destino: "todas", clientesElegidos: [] });
  });

  it("sin texto, o con texto demasiado largo, no hay aviso", () => {
    expect(avisoDesdeDoc({ texto: "   " })).toBeNull();
    expect(avisoDesdeDoc({})).toBeNull();
    expect(avisoDesdeDoc({ texto: "x".repeat(LARGO_MAXIMO_TEXTO + 1) })).toBeNull();
  });
});
