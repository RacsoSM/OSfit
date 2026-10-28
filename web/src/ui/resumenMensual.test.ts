import { describe, expect, it } from "vitest";
import type { ResumenMensual } from "../resumenMensual";
import { elegirMes, mesElegidoResumen, reiniciarResumenMensual, ventanaResumenMensual, type DatosResumenMensual } from "./resumenMensual";

const resumen = (x: Partial<ResumenMensual> = {}): ResumenMensual => ({
  mes: "2026-10",
  version: 1,
  asistencia: {
    entreno: 10, justificadas: 7, faltas: 2, porcentaje: 53, minutos: 1044, visitasConMinutos: 7,
    rachaMasLarga: 12, dias: { "01": "f", "02": "j", "08": "e", "28": "e" },
  },
  entrenamiento: {
    sesiones: 8, kg: 59123, series: 176, reps: 1360,
    top: [{ ejercicioId: "cuerda", nombre: "Extensión <con> cuerda", veces: 3 }, { ejercicioId: "curl", nombre: "Curl", veces: 1 }],
    diaFavorito: { indice: 1, nombre: "Hombro & bíceps", veces: 4 },
  },
  fuerza: { general: 7.06, musculos: { pecho: 8, abdomen: 5.61 } },
  marcas: [
    { ejercicioId: "banca", nombre: "Press de banca", tipo: "peso", reps: 4, peso: 100, nivel: 7.7 },
    { ejercicioId: "lag", nombre: "Lagartijas", tipo: "corporal", reps: 30, peso: null, nivel: 5 },
  ],
  ...x,
});

const datos = (x: Partial<DatosResumenMensual> = {}): DatosResumenMensual => ({
  cargando: false,
  meses: [{ mes: "2026-10", enCurso: true }, { mes: "2026-09", enCurso: false }, { mes: "2026-08", enCurso: false }],
  mes: "2026-10",
  resumen: resumen(),
  enCurso: true,
  hoy: "2026-10-28",
  sexo: "H",
  cambios: null,
  ...x,
});

describe("ventanaResumenMensual", () => {
  it("las secciones van en el orden del diseño: selector, portada, entrenamiento, calendario, fuerza, marcas", () => {
    const html = ventanaResumenMensual(datos());
    const orden = ["rm-selector", "rm-portada", "Entrenamiento", "rm-cal", "Fuerza", "Mejores marcas"].map((t) => html.indexOf(t));
    expect(orden.every((p) => p >= 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
  });

  it("la portada: % de asistencia, kg en kg y tiempo en el gym", () => {
    const html = ventanaResumenMensual(datos());
    expect(html).toContain("53 %");
    expect(html).toContain("59,123 <small>kg</small>");
    expect(html).toContain("17 h <small>24 min</small>");
    expect(html).toContain("En curso · al 28");
    expect(html).not.toContain(" t<");
  });

  it("un mes cerrado no dice 'en curso' ni la línea de cierre, y no marca hoy", () => {
    const html = ventanaResumenMensual(datos({ mes: "2026-09", enCurso: false, resumen: resumen({ mes: "2026-09" }) }));
    expect(html).toContain("Cerrado");
    expect(html).not.toContain("Se cierra el");
    expect(html).not.toContain("hoy-celda");
  });

  it("el mes en curso dice cuándo se cierra y marca hoy en el calendario", () => {
    const html = ventanaResumenMensual(datos());
    expect(html).toContain("Al 28 de octubre. Se cierra el 1 de noviembre.");
    expect(html).toContain("rm-e hoy-celda");
  });

  it("selector: un select sin escribir, con flechas que se apagan en las orillas", () => {
    const enLaPunta = ventanaResumenMensual(datos());
    expect(enLaPunta).toContain('<select class="rm-select" id="rm-mes"');
    expect(enLaPunta).toMatch(/id="rm-siguiente"[^>]*disabled/);
    expect(enLaPunta).toContain('data-mes="2026-09"');
    expect(enLaPunta).toContain("Octubre 2026 · en curso");
    const alFinal = ventanaResumenMensual(datos({ mes: "2026-08", enCurso: false, resumen: resumen({ mes: "2026-08" }) }));
    expect(alFinal).toMatch(/id="rm-anterior"[^>]*disabled/);
    expect(alFinal).toContain('data-mes="2026-09"');
  });

  it("escapa los nombres que vienen de Firestore", () => {
    const html = ventanaResumenMensual(datos());
    expect(html).toContain("Extensión &lt;con&gt; cuerda");
    expect(html).toContain("Hombro &amp; bíceps");
  });

  it("una sección sin datos no se pinta", () => {
    const sinSesiones = resumen({
      entrenamiento: { sesiones: 0, kg: 0, series: 0, reps: 0, top: [], diaFavorito: null },
      fuerza: null, marcas: [],
    });
    const html = ventanaResumenMensual(datos({ resumen: sinSesiones }));
    expect(html).not.toContain(">Entrenamiento<");
    expect(html).not.toContain(">Fuerza<");
    expect(html).not.toContain("Mejores marcas");
    expect(html).toContain("rm-cal");
    expect(html).toMatch(/rm-num">—/);
  });

  it("fuerza: 'Primer mes con datos' sin anterior; flechas de cambio con él", () => {
    expect(ventanaResumenMensual(datos())).toContain("Primer mes con datos");
    const conCambios = ventanaResumenMensual(datos({ cambios: { pecho: 0.4, abdomen: -0.25 } }));
    expect(conCambios).not.toContain("Primer mes con datos");
    expect(conCambios).toContain("↑ 0.40");
    expect(conCambios).toContain("↓ 0.25");
    expect(conCambios).toContain("Rango general: <strong>Avanzado</strong>");
  });

  it("marcas: kg × reps en los de peso y reps en los corporales", () => {
    const html = ventanaResumenMensual(datos());
    expect(html).toContain("100 kg × 4");
    expect(html).toContain("30 reps");
  });

  it("sin meses: vacío, o cargando mientras llegan", () => {
    expect(ventanaResumenMensual(datos({ meses: [], mes: null, resumen: null }))).toContain("Todavía no hay meses que resumir.");
    expect(ventanaResumenMensual(datos({ meses: [], mes: null, resumen: null, cargando: true }))).toContain("Cargando tus meses");
  });
});

describe("mes elegido", () => {
  it("sobrevive hasta que se reinicia", () => {
    elegirMes("2026-09");
    expect(mesElegidoResumen()).toBe("2026-09");
    reiniciarResumenMensual();
    expect(mesElegidoResumen()).toBeNull();
  });
});
