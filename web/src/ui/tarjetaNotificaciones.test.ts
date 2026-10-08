import { describe, expect, it } from "vitest";
import { invitacionNotificaciones, seccionNotificaciones } from "./tarjetaNotificaciones";

describe("seccionNotificaciones (Ajustes)", () => {
  it("sin la llave del entrenador no pinta nada", () => {
    expect(seccionNotificaciones("no-habilitada", false)).toBe("");
  });

  it("para instalar muestra los pasos, empezando por salir de WhatsApp, y ningún botón", () => {
    const html = seccionNotificaciones("instalar", false);
    expect(html).toContain("Abrir en Safari");
    expect(html).toContain("Agregar a inicio");
    expect(html).toContain("desde el ícono");
    expect(html).not.toContain(`id="activar-notificaciones"`);
  });

  it("sin token en la ruta pide abrir el link de WhatsApp primero", () => {
    expect(seccionNotificaciones("instalar-desde-link", false)).toContain("tu link de WhatsApp");
  });

  it("con permiso pendiente muestra el botón, deshabilitado mientras activa", () => {
    expect(seccionNotificaciones("pedir-permiso", false)).toContain(`id="activar-notificaciones"`);
    expect(seccionNotificaciones("pedir-permiso", true)).toContain("disabled");
  });

  it("activadas, bloqueadas y no soportado se explican sin botón", () => {
    expect(seccionNotificaciones("activadas", false)).toContain("activadas");
    expect(seccionNotificaciones("bloqueadas", false)).toContain("Ajustes");
    expect(seccionNotificaciones("no-soportado", false)).toContain("16.4");
    for (const e of ["activadas", "bloqueadas", "no-soportado"] as const) {
      expect(seccionNotificaciones(e, false)).not.toContain(`id="activar-notificaciones"`);
    }
  });
});

describe("invitacionNotificaciones (Inicio)", () => {
  it("invita solo a quien puede dar el siguiente paso y no la descartó", () => {
    expect(invitacionNotificaciones("pedir-permiso", false)).toContain(`id="activar-notificaciones"`);
    expect(invitacionNotificaciones("instalar", false)).toContain("Ajustes");
    expect(invitacionNotificaciones("pedir-permiso", true)).toBe("");
    for (const e of ["no-habilitada", "activadas", "bloqueadas", "no-soportado", "instalar-desde-link"] as const) {
      expect(invitacionNotificaciones(e, false)).toBe("");
    }
  });

  it("trae su botón para descartarla", () => {
    expect(invitacionNotificaciones("pedir-permiso", false)).toContain(`id="descartar-notificaciones"`);
  });
});
