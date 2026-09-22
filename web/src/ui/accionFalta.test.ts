import { describe, expect, it } from "vitest";
import type { Asistencia, Cliente } from "../datos";
import type { Tirada } from "../tirada";
import { tarjetaRevivir } from "./accionFalta";

const HOY = "2026-09-18"; // viernes
const cliente = (activo = true): Cliente =>
  ({ nombre: "Ana", activo, rutinaAsignada: null, ultimoDia: null,
     ultimoDiaFecha: null, ultimoDiaEsAncla: false } as Cliente);

/** Historial con la falta del jueves 17 y presencia el resto: rompe la racha y es reparable. */
const conFaltaRota = (gastadas: number): Asistencia[] => [
  { fecha: "2026-09-01", asistio: true, justificada: false },
  { fecha: "2026-09-17", asistio: false, justificada: false },
  ...Array.from({ length: gastadas }, (_, i) => ({
    fecha: `2026-09-0${i + 2}`,
    asistio: false,
    justificada: true,
    justificadaPorCliente: true,
  })),
];

const tirada = (campos: Partial<Tirada> = {}): Tirada =>
  ({ mes: "2026-08", color: "rojo", gano: false, fecha: "2026-08-20", ...campos });

describe("tarjetaRevivir", () => {
  // REGRESIÓN: este es el camino que usan TODOS los clientes hoy, no solo los que juegan.
  it("con cupo disponible sigue ofreciendo el revive normal", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(0), null, null);
    expect(html).toContain("Revivir mi racha");
    expect(html).not.toContain("Leer propuesta");
  });

  it("sin cupo y sin haber jugado ofrece la propuesta", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(3), null, null);
    expect(html).toContain("Te quedaste sin vidas");
    expect(html).toContain("Leer propuesta");
    expect(html).not.toContain("Revivir mi racha");
  });

  it("sin cupo y habiendo jugado ya no ofrece nada", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(3), tirada({ mes: "2026-09" }), null);
    expect(html).not.toContain("Leer propuesta");
    expect(html).toContain("Y tu tirada");
    // "Ya no ofrece nada" es literal: ni siquiera el botón muerto, que es la pared que esta
    // tarjeta existe para tumbar.
    expect(html).not.toContain("Revivir mi racha");
    expect(html).not.toContain("falta-revivir");
  });

  it("la cuenta pausada no recibe la propuesta", () => {
    const html = tarjetaRevivir(cliente(false), HOY, conFaltaRota(3), null, null);
    expect(html).not.toContain("Leer propuesta");
    expect(html).toContain("pausada");
  });

  it("sin falta rota no dibuja nada", () => {
    const sanas: Asistencia[] = [
      { fecha: "2026-09-16", asistio: true, justificada: false },
      { fecha: "2026-09-17", asistio: true, justificada: false },
    ];
    expect(tarjetaRevivir(cliente(), HOY, sanas, null, null)).toBe("");
  });

  // Sin esta frase el cliente ve un número raro y no sabe por qué.
  it("el mes castigado explica por que le quedan 2", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(0), null, tirada({ gano: false }));
    expect(html).toContain("Te quedan 2 este mes");
    expect(html).toContain("perdiste la ruleta el mes pasado");
  });

  it("haber ganado el mes pasado no castiga", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(0), null, tirada({ gano: true }));
    expect(html).toContain("Te quedan 3 este mes");
    expect(html).not.toContain("perdiste la ruleta");
  });

  // Con castigo, el cupo se agota en 2 y la propuesta debe aparecer ahí, no en 3.
  it("con castigo y dos gastadas ya ofrece la propuesta", () => {
    const html = tarjetaRevivir(cliente(), HOY, conFaltaRota(2), null, tirada({ gano: false }));
    expect(html).toContain("Leer propuesta");
  });
});
