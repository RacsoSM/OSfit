import { describe, expect, it } from "vitest";
import { avisoResumen, mesRecienCerrado, mesesPorGenerar, nombresDiasDesdeDoc } from "./cerrarMes";
import type { ResumenMensual } from "./resumenMensual";

describe("mesesPorGenerar", () => {
  it("solo los cerrados con actividad que no tienen documento, del más viejo al más nuevo", () => {
    expect(mesesPorGenerar(["2026-10", "2026-09", "2026-08", "2026-07"], new Set(["2026-08"]), "2026-10-28"))
      .toEqual(["2026-07", "2026-09"]);
  });

  it("nunca el mes en curso", () => {
    expect(mesesPorGenerar(["2026-11", "2026-10"], new Set(), "2026-11-01")).toEqual(["2026-10"]);
  });

  it("si ya están todos, nada (correrla dos veces no cambia nada)", () => {
    expect(mesesPorGenerar(["2026-10", "2026-09"], new Set(["2026-09"]), "2026-10-28")).toEqual([]);
  });
});

describe("mesRecienCerrado", () => {
  it("el día 1 es el mes anterior; cualquier otro día, ninguno (el respaldo no manda push)", () => {
    expect(mesRecienCerrado("2026-11-01")).toBe("2026-10");
    expect(mesRecienCerrado("2027-01-01")).toBe("2026-12");
    expect(mesRecienCerrado("2026-10-28")).toBeNull();
  });
});

describe("avisoResumen", () => {
  const r = (entreno: number, kg: number) =>
    ({ mes: "2026-10", asistencia: { entreno }, entrenamiento: { kg } }) as ResumenMensual;

  it("id fijo por clienta y mes, abre la ventana en ese mes", () => {
    const a = avisoResumen("abc", r(10, 59123));
    expect(a.id).toBe("resumenMensual_abc_2026-10");
    expect(a.titulo).toBe("Tu resumen de octubre ya está listo");
    expect(a.texto).toBe("10 días entrenados y 59,123 kg levantados. Míralo en Resumen mensual.");
    expect(a.abrir).toEqual({ ventana: "resumenMensual", mes: "2026-10" });
  });

  it("sin kg no los menciona; un día en singular", () => {
    expect(avisoResumen("abc", r(1, 0)).texto).toBe("1 día entrenado. Míralo en Resumen mensual.");
  });
});

describe("nombresDiasDesdeDoc", () => {
  it("los nombres de su rutina, con respaldo para los vacíos", () => {
    expect(nombresDiasDesdeDoc({ rutinaAsignada: { dias: [{ nombreDia: "Pecho " }, { nombreDia: "" }, {}] } }))
      .toEqual(["Pecho", "Día 2", "Día 3"]);
    expect(nombresDiasDesdeDoc({ rutinaAsignada: null })).toEqual([]);
  });
});
