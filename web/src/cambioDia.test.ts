import { describe, expect, it } from "vitest";
import type { Cliente } from "./datos";
import { LLAVE_CAMBIO_DIA, anotarCambio, borrarCambio, conCambio, esRechazoDefinitivo, leerCambio, type AlmacenCambio } from "./cambioDia";
import { indiceDeHoy } from "./ui/tarjetaDia";

function almacen(): AlmacenCambio & { datos: Record<string, string> } {
  const datos: Record<string, string> = {};
  return { datos, getItem: (k) => datos[k] ?? null, setItem: (k, v) => { datos[k] = v; }, removeItem: (k) => { delete datos[k]; } };
}
const HOY = "2026-11-26";
const cliente = {
  nombre: "Ana", activo: true,
  ultimoDia: 0, ultimoDiaFecha: "2026-11-25", ultimoDiaEsAncla: false,
  rutinaAsignada: { id: "r", nombre: "R", dias: [
    { nombreDia: "Pierna", ejercicios: [] }, { nombreDia: "Espalda", ejercicios: [] }, { nombreDia: "Pecho", ejercicios: [] },
  ] },
} as unknown as Cliente;

describe("cambio de día en el teléfono", () => {
  it("se anota, se lee y se borra", () => {
    const a = almacen();
    expect(leerCambio(a)).toBeNull();
    anotarCambio(a, { diaIndex: 2, fecha: HOY });
    expect(leerCambio(a)).toEqual({ diaIndex: 2, fecha: HOY });
    anotarCambio(a, { diaIndex: 2, fecha: HOY, enviado: true, enviadoEn: 5 });
    expect(leerCambio(a)).toEqual({ diaIndex: 2, fecha: HOY, enviado: true, enviadoEn: 5 });
    borrarCambio(a);
    expect(leerCambio(a)).toBeNull();
  });

  it("datos rotos no cuentan", () => {
    const a = almacen();
    a.datos[LLAVE_CAMBIO_DIA] = "{roto";
    expect(leerCambio(a)).toBeNull();
    a.datos[LLAVE_CAMBIO_DIA] = JSON.stringify({ diaIndex: -1, fecha: HOY });
    expect(leerCambio(a)).toBeNull();
    expect(leerCambio(null)).toBeNull();
  });

  it("el cambio de hoy manda sobre el documento: la tarjeta ya muestra el día elegido", () => {
    expect(indiceDeHoy(cliente, HOY)).toBe(1);
    const cambiado = conCambio(cliente, { diaIndex: 2, fecha: HOY }, HOY);
    expect(indiceDeHoy(cambiado, HOY)).toBe(2);
  });

  it("uno de ayer, o fuera de la rutina, no cambia nada", () => {
    expect(conCambio(cliente, { diaIndex: 2, fecha: "2026-11-25" }, HOY)).toBe(cliente);
    expect(conCambio(cliente, { diaIndex: 7, fecha: HOY }, HOY)).toBe(cliente);
    expect(conCambio(cliente, null, HOY)).toBe(cliente);
  });

  it("solo los rechazos del servidor se descartan; un fallo de red se reintenta", () => {
    expect(esRechazoDefinitivo({ message: "ya_asistio_hoy" })).toBe(true);
    expect(esRechazoDefinitivo({ message: "cambio_vencido" })).toBe(true);
    expect(esRechazoDefinitivo({ code: "functions/unavailable", message: "unavailable" })).toBe(false);
    expect(esRechazoDefinitivo(new Error("La red no respondió a tiempo."))).toBe(false);
  });
});
