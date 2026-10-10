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

beforeEach(() => ponerEstadoRegistro({ vista: "inicio", borrador: null }));

/** Un Timestamp de Firestore de mentiras: la vista solo usa `toDate()`. */
const ts = (iso: string) => ({ toDate: () => new Date(iso) }) as unknown as Sesion["creada"];

describe("inicio", () => {
  it("sin entrenamiento abierto ofrece iniciarlo y no deja agregar ejercicios sueltos", () => {
    const html = ventanaRegistro(datos());
    expect(html).toContain("▶ Iniciar entrenamiento");
    expect(html).not.toContain("+ Agregar ejercicio");
  });

  it("lleva al historial con la fecha del último entrenamiento", () => {
    const sesiones: Sesion[] = [
      { id: "s2", fecha: "2026-10-12", origen: "manual", ejercicios: [] },
      { id: "s1", fecha: "2026-10-09", origen: "manual", ejercicios: [] },
    ];
    const html = ventanaRegistro(datos({ sesiones }));
    expect(html).toContain('data-accion="historial"');
    expect(html).toContain("Último: lunes, 12 de octubre · 2 entrenamientos");
  });

  it("con un entrenamiento abierto, Registro se abre en él", () => {
    ponerEstadoRegistro({ vista: "inicio", borrador: nuevoBorrador("b1234567", "2026-10-12", Date.UTC(2026, 9, 12, 17, 32)) });
    const html = ventanaRegistro(datos());
    expect(html).toContain("Entrenamiento en curso");
    expect(html).toContain("desde las 10:32");
    expect(html).toContain("Agrega tu primer ejercicio");
    expect(html).not.toContain("Iniciar entrenamiento");
  });
});

describe("historial", () => {
  it("cada entrenamiento con su fecha, horario, duración y series; las de tiempo en segundos", () => {
    ponerEstadoRegistro({ vista: "historial", borrador: null });
    const sesiones: Sesion[] = [{
      id: "s1", fecha: "2026-10-12", origen: "manual",
      iniciada: ts("2026-10-12T17:32:00Z"), creada: ts("2026-10-12T18:20:00Z"),
      ejercicios: [
        { ejercicioId: "press-banca", nombre: "Press de banca", series: [{ reps: 10, peso: 40 }, { reps: 8, peso: 42.5 }] },
        { ejercicioId: "plancha", nombre: "Plancha", series: [{ reps: 45, peso: null }] },
      ],
    }];
    const html = ventanaRegistro(datos({ sesiones }));
    expect(html).toContain("Tu historial");
    expect(html).toContain("lunes, 12 de octubre");
    expect(html).toMatch(/10:32.*–.*11:20.*· 48 min · 2 ejercicios/);
    expect(html).toContain("40 kg × 10 · 42.5 kg × 8");
    expect(html).toContain("45 s");
  });

  it("una sesión vieja sin hora de inicio muestra solo cuándo terminó", () => {
    ponerEstadoRegistro({ vista: "historial", borrador: null });
    const sesiones: Sesion[] = [{ id: "s1", fecha: "2026-10-12", origen: "manual", creada: ts("2026-10-12T18:20:00Z"), ejercicios: [] }];
    expect(ventanaRegistro(datos({ sesiones }))).toMatch(/Terminado a las 11:20/);
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

  it("lo que ya está en el entrenamiento sale deshabilitado", () => {
    ponerEstadoRegistro({ vista: "elegir", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 1) });
    const html = ventanaRegistro(datos());
    expect(html).toMatch(/class="registro-opcion agregado" data-agregar="press-banca"\s+disabled/);
    expect(html).toContain("✓ Ya en tu entrenamiento");
    expect(html).not.toMatch(/data-agregar="plancha"\s+disabled/);
  });
});

describe("capturar", () => {
  it("el activo va en grande con sus campos; los demás comprimidos arriba y abajo", () => {
    let b = agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 2);
    b = agregarEjercicio(b, plancha, null, 1);
    b = agregarEjercicio(b, { ...press, id: "otro", nombre: "Otro" }, null, 1);
    ponerEstadoRegistro({ vista: "capturar", borrador: b, activo: 1 });
    const html = ventanaRegistro(datos());
    // Solo la plancha (activa) tiene campos: segundos y sin kg.
    expect(html.match(/data-campo="reps"/g)).toHaveLength(1);
    expect(html).not.toContain('data-campo="peso"');
    expect(html).toContain(">seg<");
    // Press arriba, Otro abajo, comprimidos.
    expect(html.indexOf('class="registro-compacto" data-activar="0"')).toBeLessThan(html.indexOf("registro-ejercicio activo"));
    expect(html.indexOf("registro-ejercicio activo")).toBeLessThan(html.indexOf('class="registro-compacto" data-activar="2"'));
    expect(html).toContain("2 de 3");
    expect(html).toContain("Sin anotar");
  });

  it("sin elegir uno, el activo es el último agregado", () => {
    let b = agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 2);
    b = agregarEjercicio(b, plancha, null, 1);
    ponerEstadoRegistro({ vista: "capturar", borrador: b });
    const html = ventanaRegistro(datos());
    expect(html).toMatch(/registro-ejercicio activo" data-indice="1"/);
    expect(html).toContain('data-activar="0"');
  });

  it("con un solo ejercicio no muestra Anterior/Siguiente", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 2) });
    const html = ventanaRegistro(datos());
    expect(html).not.toContain("Siguiente");
    expect(html.match(/data-campo="peso"/g)).toHaveLength(2);
  });

  it("termina el entrenamiento en vez de solo guardarlo", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: agregarEjercicio(nuevoBorrador("b1234567", "2026-10-12"), press, null, 1) });
    const html = ventanaRegistro(datos());
    expect(html).toContain("Terminar entrenamiento");
    expect(html).toContain("Descartar entrenamiento");
  });

  it("sin entrenamiento abierto no hay qué capturar: vuelve al inicio", () => {
    ponerEstadoRegistro({ vista: "capturar", borrador: null });
    expect(ventanaRegistro(datos())).toContain("Iniciar entrenamiento");
  });
});
