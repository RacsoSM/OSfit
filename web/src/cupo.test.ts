import { describe, expect, it } from "vitest";
import { disponiblesEnElMes, gastadosEnElMes } from "./cupo";

/**
 * GEMELO: `CupoRevivesCalculatorTest` en Kotlin. Los mismos casos, las mismas fechas y los
 * mismos números: si alguien cambia un lado, este test sigue diciendo cuál era el contrato.
 *
 * El cupo se cuenta, no se guarda: si el entrenador desmarca una justificada desde su app,
 * el cupo se le devuelve al cliente solo. Estos tests fijan esa forma de contar.
 */
const falta = (fecha: string, porCliente: boolean, justificada = true) => ({
  fecha,
  asistio: false,
  justificada,
  justificadaPorCliente: porCliente,
  duracionMinutos: null,
});

describe("cupo de revives", () => {
  it("cuenta solo las justificadas por el cliente", () => {
    const asistencias = [
      falta("2026-09-01", true),
      falta("2026-09-02", true),
      falta("2026-09-03", false),
    ];
    expect(gastadosEnElMes(asistencias, "2026-09")).toBe(2);
  });

  it("el soborno del entrenador no gasta cupo del cliente", () => {
    const asistencias = [falta("2026-09-01", false)];
    expect(gastadosEnElMes(asistencias, "2026-09")).toBe(0);
    expect(disponiblesEnElMes(asistencias, "2026-09")).toBe(3);
  });

  it("ignora las de otros meses", () => {
    const asistencias = [
      falta("2026-08-31", true),
      falta("2026-10-01", true),
      falta("2026-09-15", true),
    ];
    expect(gastadosEnElMes(asistencias, "2026-09")).toBe(1);
  });

  it("con tres gastadas quedan cero disponibles", () => {
    const asistencias = [
      falta("2026-09-01", true),
      falta("2026-09-02", true),
      falta("2026-09-03", true),
    ];
    expect(disponiblesEnElMes(asistencias, "2026-09")).toBe(0);
  });

  it("nunca devuelve disponibles negativos", () => {
    const asistencias = [1, 2, 3, 4, 5].map((d) => falta(`2026-09-0${d}`, true));
    expect(disponiblesEnElMes(asistencias, "2026-09")).toBe(0);
  });

  it("una justificada que el entrenador desmarco deja de contar", () => {
    const asistencias = [falta("2026-09-01", true, false)];
    expect(gastadosEnElMes(asistencias, "2026-09")).toBe(0);
  });

  // No está en el gemelo de Kotlin porque allá el campo no es nullable: acá Firestore omite
  // los campos que nunca se escribieron, así que toda asistencia anterior a esta etapa llega
  // sin `justificadaPorCliente` y no debe contar como revive gastado.
  it("una asistencia vieja sin la bandera no gasta cupo", () => {
    const asistencias = [
      { fecha: "2026-09-01", asistio: false, justificada: true, duracionMinutos: null },
    ];
    expect(gastadosEnElMes(asistencias, "2026-09")).toBe(0);
    expect(disponiblesEnElMes(asistencias, "2026-09")).toBe(3);
  });

  // El castigo de la ruleta baja el máximo del mes, no lo que ya se gastó. Estos casos son
  // los que impiden que el castigo se cuele en `gastadosEnElMes`, que solo cuenta faltas.
  it("el castigo baja el maximo del mes a 2", () => {
    expect(disponiblesEnElMes([], "2026-09", 1)).toBe(2);
  });

  it("sin castigo el maximo sigue siendo 3", () => {
    expect(disponiblesEnElMes([], "2026-09", 0)).toBe(3);
  });

  it("con castigo y una gastada quedan 1", () => {
    const asistencias = [falta("2026-09-01", true)];
    expect(disponiblesEnElMes(asistencias, "2026-09", 1)).toBe(1);
  });

  it("con castigo y dos gastadas quedan 0", () => {
    const asistencias = [falta("2026-09-01", true), falta("2026-09-02", true)];
    expect(disponiblesEnElMes(asistencias, "2026-09", 1)).toBe(0);
  });

  // Regresión: la llamada sin tercer parámetro es la que hacen hoy todos los clientes que
  // nunca han jugado. Si esta se rompe, se rompe la página de todos, no la de los que juegan.
  it("sin tercer parametro se comporta como antes", () => {
    const asistencias = [falta("2026-09-01", true)];
    expect(disponiblesEnElMes(asistencias, "2026-09")).toBe(2);
  });
});
