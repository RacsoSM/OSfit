import { beforeEach, describe, expect, it } from "vitest";
import type { EjercicioBanco, Sesion } from "../datos";
import { indiceBanco } from "../banco";
import { agregarEjercicio, nuevoBorrador } from "../registro";
import { ponerEstadoRegistro, ventanaRegistro, type DatosRegistro } from "./registro";

const press: EjercicioBanco = {
  id: "press-banca", nombre: "Press de banca", alias: ["press banca"], tipo: "peso",
  musculos: { pecho: 1 }, gifRuta: "ejercicios/press-banca.webp",
};
const plancha: EjercicioBanco = {
  id: "plancha", nombre: "Plancha", tipo: "tiempo", musculos: { abdomen: 1 }, gifRuta: null,
};
const banco = [press, plancha];

function datos(campos: Partial<DatosRegistro> = {}): DatosRegistro {
  return {
    hoy: "2026-10-12",
    dia: { nombreDia: "Pecho", ejercicios: [{ nombre: "Press banca", series: 4, repeticiones: "10", pesoONota: "" }] },
    banco,
    indice: indiceBanco(banco),
    sesiones: [],
    ...campos,
  };
}

beforeEach(() => ponerEstadoRegistro({ vista: "historial", borrador: null, busqueda: "" }));

describe("historial", () => {
  it("lista las sesiones con sus series; las de tiempo en segundos", () => {
    const sesiones: Sesion[] = [{
      id: "s1", fecha: "2026-10-12", origen: "manual",
      ejercicios: [
        { ejercicioId: "press-banca", nombre: "Press de banca", series: [{ reps: 10, peso: 40 }, { reps: 8, peso: 42.5 }] },
        { ejercicioId: "plancha", nombre: "Plancha", series: [{ reps: 45, peso: null }] },
      ],
    }];
    const html = ventanaRegistro(datos({ sesiones }));
    expect(html).toContain("lunes, 12 de octubre");
    expect(html).toContain("40 kg × 10 · 42.5 kg × 8");
    expect(html).toContain("45 s");
  });

  it("con un borrador pendiente ofrece continuarlo en vez de empezar otro", () => {
    ponerEstadoRegistro({ borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 1) });
    const html = ventanaRegistro(datos());
    expect(html).toContain("Tienes un registro sin guardar");
    expect(html).not.toContain("+ Agregar ejercicio");
  });
});

describe("elegir", () => {
  it("muestra los ejercicios del día con su GIF y, sin búsqueda, nada más", () => {
    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12") });
    const html = ventanaRegistro(datos());
    expect(html).toContain("De tu día de hoy · Pecho");
    expect(html).toContain('data-agregar="press-banca"');
    expect(html).toContain("ejercicios%2Fpress-banca.webp");
    expect(html).not.toContain('data-agregar="plancha"');
  });

  it("la búsqueda encuentra cualquiera del banco, aunque no tenga GIF", () => {
    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12"), busqueda: "planch" });
    const html = ventanaRegistro(datos({ dia: null }));
    expect(html).toContain('data-agregar="plancha"');
    expect(html).toContain("registro-sin-gif");
  });

  it("marca lo que ya agregó", () => {
    ponerEstadoRegistro({ vista: "elegir", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 1) });
    expect(ventanaRegistro(datos())).toContain("✓ Agregado");
  });
});

describe("capturar", () => {
  it("pide kg y reps en los de peso, y solo segundos en los de tiempo", () => {
    let b = agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 2);
    b = agregarEjercicio(b, plancha, null, 1);
    ponerEstadoRegistro({ vista: "capturar", borrador: b });
    const html = ventanaRegistro(datos());
    expect(html.match(/data-campo="peso"/g)).toHaveLength(2);
    expect(html.match(/data-campo="reps"/g)).toHaveLength(3);
    expect(html).toContain(">seg<");
    expect(html).toContain("Guardar entrenamiento");
  });

  it("sin ejercicios no se queda en una pantalla vacía", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: nuevoBorrador("b1234567", "2026-10-12") });
    expect(ventanaRegistro(datos())).toContain("+ Agregar ejercicio");
  });
});
