import { describe, expect, it } from "vitest";
import { idDispositivo, registroValido } from "./registrarDispositivo";

describe("idDispositivo", () => {
  // Review Focus: registrar dos veces el mismo token no duplica el documento.
  it("el mismo token da siempre el mismo id", () => {
    expect(idDispositivo("abc")).toBe(idDispositivo("abc"));
    expect(idDispositivo("abc")).not.toBe(idDispositivo("abd"));
  });

  it("el id sirve como id de documento de Firestore", () => {
    expect(idDispositivo("a/b:c")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("registroValido", () => {
  it("acepta un token y una plataforma conocida", () => {
    expect(registroValido({ token: "t".repeat(150), plataforma: "ios" }))
      .toEqual({ token: "t".repeat(150), plataforma: "ios" });
  });

  it("una plataforma desconocida queda como 'otro'", () => {
    expect(registroValido({ token: "t".repeat(150), plataforma: "windows" })?.plataforma).toBe("otro");
  });

  it("rechaza token ausente, vacio o absurdamente largo", () => {
    expect(registroValido({})).toBeNull();
    expect(registroValido({ token: "" })).toBeNull();
    expect(registroValido({ token: "t".repeat(5000) })).toBeNull();
    expect(registroValido(null)).toBeNull();
  });
});
