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

  /** Asistencias en los días dados de cada semana (lunes de la semana → días: 0 = lunes). */
  function asistio(semanas: Record<string, number[]>) {
    return Object.entries(semanas).flatMap(([lunes, dias]) => dias.map((d) => {
      const f = new Date(`${lunes}T12:00:00Z`); f.setUTCDate(f.getUTCDate() + d);
      return { fecha: f.toISOString().slice(0, 10), asistio: true };
    }));
  }

  it("avanza una semana por cada semana terminada con al menos 3 días, y la de descarga cierra el bloque", () => {
    const inicio = "2026-12-07"; // lunes, una clienta nueva
    const a = asistio({ "2026-12-07": [0, 2, 4], "2026-12-14": [0, 1, 3], "2026-12-21": [0, 2, 4], "2026-12-28": [1, 3, 5] });
    expect(semanaDelCiclo(inicio, "2026-12-09", a)).toMatchObject({ numero: 1, fase: "base", rpe: "7" });
    expect(semanaDelCiclo(inicio, "2026-12-17", a)).toMatchObject({ numero: 2, fase: "carga", rpe: "8" });
    expect(semanaDelCiclo(inicio, "2026-12-24", a)).toMatchObject({ numero: 3, fase: "fuerza", rpe: "8–9" });
    expect(semanaDelCiclo(inicio, "2026-12-31", a)).toMatchObject({ numero: 4, fase: "descarga", rpe: "5–6" });
    expect(semanaDelCiclo(inicio, "2027-01-04", a)).toMatchObject({ numero: 1, fase: "base" });
  });

  it("una semana con 2 días o menos no avanza: se repite", () => {
    const inicio = "2026-12-07";
    const a = asistio({ "2026-12-07": [0, 2], "2026-12-14": [0, 1, 3] });
    expect(semanaDelCiclo(inicio, "2026-12-15", a)).toMatchObject({ numero: 1 }); // la 1.ª no contó
    expect(semanaDelCiclo(inicio, "2026-12-21", a)).toMatchObject({ numero: 2 }); // la 2.ª sí
    // Vacaciones: tres semanas sin ir, el ciclo se queda donde iba.
    expect(semanaDelCiclo(inicio, "2027-01-12", a)).toMatchObject({ numero: 2 });
  });

  it("el mismo día dos veces cuenta una sola", () => {
    const a = [...asistio({ "2026-12-07": [0, 1] }), { fecha: "2026-12-08", asistio: true }, { fecha: "2026-12-09", asistio: false }];
    expect(semanaDelCiclo("2026-12-07", "2026-12-15", a).numero).toBe(1);
  });

  it("las que ya entrenaban arrancan todas en la semana 1 del 23 de noviembre de 2026", () => {
    const antes = asistio({ "2026-09-21": [0, 2, 4], "2026-10-05": [0, 2, 4], "2026-11-16": [0, 2, 4] });
    expect(semanaDelCiclo("2026-09-21", "2026-11-26", antes)).toMatchObject({ numero: 1, fase: "base" });
    const despues = [...antes, ...asistio({ "2026-11-23": [0, 2, 4] })];
    expect(semanaDelCiclo("2026-09-21", "2026-11-30", despues)).toMatchObject({ numero: 2, fase: "carga" });
  });

  it("sin entrenamientos todavía, semana 1 (su ciclo empieza con el primero)", () => {
    expect(semanaDelCiclo(null, "2026-11-26").numero).toBe(1);
    expect(semanaDelCiclo(null, "2027-02-10").numero).toBe(1);
  });

  it("sugiere adelantar la descarga si va muy pesada, y subir el peso si va ligera", () => {
    const carga = semanaDelCiclo("2026-10-01", "2026-12-02", asistio({ "2026-11-23": [0, 2, 4] })); // semana 2, RPE 8
    expect(sugerencia([{ fecha: "2026-11-30", esfuerzo: 10 }, { fecha: "2026-12-01", esfuerzo: 9 }], carga, "2026-12-02")).toEqual({ tipo: "pesada", promedio: 9.5 });
    expect(sugerencia([{ fecha: "2026-11-30", esfuerzo: 6 }, { fecha: "2026-12-01", esfuerzo: 6 }], carga, "2026-12-02")).toEqual({ tipo: "ligera", promedio: 6 });
    expect(sugerencia([{ fecha: "2026-11-30", esfuerzo: 8 }, { fecha: "2026-12-01", esfuerzo: 9 }], carga, "2026-12-02")).toBeNull();
  });

  it("con un solo entrenamiento, de otra semana o en la descarga, no sugiere nada", () => {
    const carga = semanaDelCiclo("2026-10-01", "2026-12-02", asistio({ "2026-11-23": [0, 2, 4] }));
    expect(sugerencia([{ fecha: "2026-12-01", esfuerzo: 10 }], carga, "2026-12-02")).toBeNull();
    expect(sugerencia([{ fecha: "2026-11-25", esfuerzo: 10 }, { fecha: "2026-11-26", esfuerzo: 10 }], carga, "2026-12-02")).toBeNull();
    const descarga = semanaDelCiclo("2026-10-01", "2026-12-16", asistio({ "2026-11-23": [0, 2, 4], "2026-11-30": [0, 2, 4], "2026-12-07": [0, 2, 4] }));
    expect(descarga.fase).toBe("descarga");
    expect(sugerencia([{ fecha: "2026-12-14", esfuerzo: 9 }, { fecha: "2026-12-15", esfuerzo: 9 }], descarga, "2026-12-16")).toBeNull();
  });

  it("la semana que eligió ella manda desde esa semana, y de ahí sigue contando", () => {
    const a = asistio({ "2026-11-23": [0, 2, 4], "2026-11-30": [0, 2, 4], "2026-12-07": [0, 2] });
    const ajuste = { semana: 4, lunes: "2026-11-23" };
    expect(semanaDelCiclo("2026-10-01", "2026-11-26", a, ajuste)).toMatchObject({ numero: 4, fase: "descarga" });
    expect(semanaDelCiclo("2026-10-01", "2026-12-02", a, ajuste)).toMatchObject({ numero: 1, fase: "base" });
    expect(semanaDelCiclo("2026-10-01", "2026-12-09", a, ajuste)).toMatchObject({ numero: 2 });
    expect(semanaDelCiclo("2026-10-01", "2026-12-16", a, ajuste)).toMatchObject({ numero: 2 }); // esa semana fue de 2 días
  });

  it("un ajuste raro (semana fuera de 1 a 4, o de una semana futura) no cuenta", () => {
    expect(semanaDelCiclo(null, "2026-11-26", [], { semana: 7, lunes: "2026-11-23" }).numero).toBe(1);
    expect(semanaDelCiclo(null, "2026-11-26", [], { semana: 3, lunes: "2026-12-07" }).numero).toBe(1);
  });
});
