import { describe, expect, it } from "vitest";
import { planCambioDia } from "./cambiarDia";

describe("planCambioDia", () => {
  it("sin asistencia de hoy, o con falta, solo mueve el ancla", () => {
    expect(planCambioDia(undefined, false)).toBe("ancla");
    expect(planCambioDia({ asistio: false }, false)).toBe("ancla");
  });

  it("la que marcó la web al empezar, sin entrenamiento guardado: se puede, reescribiendo el día", () => {
    expect(planCambioDia({ asistio: true, marcadaDesde: "registro" }, false)).toBe("reescribir");
  });

  it("con un entrenamiento ya guardado hoy, o marcada por el entrenador: bloqueado", () => {
    expect(planCambioDia({ asistio: true, marcadaDesde: "registro" }, true)).toBe("bloquear");
    expect(planCambioDia({ asistio: true }, false)).toBe("bloquear");
  });
});
