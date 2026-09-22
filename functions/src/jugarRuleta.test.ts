import { describe, expect, it, vi } from "vitest";
import {
  aplicarTirada,
  calcularDisponibles,
  crearJustificarFalta,
  esErrorDeDocumentoExistente,
  type DepsTirada,
} from "./jugarRuleta";
import { motivoDeRechazo } from "./reglasRuleta";

function deps(campos: Partial<DepsTirada> = {}): DepsTirada {
  return {
    estado: { activo: true, faltaRota: "2026-09-16", disponibles: 0, yaJugo: false },
    apostado: "rojo",
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

    expect(resultado).toEqual({ gano: true, color: "rojo" });
    expect(d.justificarFalta).toHaveBeenCalledWith("2026-09-16");
    expect(d.registrarTirada).toHaveBeenCalledWith({
      mes: "2026-09",
      color: "rojo",
      gano: true,
      fecha: "2026-09-18",
    });
  });

  it("al perder registra la tirada y NO toca las asistencias", async () => {
    const d = deps({ azar: () => 0.99 });
    const resultado = await aplicarTirada(d);

    expect(resultado).toEqual({ gano: false, color: "negro" });
    expect(d.justificarFalta).not.toHaveBeenCalled();
    expect(d.registrarTirada).toHaveBeenCalledWith({
      mes: "2026-09",
      color: "negro",
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

// Corrección de ronda 1: un `catch` sin filtrar en `registrarTirada` atrapaba también
// permisos, red caída y timeouts, y se los traducía a "ya jugaste este mes" — mintiéndole al
// cliente y haciéndole creer que gastó una tirada que nunca se registró.
describe("esErrorDeDocumentoExistente", () => {
  it("reconoce el código gRPC ALREADY_EXISTS que lanza create() sobre un documento existente", () => {
    expect(esErrorDeDocumentoExistente({ code: 6 })).toBe(true);
  });

  it("no confunde otros códigos gRPC, como UNAVAILABLE, con documento existente", () => {
    expect(esErrorDeDocumentoExistente({ code: 14 })).toBe(false);
  });

  it("no confunde un error sin código", () => {
    expect(esErrorDeDocumentoExistente(new Error("boom"))).toBe(false);
  });
});

// Corrección de ronda 1: el documento de asistencia del premio omitía `justificadaPorCliente`,
// dejando la forma distinta a la que escribe `revivirRacha.ts` y, más grave, dejando la
// bandera en `true` si el entrenador ya había desmarcado una justificada del cliente.
describe("crearJustificarFalta", () => {
  it("sobre una asistencia existente, deja justificada y ganadaEnRuleta en true y apaga justificadaPorCliente", async () => {
    // Simula el agujero real: el entrenador había desmarcado una justificada del cliente
    // (`justificada: false`) pero `justificadaPorCliente` se quedó en `true`. Si el `update`
    // del premio no la tocara, las dos banderas volverían a quedar en `true` y
    // `gastadosEnElMes` contaría el premio como un revive gastado por el cliente.
    const update = vi.fn(async () => {});
    const crearAsistencia = vi.fn(async () => {});
    const justificarFalta = crearJustificarFalta({
      clienteId: "cliente-1",
      buscarExistente: (fecha) => (fecha === "2026-09-16" ? { update } : undefined),
      crearAsistencia,
    });

    await justificarFalta("2026-09-16");

    expect(update).toHaveBeenCalledWith({
      justificada: true,
      ganadaEnRuleta: true,
      justificadaPorCliente: false,
    });
    expect(crearAsistencia).not.toHaveBeenCalled();
  });

  it("sin asistencia previa, crea una con justificadaPorCliente en false", async () => {
    const crearAsistencia = vi.fn(async () => {});
    const justificarFalta = crearJustificarFalta({
      clienteId: "cliente-1",
      buscarExistente: () => undefined,
      crearAsistencia,
    });

    await justificarFalta("2026-09-16");

    expect(crearAsistencia).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: "cliente-1",
        fecha: "2026-09-16",
        justificada: true,
        ganadaEnRuleta: true,
        justificadaPorCliente: false,
      })
    );
  });
});
