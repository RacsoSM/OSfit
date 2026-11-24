import { describe, expect, it } from "vitest";
import type { ResumenMensual } from "../resumenMensual";
import {
  abrirHistoria, cerrarHistoria, elegirMes, historiaAbierta, historiasDelMes, mesElegidoResumen, reiniciarResumenMensual,
  ventanaResumenMensual, type DatosResumenMensual,
} from "./resumenMensual";

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

const ids = (d: DatosResumenMensual) => historiasDelMes(d).map((h) => h.id);
const todo = (d: DatosResumenMensual) => historiasDelMes(d).map((h) => h.html).join("");

describe("la lista de meses", () => {
  it("pregunta qué mes quiere ver, con cada mes como botón; sin historia abierta", () => {
    cerrarHistoria();
    const html = ventanaResumenMensual(datos());
    expect(html).toContain("¿Qué mes quieres ver?");
    expect(html).toContain('data-rm-mes="2026-10"');
    expect(html).toContain('data-rm-mes="2026-08"');
    expect(html).toContain("En curso · al 28");
    expect(html).toContain("Cerrado");
    expect(html).not.toContain("rh-visor");
  });

  it("sin meses: vacío, o cargando mientras llegan", () => {
    expect(ventanaResumenMensual(datos({ meses: [], mes: null, resumen: null }))).toContain("Todavía no hay meses que resumir.");
    expect(ventanaResumenMensual(datos({ meses: [], mes: null, resumen: null, cargando: true }))).toContain("Cargando tus meses");
  });
});

describe("las historias", () => {
  it("van en orden: portada, entrenamiento, constancia, fuerza, marcas y el final", () => {
    expect(ids(datos())).toEqual(["portada", "entrenamiento", "constancia", "fuerza", "marcas", "final"]);
  });

  it("al elegir un mes se abre a pantalla completa, con una barra de progreso por historia", () => {
    abrirHistoria("2026-10");
    const html = ventanaResumenMensual(datos());
    expect(historiaAbierta()).toBe(true);
    expect(html).toContain("rh-visor");
    expect(html.match(/rh-pagina /g)).toHaveLength(6);
    expect(html.match(/<span class="(actual|vista|)"><\/span>/g)).toHaveLength(6);
    cerrarHistoria();
    expect(historiaAbierta()).toBe(false);
  });

  it("una sección sin datos no tiene historia", () => {
    const sinSesiones = resumen({
      entrenamiento: { sesiones: 0, kg: 0, series: 0, reps: 0, top: [], diaFavorito: null },
      fuerza: null, marcas: [],
    });
    expect(ids(datos({ resumen: sinSesiones }))).toEqual(["portada", "constancia", "final"]);
  });

  it("entrenamiento: kg, series, reps y lo que más hizo, escapado", () => {
    const html = todo(datos());
    expect(html).toContain("59,123 <small>kg</small>");
    expect(html).toContain("176");
    expect(html).toContain("1,360");
    expect(html).toContain("Extensión &lt;con&gt; cuerda");
  });

  it("constancia: % de asistencia, el calendario con hoy marcado, conteos, racha y tiempo", () => {
    const html = todo(datos());
    expect(html).toContain("53 <small>%</small>");
    expect(html).toContain("rm-e hoy-celda");
    expect(html).toContain("tu racha más larga");
    expect(html).toContain("17 h <small>24 min</small>");
    expect(html).toMatch(/class="rm-e"/);
    expect(html).not.toMatch(/class="ok /);
    const cerrado = todo(datos({ mes: "2026-09", enCurso: false, resumen: resumen({ mes: "2026-09" }) }));
    expect(cerrado).not.toContain("hoy-celda");
  });

  it("fuerza: rango general, primer mes sin anterior y flechas con él", () => {
    expect(todo(datos())).toContain("primer mes con datos");
    const conCambios = todo(datos({ cambios: { pecho: 0.4, abdomen: -0.25 } }));
    expect(conCambios).not.toContain("primer mes con datos");
    expect(conCambios).toContain("↑ 0.40");
    expect(conCambios).toContain("↓ 0.25");
    expect(conCambios).toContain(">Avanzado<");
  });

  it("marcas: kg × reps en los de peso y reps en los corporales", () => {
    const html = todo(datos());
    expect(html).toContain("100 kg × 4");
    expect(html).toContain("30 reps");
  });

  it("no dice cuántos entrenamientos registró ni su día favorito (entrenador, 2026-10-28)", () => {
    const html = todo(datos());
    expect(html).not.toContain("entrenamientos registrados");
    expect(html).not.toMatch(/día favorito/i);
    expect(html).not.toContain("Hombro &amp; bíceps");
  });

  it("el final resume y deja ver otra vez o cerrar", () => {
    const html = todo(datos());
    expect(html).toContain("Tu octubre en resumen");
    expect(html).toContain('data-rh="otra-vez"');
    expect(html).toContain('data-rh="cerrar"');
  });
});

describe("mes elegido", () => {
  it("sobrevive hasta que se reinicia, y reiniciar cierra la historia", () => {
    elegirMes("2026-09");
    expect(mesElegidoResumen()).toBe("2026-09");
    abrirHistoria("2026-09");
    reiniciarResumenMensual();
    expect(mesElegidoResumen()).toBeNull();
    expect(historiaAbierta()).toBe(false);
  });
});
