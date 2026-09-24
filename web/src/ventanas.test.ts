import { describe, expect, it } from "vitest";
import type { Asistencia, Cliente } from "./datos";
import { VENTANAS, contenidoDe, ventana, type DatosCliente, type IdVentana } from "./ventanas";

const HOY = "2026-09-18"; // viernes

/** Sin rutina: la tarjeta del día pinta su estado vacío, que sirve de marca para el orden. */
const cliente = { nombre: "Ana", activo: true, rutinaAsignada: null, ultimoDia: null,
  ultimoDiaFecha: null, ultimoDiaEsAncla: false } as Cliente;

/** La falta del jueves 17 rompe la racha y es reparable: así aparece la tarjeta de revivir. */
const conFaltaRota: Asistencia[] = [
  { fecha: "2026-09-01", asistio: true, justificada: false },
  { fecha: "2026-09-17", asistio: false, justificada: false },
];

function datos(campos: Partial<DatosCliente> = {}): DatosCliente {
  return {
    cliente, hoy: HOY, asistencias: conFaltaRota, mesVisible: "2026-09", yaAviso: false,
    medallas: [], logros: [], tiradaEsteMes: null, tiradaMesAnterior: null, ...campos,
  };
}

describe("el registro de ventanas", () => {
  it("tiene ids únicos", () => {
    const ids = VENTANAS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("va Inicio, Ranking, Medallas, Logros, Videos y Ajustes al final", () => {
    expect(VENTANAS.map((v) => v.id)).toEqual(
      ["inicio", "ranking", "medallas", "logros", "videos", "ajustes"]
    );
  });

  it("Ajustes es la única del pie", () => {
    expect(VENTANAS.filter((v) => v.grupo === "pie").map((v) => v.id)).toEqual(["ajustes"]);
  });

  it("Ranking y Ajustes son las que están por venir", () => {
    expect(VENTANAS.filter((v) => v.proximamente).map((v) => v.id)).toEqual(["ranking", "ajustes"]);
  });

  it("toda ventana tiene con qué pintarse", () => {
    for (const v of VENTANAS) {
      expect(Boolean(v.pintar || v.contenedorPropio || v.proximamente), v.id).toBe(true);
    }
  });

  it("un id desconocido cae en Inicio", () => {
    expect(ventana("nada" as IdVentana).id).toBe("inicio");
  });
});

describe("la ventana Inicio", () => {
  const html = contenidoDe(ventana("inicio"), datos());

  it("va día, racha, revivir y calendario, en ese orden", () => {
    const dia = html.indexOf("Todavía no tienes rutina");
    const racha = html.indexOf("Tu racha");
    const revivir = html.indexOf("Revivir mi racha");
    const cal = html.indexOf(`id="mes-anterior"`);
    expect([dia, racha, revivir, cal].every((i) => i > -1)).toBe(true);
    expect(dia).toBeLessThan(racha);
    expect(racha).toBeLessThan(revivir);
    expect(revivir).toBeLessThan(cal);
  });

  it("ya no trae medallas, logros ni videos", () => {
    expect(html).not.toContain("Tus medallas");
    expect(html).not.toContain("Tus logros personales");
    expect(html).not.toContain("Tus videos de resumen");
  });
});

describe("las demás ventanas", () => {
  it("Medallas y Logros pintan su tarjeta", () => {
    expect(contenidoDe(ventana("medallas"), datos())).toContain("Tus medallas");
    expect(contenidoDe(ventana("logros"), datos())).toContain("Tus logros personales");
  });

  it("las que están por venir dicen Muy pronto", () => {
    expect(contenidoDe(ventana("ranking"), datos())).toContain("Muy pronto");
    expect(contenidoDe(ventana("ajustes"), datos())).toContain("Muy pronto");
  });

  it("Videos no pinta nada en #contenido: vive en su propio contenedor", () => {
    expect(contenidoDe(ventana("videos"), datos())).toBe("");
  });
});
