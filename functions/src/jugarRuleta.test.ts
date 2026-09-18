import { describe, expect, it, vi } from "vitest";
import { aplicarTirada, calcularDisponibles, type DepsTirada } from "./jugarRuleta";
import { motivoDeRechazo } from "./reglasRuleta";

function deps(campos: Partial<DepsTirada> = {}): DepsTirada {
  return {
    estado: { activo: true, faltaRota: "2026-09-16", disponibles: 0, yaJugo: false },
    apostado: "primario",
    mes: "2026-09",
    hoy: "2026-09-18",
    azar: () => 0,
    registrarTirada: vi.fn(async () => {}),
    justificarFalta: vi.fn(async () => {}),
    ...campos,
  };
}

describe("aplicarTirada", () => {
  it("al ganar justifica la falta y registra la tirada", async () => {
    const d = deps({ azar: () => 0 });
    const resultado = await aplicarTirada(d);

    expect(resultado).toEqual({ gano: true, color: "primario" });
    expect(d.justificarFalta).toHaveBeenCalledWith("2026-09-16");
    expect(d.registrarTirada).toHaveBeenCalledWith({
      mes: "2026-09",
      color: "primario",
      gano: true,
      fecha: "2026-09-18",
    });
  });

  it("al perder registra la tirada y NO toca las asistencias", async () => {
    const d = deps({ azar: () => 0.99 });
    const resultado = await aplicarTirada(d);

    expect(resultado).toEqual({ gano: false, color: "ambar" });
    expect(d.justificarFalta).not.toHaveBeenCalled();
    expect(d.registrarTirada).toHaveBeenCalledWith({
      mes: "2026-09",
      color: "ambar",
      gano: false,
      fecha: "2026-09-18",
    });
  });

  // Rechazar tiene que ser TOTAL: ni tirada registrada ni falta justificada. Un rechazo que
  // igual consume la tirada del mes es peor que no ofrecer el juego.
  it("rechaza con un motivo cuando no se puede jugar", async () => {
    const d = deps({ estado: { activo: true, faltaRota: null, disponibles: 0, yaJugo: false } });
    await expect(aplicarTirada(d)).rejects.toThrow("sin_falta_reparable");
    expect(d.registrarTirada).not.toHaveBeenCalled();
    expect(d.justificarFalta).not.toHaveBeenCalled();
  });

  it("rechaza la segunda tirada del mes sin escribir nada", async () => {
    const d = deps({ estado: { activo: true, faltaRota: "2026-09-16", disponibles: 0, yaJugo: true } });
    await expect(aplicarTirada(d)).rejects.toThrow("ya_jugo");
    expect(d.registrarTirada).not.toHaveBeenCalled();
  });

  it("rechaza un color que no existe", async () => {
    const d = deps({ apostado: "verde" as never });
    await expect(aplicarTirada(d)).rejects.toThrow("color_invalido");
  });
});

// GEMELO: `disponiblesEnElMes` en `web/src/cupo.ts`. Tienen que dar el mismo número: el cupo
// es un solo dato derivado, y dos fórmulas distintas para el mismo número es justo lo que el
// spec prohíbe.
describe("calcularDisponibles", () => {
  it("sin castigo, resta solo lo gastado", () => {
    expect(calcularDisponibles(1, 0)).toBe(2);
  });

  it("nunca baja de cero", () => {
    expect(calcularDisponibles(3, 1)).toBe(0);
  });

  // El caso que el brief calculaba mal: un cliente castigado (máximo 2) que ya gastó sus 2
  // revives ve cupo 0 en la página. Sin restar el castigo acá, `MAXIMO_POR_MES - gastados`
  // daría 1 y el servidor respondería `todavia_tiene_cupo`, rechazando la tirada que la
  // página ya le había ofrecido.
  it("castigado y con dos gastadas, el cupo llega a cero y no a uno", () => {
    expect(calcularDisponibles(2, 1)).toBe(0);
  });

  it("ese cero no bloquea la tirada en motivoDeRechazo", () => {
    const disponibles = calcularDisponibles(2, 1);
    expect(
      motivoDeRechazo({ activo: true, faltaRota: "2026-09-16", disponibles, yaJugo: false })
    ).toBeNull();
  });
});
