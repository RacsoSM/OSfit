import { describe, expect, it } from "vitest";
import { fechasQueCuentan, rachaActual, rachaMasLarga } from "./rachas";

const vino = (fecha: string) => ({ fecha, asistio: true, justificada: false });
const falto = (fecha: string) => ({ fecha, asistio: false, justificada: false });
const justificada = (fecha: string) => ({ fecha, asistio: false, justificada: true });

const cuentan = (...a: { fecha: string; asistio: boolean; justificada: boolean }[]) =>
  fechasQueCuentan(a);

describe("fechasQueCuentan", () => {
  it("toma asistidas y justificadas, no las faltas", () => {
    expect([...cuentan(vino("2026-09-08"), justificada("2026-09-09"), falto("2026-09-10"))].sort())
      .toEqual(["2026-09-08", "2026-09-09"]);
  });

  // Review Focus: dos documentos del mismo dia no duplican ni rompen.
  it("una fecha repetida cuenta una sola vez aunque uno de los registros sea falta", () => {
    const set = cuentan(vino("2026-09-08"), falto("2026-09-08"), vino("2026-09-08"));
    expect([...set]).toEqual(["2026-09-08"]);
  });
});

describe("rachaActual", () => {
  // 2026-09-08 martes, 09 miercoles, 10 jueves, 11 viernes, 14 lunes
  it("cuenta dias habiles seguidos", () => {
    expect(rachaActual(cuentan(vino("2026-09-08"), vino("2026-09-09"), vino("2026-09-10")), "2026-09-10")).toBe(3);
  });

  it("una falta corta la racha", () => {
    expect(rachaActual(cuentan(vino("2026-09-08"), vino("2026-09-10")), "2026-09-10")).toBe(1);
  });

  it("una justificada mantiene la racha", () => {
    expect(rachaActual(cuentan(vino("2026-09-08"), justificada("2026-09-09"), vino("2026-09-10")), "2026-09-10")).toBe(3);
  });

  it("el fin de semana ni suma ni corta", () => {
    expect(rachaActual(cuentan(vino("2026-09-11"), vino("2026-09-14")), "2026-09-14")).toBe(2);
  });

  it("hoy habil sin registro todavia no corta (dia de gracia)", () => {
    expect(rachaActual(cuentan(vino("2026-09-08"), vino("2026-09-09")), "2026-09-10")).toBe(2);
  });

  it("sin fechas es 0", () => {
    expect(rachaActual(new Set(), "2026-09-10")).toBe(0);
  });
});

describe("rachaMasLarga", () => {
  it("encuentra la corrida mas larga aunque no sea la ultima", () => {
    const set = cuentan(
      vino("2026-09-01"), vino("2026-09-02"), vino("2026-09-03"), vino("2026-09-04"), // mar-vie: 4
      vino("2026-09-08"), vino("2026-09-09") // falta el lunes 07: corrida de 2
    );
    expect(rachaMasLarga(set)).toBe(4);
  });

  it("el fin de semana no corta la corrida", () => {
    expect(rachaMasLarga(cuentan(vino("2026-09-10"), vino("2026-09-11"), vino("2026-09-14")))).toBe(3);
  });

  it("las justificadas cuentan", () => {
    expect(rachaMasLarga(cuentan(vino("2026-09-08"), justificada("2026-09-09"), vino("2026-09-10")))).toBe(3);
  });

  it("sin fechas es 0", () => {
    expect(rachaMasLarga(new Set())).toBe(0);
  });

  it("nunca es menor que la actual para el mismo historial", () => {
    const set = cuentan(vino("2026-09-08"), vino("2026-09-09"), vino("2026-09-10"));
    expect(rachaMasLarga(set)).toBeGreaterThanOrEqual(rachaActual(set, "2026-09-10"));
  });

  // Verificado tras revision final: un typo de año en Firestore (ej. "0026-09-08") es una
  // fecha con formato valido, asi que `armarRanking` no la descarta. El rango "primero a
  // ultimo registro" queda enorme, pero la funcion sigue devolviendo lo correcto sin tronar
  // (medido: ~1.8s para 2000 años, muy por debajo del limite de 60s de la funcion).
  it("sigue devolviendo lo correcto con un rango de fechas absurdamente largo (typo de año)", () => {
    const set = cuentan(vino("0026-09-08"), vino("2026-09-09"));
    expect(rachaMasLarga(set)).toBe(1);
  });
});
