import { describe, expect, it } from "vitest";
import { duracionEsDeLaWeb, interpretar, minutosDelDia, planAsistencia, variacionQueToca, type AsistenciaLeida, type ClienteLeido } from "./asistenciaWeb";

// 2026-10-14 es miércoles; 2026-10-17, sábado.
const HOY = "2026-10-14";

const cliente = (campos: Partial<ClienteLeido> = {}): ClienteLeido => ({
  trio: { dia: 0, fecha: "2026-10-13", esAncla: false },
  variacionesPorDia: [0, 0, 0],
  reinicioSemanal: false,
  ...campos,
});
const vino = (fecha: string, dia: number | null, variacion: number | null = null): AsistenciaLeida => ({
  fecha, asistio: true, diaRutinaRealizado: dia, variacionRealizada: variacion,
});

describe("interpretar (gemelo de web/src/dia.ts)", () => {
  it("el día siguiente al último, y vuelve a empezar al final del ciclo", () => {
    expect(interpretar({ dia: 0, fecha: "2026-10-13", esAncla: false }, 3, HOY, false)).toBe(1);
    expect(interpretar({ dia: 2, fecha: "2026-10-13", esAncla: false }, 3, HOY, false)).toBe(0);
  });
  it("un ancla manda tal cual", () => {
    expect(interpretar({ dia: 2, fecha: "2026-10-13", esAncla: true }, 3, HOY, false)).toBe(2);
  });
});

describe("planAsistencia", () => {
  it("marca el día que la web le muestra hoy y mueve el trío", () => {
    expect(planAsistencia(cliente(), null, [vino("2026-10-13", 0)], HOY)).toEqual({
      accion: "marcar",
      diaRutinaRealizado: 1,
      variacionRealizada: null,
      trio: { ultimoDia: 1, ultimoDiaFecha: HOY, ultimoDiaEsAncla: false },
    });
  });

  it("si el entrenador ya la marcó, no la toca", () => {
    expect(planAsistencia(cliente(), vino(HOY, 2), [], HOY)).toEqual({ accion: "nada" });
  });

  it("una falta del día se vuelve asistencia", () => {
    const falta = { fecha: HOY, asistio: false, diaRutinaRealizado: null, variacionRealizada: null };
    expect(planAsistencia(cliente(), falta, [], HOY)).toMatchObject({ accion: "marcar", diaRutinaRealizado: 1 });
  });

  it("con un día asignado a mano (ancla de ayer) toca ese día", () => {
    const c = cliente({ trio: { dia: 2, fecha: "2026-10-13", esAncla: true } });
    expect(planAsistencia(c, null, [], HOY)).toMatchObject({ diaRutinaRealizado: 2 });
  });

  it("lleva la variación que toca", () => {
    const c = cliente({ variacionesPorDia: [0, 3, 0] });
    const historial = [vino("2026-10-13", 0), vino("2026-10-06", 1, 1)];
    expect(planAsistencia(c, null, historial, HOY)).toMatchObject({ diaRutinaRealizado: 1, variacionRealizada: 2 });
  });

  it("fin de semana o sin rutina: asistencia sin día, la rutina no se mueve", () => {
    expect(planAsistencia(cliente(), null, [], "2026-10-17"))
      .toEqual({ accion: "marcar", diaRutinaRealizado: null, variacionRealizada: null, trio: null });
    expect(planAsistencia(cliente({ variacionesPorDia: [] }), null, [], HOY))
      .toMatchObject({ diaRutinaRealizado: null, trio: null });
  });

  it("uno mandado tarde de un día ya superado se marca sin día", () => {
    const c = cliente({ trio: { dia: 1, fecha: HOY, esAncla: false } });
    expect(planAsistencia(c, null, [vino(HOY, 1)], "2026-10-12"))
      .toMatchObject({ diaRutinaRealizado: null, trio: null });
  });

  it("antes de un día asignado a mano tampoco mueve la rutina", () => {
    const c = cliente({ trio: { dia: 2, fecha: "2026-10-13", esAncla: true } });
    expect(planAsistencia(c, null, [], "2026-10-13")).toMatchObject({ diaRutinaRealizado: null });
  });

  it("con reinicio semanal, ciclo terminado es descanso: asistencia sin día", () => {
    const c = cliente({ trio: { dia: 2, fecha: "2026-10-13", esAncla: false }, reinicioSemanal: true });
    expect(planAsistencia(c, null, [], HOY)).toMatchObject({ diaRutinaRealizado: null, trio: null });
  });
});

describe("variacionQueToca (gemelo de web/src/variacion.ts)", () => {
  it("rota a la siguiente y se queda en la de hoy si ya entrenó", () => {
    expect(variacionQueToca(1, [vino("2026-10-06", 1, 2)], HOY, 3)).toBe(0);
    expect(variacionQueToca(1, [vino(HOY, 1, 2)], HOY, 3)).toBe(2);
  });
});

describe("minutosDelDia", () => {
  const min = 60_000;
  it("suma lo que duró cada entrenamiento del día", () => {
    expect(minutosDelDia([
      { iniciadaMs: 0, creadaMs: 45 * min },
      { iniciadaMs: 100 * min, creadaMs: 120 * min },
    ])).toBe(65);
  });
  it("ignora los que no saben cuándo empezaron, y sin ninguno medido es null", () => {
    expect(minutosDelDia([{ iniciadaMs: null, creadaMs: 10 * min }, { iniciadaMs: 0, creadaMs: 30 * min }])).toBe(30);
    expect(minutosDelDia([{ iniciadaMs: null, creadaMs: 10 * min }])).toBeNull();
    expect(minutosDelDia([])).toBeNull();
  });
});

describe("duracionEsDeLaWeb", () => {
  it("solo sin el cronómetro del entrenador", () => {
    expect(duracionEsDeLaWeb({ asistio: true })).toBe(true);
    expect(duracionEsDeLaWeb({ asistio: true, horaLlegada: null })).toBe(true);
    expect(duracionEsDeLaWeb({ asistio: true, horaLlegada: { seconds: 1 } })).toBe(false);
    expect(duracionEsDeLaWeb({ asistio: false })).toBe(false);
    expect(duracionEsDeLaWeb(undefined)).toBe(false);
  });
});
