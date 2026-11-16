import { describe, expect, it } from "vitest";
import { abrirDelMensaje, abrirDeLaDireccion, direccionSinAbrir } from "./abrirDesdeAviso";

const VENTANAS = ["inicio", "resumenMensual", "ajustes"];

describe("abrirDeLaDireccion", () => {
  it("lee la ventana y el mes", () => {
    expect(abrirDeLaDireccion("?abrir=resumenMensual&mes=2026-10", VENTANAS)).toEqual({ ventana: "resumenMensual", mes: "2026-10", aviso: null });
  });

  it("un mes raro se ignora, la ventana no", () => {
    expect(abrirDeLaDireccion("?abrir=resumenMensual&mes=octubre", VENTANAS)).toEqual({ ventana: "resumenMensual", mes: null, aviso: null });
  });

  it("una ventana que no existe, o sin parámetro, no abre nada", () => {
    expect(abrirDeLaDireccion("?abrir=pagos", VENTANAS)).toBeNull();
    expect(abrirDeLaDireccion("", VENTANAS)).toBeNull();
  });
});

describe("el aviso tocado", () => {
  it("viaja por la dirección y por mensaje; un id raro se ignora", () => {
    expect(abrirDeLaDireccion("?abrir=notificaciones&aviso=auto_llegada_abc_2026-11-16", ["notificaciones"]))
      .toEqual({ ventana: "notificaciones", mes: null, aviso: "auto_llegada_abc_2026-11-16" });
    expect(abrirDeLaDireccion("?abrir=notificaciones&aviso=a%20b", ["notificaciones"]))
      .toEqual({ ventana: "notificaciones", mes: null, aviso: null });
    expect(abrirDelMensaje({ tipo: "abrir", abrir: { ventana: "notificaciones", aviso: "Xy9" } }, ["notificaciones"]))
      .toEqual({ ventana: "notificaciones", mes: null, aviso: "Xy9" });
  });

  it("direccionSinAbrir también lo quita", () => {
    expect(direccionSinAbrir("/", "?abrir=notificaciones&aviso=Xy9", "")).toBe("/");
  });
});

describe("abrirDelMensaje", () => {
  it("solo los mensajes de tipo abrir, validados", () => {
    expect(abrirDelMensaje({ tipo: "abrir", abrir: { ventana: "resumenMensual", mes: "2026-10" } }, VENTANAS))
      .toEqual({ ventana: "resumenMensual", mes: "2026-10", aviso: null });
    expect(abrirDelMensaje({ tipo: "otro", abrir: { ventana: "inicio" } }, VENTANAS)).toBeNull();
    expect(abrirDelMensaje({ tipo: "abrir", abrir: { ventana: "x" } }, VENTANAS)).toBeNull();
    expect(abrirDelMensaje(null, VENTANAS)).toBeNull();
  });
});

describe("direccionSinAbrir", () => {
  it("quita abrir y mes y deja lo demás", () => {
    expect(direccionSinAbrir("/", "?abrir=resumenMensual&mes=2026-10", "")).toBe("/");
    expect(direccionSinAbrir("/c/tok", "?abrir=x&otro=1", "#h")).toBe("/c/tok?otro=1#h");
  });
});
