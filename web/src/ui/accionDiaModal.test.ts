import { describe, expect, it } from "vitest";
import type { Cliente } from "../datos";
import { accionDia, modalCambioDia } from "./accionDia";

const cliente = {
  nombre: "Ana", activo: true,
  rutinaAsignada: { id: "r", nombre: "R", dias: [{ nombreDia: "Pierna", ejercicios: [] }, { nombreDia: "Espalda <b>", ejercicios: [] }] },
} as unknown as Cliente;

describe("Cambiar el día", () => {
  it("en la tarjeta es un botón discreto, sin pedir motivo", () => {
    const html = accionDia(cliente, "2026-11-26", false);
    expect(html).toContain('id="abrir-cambio-dia"');
    expect(html).toContain("Cambiar el día");
    expect(html).not.toContain("¿Por qué?");
  });

  it("deshabilitado con su nota si ya entrenó o la cuenta está pausada", () => {
    expect(accionDia(cliente, "2026-11-26", true)).toContain("Ya entrenaste hoy");
    expect(accionDia({ ...cliente, activo: false } as Cliente, "2026-11-26", false)).toContain("pausada");
  });

  it("el pop up no se pinta cerrado", () => {
    expect(modalCambioDia(cliente, 0)).toBe("");
  });
});
