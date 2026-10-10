import { beforeEach, describe, expect, it } from "vitest";
import type { EjercicioBanco, Sesion } from "../datos";
import { indiceBanco } from "../banco";
import { agregarEjercicio, nuevoBorrador } from "../registro";
import { ponerEstadoRegistro, ventanaRegistro, type DatosRegistro } from "./registro";

const press: EjercicioBanco = {
  id: "press-banca", nombre: "Press de banca", alias: ["press banca"], tipo: "peso", grupo: "pecho",
  musculos: { pecho: 1 }, gifRuta: "ejercicios/press-banca.webp",
};
const plancha: EjercicioBanco = {
  id: "plancha", nombre: "Plancha", tipo: "tiempo", grupo: "abdomen", musculos: { abdomen: 1 }, gifRuta: null,
};
const banco = [press, plancha];

function datos(campos: Partial<DatosRegistro> = {}): DatosRegistro {
  return {
    hoy: "2026-10-12",
    dia: { nombreDia: "Pecho", ejercicios: [{ nombre: "Press banca", series: 4, repeticiones: "10", pesoONota: "" }] },
    banco,
    indice: indiceBanco(banco),
    sesiones: [],
    config: null,
    ...campos,
  };
}

beforeEach(() => ponerEstadoRegistro({ vista: "historial", borrador: null }));

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
  it("agrupa por los grupos del día, con el GIF de cada ejercicio, y luego los demás", () => {
    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12") });
    const html = ventanaRegistro(datos());
    expect(html).toContain("Hoy te toca Pecho");
    expect(html.indexOf(">Pecho<")).toBeLessThan(html.indexOf("Más ejercicios"));
    expect(html.indexOf("Más ejercicios")).toBeLessThan(html.indexOf(">Abdomen<"));
    expect(html).toContain("ejercicios%2Fpress-banca.webp");
    expect(html).toContain('data-agregar="plancha"');
    expect(html).toContain("registro-sin-gif");
    expect(html).toContain("© Gym visual");
    expect(html).not.toContain("registro-buscar");
  });

  it("respeta la lista que configuró el entrenador para cada grupo", () => {
    ponerEstadoRegistro({ vista: "elegir", borrador: nuevoBorrador("b1234567", "2026-10-12") });
    const html = ventanaRegistro(datos({ config: { porGrupo: { pecho: ["plancha"] } } }));
    const pecho = html.slice(html.indexOf(">Pecho<"), html.indexOf("Más ejercicios"));
    expect(pecho).toContain('data-agregar="plancha"');
    expect(pecho).not.toContain('data-agregar="press-banca"');
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
