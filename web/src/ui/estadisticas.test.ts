import { beforeEach, describe, expect, it } from "vitest";
import type { EjercicioBanco, Sesion } from "../datos";
import { reiniciarEstadisticas, ventanaEstadisticas, type DatosEstadisticas } from "./estadisticas";

const press: EjercicioBanco = {
  id: "press-banca", nombre: "Press de banca", tipo: "peso", musculos: { pecho: 1, triceps: 0.5 },
  gifRuta: "ejercicios/press-banca.webp",
  estandares: { H: [0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.3, 1.7], M: [0.25, 0.4, 0.5, 0.6, 0.75, 0.8, 0.85, 1.3] },
};
const plancha: EjercicioBanco = { id: "plancha", nombre: "Plancha", tipo: "tiempo", musculos: { abdomen: 1 } };
const banco = [press, plancha];
const sesiones: Sesion[] = [
  { id: "a", fecha: "2026-10-16", origen: "manual", ejercicios: [{ ejercicioId: "press-banca", nombre: "Press de banca", series: [{ reps: 5, peso: 62.5 }] }] },
  { id: "b", fecha: "2026-09-01", origen: "manual", ejercicios: [{ ejercicioId: "plancha", nombre: "Plancha", series: [{ reps: 45, peso: null }] }] },
];

function datos(campos: Partial<DatosEstadisticas> = {}): DatosEstadisticas {
  return {
    sesiones, cargandoHistorial: false, banco, hoy: "2026-10-20", sexo: "M",
    perfil: { sexo: "M", peso: 60, edad: null }, fuerza: {}, peso: 60, ...campos,
  };
}

beforeEach(() => reiniciarEstadisticas());

describe("ventanaEstadisticas", () => {
  it("sin ningún entrenamiento invita a registrar el primero", () => {
    const html = ventanaEstadisticas(datos({ sesiones: [] }));
    expect(html).toContain("Registra tu primer entrenamiento");
    expect(html).toContain(`data-estad="registro"`);
  });

  it("mientras no llega nada, el esqueleto de carga", () => {
    expect(ventanaEstadisticas(datos({ sesiones: null }))).toContain(`role="status"`);
  });

  it("abre en el ejercicio más reciente, con la tarjeta de Cambiar", () => {
    const html = ventanaEstadisticas(datos());
    expect(html).toContain("<strong>Press de banca</strong>");
    expect(html).toContain(`data-estad="cambiar"`);
    expect(html).toContain("Cambiar ›");
  });

  it("un ejercicio de peso trae sus datos clave y los dos apartados de la gráfica", () => {
    const html = ventanaEstadisticas(datos());
    expect(html).toContain("1RM estimado");
    expect(html).toContain("Kg levantados");
    expect(html).toContain("Reps totales");
    expect(html).toContain(`data-estad-modo="1rm" aria-pressed="true"`);
    expect(html).toContain(`data-estad-modo="sesiones" aria-pressed="false"`);
    expect(html).toContain("Tus sesiones");
    expect(html).toContain("62.5 kg × 5");
  });

  it("avisa mientras falta el historial completo", () => {
    expect(ventanaEstadisticas(datos({ cargandoHistorial: true }))).toContain("Cargando todo tu historial");
  });
});
