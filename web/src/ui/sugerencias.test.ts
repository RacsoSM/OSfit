import { describe, expect, it } from "vitest";
import { LARGO_MAXIMO, mensajeDeError, reiniciarSugerencias, ventanaSugerencias } from "./sugerencias";

describe("ventanaSugerencias", () => {
  it("un campo de texto con su tope, el aviso de que ven su nombre y Enviar apagado sin texto", () => {
    reiniciarSugerencias();
    const html = ventanaSugerencias();
    expect(html).toContain('id="sugerencia-texto"');
    expect(html).toContain(`maxlength="${LARGO_MAXIMO}"`);
    expect(html).toContain("Tus coaches verán tu nombre.");
    expect(html).toMatch(/id="sugerencia-enviar"[^>]*disabled/);
  });
});

describe("mensajeDeError", () => {
  it("dice por qué: tope del día, texto inválido o conexión", () => {
    expect(mensajeDeError({ message: "limite" })).toContain("varios mensajes hoy");
    expect(mensajeDeError({ message: "texto_invalido" })).toContain("Escribe tu mensaje");
    expect(mensajeDeError(new Error("x"))).toContain("Revisa tu conexión");
  });
});
