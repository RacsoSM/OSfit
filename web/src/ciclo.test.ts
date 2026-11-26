import { describe, expect, it } from "vitest";
import { inicioDelCiclo, lunesDe, semanaDelCiclo, sugerencia } from "./ciclo";

describe("ciclo de RPE", () => {
  it("el lunes de cada semana", () => {
    expect(lunesDe("2026-11-26")).toBe("2026-11-23"); // jueves
    expect(lunesDe("2026-11-23")).toBe("2026-11-23"); // lunes
    expect(lunesDe("2026-11-29")).toBe("2026-11-23"); // domingo
  });

  it("empieza en su primera asistencia; sin asistencias, en su sesión más vieja", () => {
    expect(inicioDelCiclo([{ fecha: "2026-10-05", asistio: true }, { fecha: "2026-09-01", asistio: false }], [{ fecha: "2026-10-01" }])).toBe("2026-10-05");
    expect(inicioDelCiclo([], [{ fecha: "2026-10-03" }, { fecha: "2026-10-01" }])).toBe("2026-10-01");
    expect(inicioDelCiclo([], null)).toBeNull();
  });

  it("3 semanas de carga que suben y 1 de descarga, y vuelta a empezar", () => {
    const inicio = "2026-12-07"; // lunes, una clienta nueva
    expect(semanaDelCiclo(inicio, "2026-12-09")).toMatchObject({ numero: 1, fase: "base", rpe: "7" });
    expect(semanaDelCiclo(inicio, "2026-12-17")).toMatchObject({ numero: 2, fase: "carga", rpe: "8" });
    expect(semanaDelCiclo(inicio, "2026-12-24")).toMatchObject({ numero: 3, fase: "fuerza", rpe: "8–9" });
    expect(semanaDelCiclo(inicio, "2027-01-03")).toMatchObject({ numero: 4, fase: "descarga", rpe: "5–6" });
    expect(semanaDelCiclo(inicio, "2027-01-04")).toMatchObject({ numero: 1, fase: "base" });
  });

  it("las que ya entrenaban arrancan todas en la semana 1 del 23 de noviembre de 2026", () => {
    expect(semanaDelCiclo("2026-09-21", "2026-11-26")).toMatchObject({ numero: 1, fase: "base" });
    expect(semanaDelCiclo("2026-11-02", "2026-11-29")).toMatchObject({ numero: 1 });
    expect(semanaDelCiclo("2026-09-21", "2026-11-30")).toMatchObject({ numero: 2, fase: "carga" });
    expect(semanaDelCiclo("2026-09-21", "2026-12-14")).toMatchObject({ numero: 4, fase: "descarga" });
  });

  it("sin entrenamientos todavía, semana 1 (su ciclo empieza con el primero)", () => {
    expect(semanaDelCiclo(null, "2026-11-26").numero).toBe(1);
    expect(semanaDelCiclo(null, "2027-02-10").numero).toBe(1);
  });

  it("sugiere adelantar la descarga si va muy pesada, y subir el peso si va ligera", () => {
    const carga = semanaDelCiclo("2026-10-01", "2026-12-02"); // semana 2, RPE 8
    expect(sugerencia([{ fecha: "2026-11-30", esfuerzo: 10 }, { fecha: "2026-12-01", esfuerzo: 9 }], carga, "2026-12-02")).toEqual({ tipo: "pesada", promedio: 9.5 });
    expect(sugerencia([{ fecha: "2026-11-30", esfuerzo: 6 }, { fecha: "2026-12-01", esfuerzo: 6 }], carga, "2026-12-02")).toEqual({ tipo: "ligera", promedio: 6 });
    expect(sugerencia([{ fecha: "2026-11-30", esfuerzo: 8 }, { fecha: "2026-12-01", esfuerzo: 9 }], carga, "2026-12-02")).toBeNull();
  });

  it("con un solo entrenamiento, de otra semana o en la descarga, no sugiere nada", () => {
    const carga = semanaDelCiclo("2026-10-01", "2026-12-02");
    expect(sugerencia([{ fecha: "2026-12-01", esfuerzo: 10 }], carga, "2026-12-02")).toBeNull();
    expect(sugerencia([{ fecha: "2026-11-25", esfuerzo: 10 }, { fecha: "2026-11-26", esfuerzo: 10 }], carga, "2026-12-02")).toBeNull();
    const descarga = semanaDelCiclo("2026-10-01", "2026-12-16");
    expect(descarga.fase).toBe("descarga");
    expect(sugerencia([{ fecha: "2026-12-14", esfuerzo: 9 }, { fecha: "2026-12-15", esfuerzo: 9 }], descarga, "2026-12-16")).toBeNull();
  });
});
