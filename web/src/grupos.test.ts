import { describe, expect, it } from "vitest";
import type { ConfigGrupos, EjercicioBanco } from "./datos";
import { gruposDelDia, listaDeGrupo, seccionesRegistro } from "./grupos";

describe("gruposDelDia", () => {
  // Los nombres de día reales de las plantillas, tal como están escritos (2026-10-10).
  it.each([
    ["Pecho y espalda ", ["pecho", "espalda"]],
    ["Hombro, biceps y tríceps ", ["hombro", "biceps", "triceps"]],
    ["Pecho, hombro y triceps", ["pecho", "hombro", "triceps"]],
    ["Espalda y biceps", ["espalda", "biceps"]],
    ["Pierna Cuádriceps ", ["cuadriceps", "gluteo", "femoral", "pantorrilla"]],
    ["Pierna (Glúteo)", ["gluteo", "cuadriceps", "femoral", "pantorrilla"]],
    ["Pierna (glúteo)", ["gluteo", "cuadriceps", "femoral", "pantorrilla"]],
    ["Pierna completa", ["cuadriceps", "gluteo", "femoral", "pantorrilla"]],
    ["Superior completo ", ["pecho", "espalda", "hombro", "biceps", "triceps"]],
  ])("%s", (nombre, grupos) => {
    expect(gruposDelDia(nombre)).toEqual(grupos);
  });

  it("entiende plurales y otras formas de escribirlos", () => {
    expect(gruposDelDia("Hombros + Glúteos + abs")).toEqual(["hombro", "gluteo", "abdomen"]);
    expect(gruposDelDia("Brazo")).toEqual(["biceps", "triceps"]);
  });

  it("un nombre sin grupos reconocibles no inventa ninguno", () => {
    expect(gruposDelDia("Día 1")).toEqual([]);
    expect(gruposDelDia("")).toEqual([]);
  });
});

function ej(id: string, grupo: string, nombre = id): EjercicioBanco {
  return { id, nombre, tipo: "peso", grupo, musculos: {}, gifRuta: null };
}

const banco = [
  ej("press-banca", "pecho", "Press de banca"),
  ej("aperturas", "pecho", "Aperturas"),
  ej("press-militar", "hombro", "Press militar"),
  ej("elevaciones", "hombro", "Elevaciones laterales"),
  ej("pushdown", "triceps", "Extensión de tríceps"),
  ej("curl", "biceps", "Curl con barra"),
  ej("sin-grupo", "", "Ejercicio raro"),
];

describe("listaDeGrupo", () => {
  it("sin configurar, salen los del banco de ese grupo en orden alfabético", () => {
    expect(listaDeGrupo("pecho", null, banco).map((e) => e.id)).toEqual(["aperturas", "press-banca"]);
  });

  it("configurado, manda la lista y el orden del entrenador, y salta ids que ya no existen", () => {
    const config: ConfigGrupos = { porGrupo: { pecho: ["press-banca", "borrado", "pushdown"] } };
    expect(listaDeGrupo("pecho", config, banco).map((e) => e.id)).toEqual(["press-banca", "pushdown"]);
  });

  it("una lista configurada vacía se respeta: el entrenador vació el grupo", () => {
    expect(listaDeGrupo("pecho", { porGrupo: { pecho: [] } }, banco)).toEqual([]);
  });
});

describe("seccionesRegistro", () => {
  it("primero los grupos del día en su orden, luego los demás y al final lo que no está en ninguno", () => {
    const s = seccionesRegistro("Pecho, hombro y tríceps", banco, null);
    expect(s.map((x) => [x.titulo, x.delDia])).toEqual([
      ["Pecho", true], ["Hombro", true], ["Tríceps", true], ["Bíceps", false], ["Otros", false],
    ]);
    expect(s[1].ejercicios.map((e) => e.id)).toEqual(["elevaciones", "press-militar"]);
    expect(s[4].ejercicios.map((e) => e.id)).toEqual(["sin-grupo"]);
  });

  it("sin día (fin de semana, sin rutina) salen todos los grupos sin marcar ninguno", () => {
    const s = seccionesRegistro(null, banco, null);
    expect(s.every((x) => !x.delDia)).toBe(true);
    expect(s[0].titulo).toBe("Pecho");
  });

  it("los grupos vacíos no salen", () => {
    expect(seccionesRegistro("Pecho", banco, { porGrupo: { pecho: [] } }).map((x) => x.titulo))
      .not.toContain("Pecho");
  });
});
