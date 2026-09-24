import { describe, expect, it } from "vitest";
import {
  armarRanking,
  asistenciaDesdeDoc,
  clienteDesdeDoc,
  type AsistenciaParaRanking,
  type ClienteParaRanking,
} from "./ranking";

const HOY = "2026-09-10"; // jueves

const cliente = (id: string, nombre: string, activo = true): ClienteParaRanking => ({ id, nombre, activo });

/** `dias` dias habiles seguidos terminando ayer (miercoles 09), asi la racha actual es `dias`. */
function racha(clienteId: string, dias: number): AsistenciaParaRanking[] {
  const habiles = ["2026-09-09", "2026-09-08", "2026-09-07", "2026-09-04", "2026-09-03", "2026-09-02", "2026-09-01"];
  return habiles.slice(0, dias).map((fecha) => ({ clienteId, fecha, asistio: true, justificada: false }));
}

describe("armarRanking", () => {
  it("ordena por racha descendente", () => {
    const r = armarRanking(
      [cliente("a", "Ana"), cliente("b", "Beto"), cliente("c", "Carla")],
      [...racha("a", 2), ...racha("b", 5), ...racha("c", 3)],
      "a",
      HOY
    );
    expect(r.actual.map((f) => [f.puesto, f.nombre, f.racha])).toEqual([
      [1, "Beto", 5],
      [2, "Carla", 3],
      [3, "Ana", 2],
    ]);
  });

  // Ranking denso (1,1,2,2), no de competencia (1,1,3,3): en un top visible, un empate en el
  // 1 no debe hacer que el siguiente puesto distinto se lea como "3". Hallazgo del uso real:
  // con dos empates seguidos se veian como si los puestos se saltaran.
  it("los empates comparten puesto y van en orden alfabetico, sin saltar puestos", () => {
    const r = armarRanking(
      [cliente("z", "Zoe"), cliente("a", "Ana"), cliente("m", "Mario")],
      [...racha("z", 3), ...racha("a", 3), ...racha("m", 1)],
      "m",
      HOY
    );
    expect(r.actual.map((f) => [f.puesto, f.nombre])).toEqual([
      [1, "Ana"],
      [1, "Zoe"],
      [2, "Mario"],
    ]);
  });

  it("dos empates seguidos no se saltan puestos (1,1,2,2)", () => {
    const r = armarRanking(
      [cliente("b", "Brianda"), cliente("c", "Carito"), cliente("e", "Estela"), cliente("k", "Kevin")],
      [...racha("b", 5), ...racha("c", 5), ...racha("e", 3), ...racha("k", 3)],
      "b",
      HOY
    );
    expect(r.actual.map((f) => [f.puesto, f.nombre])).toEqual([
      [1, "Brianda"],
      [1, "Carito"],
      [2, "Estela"],
      [2, "Kevin"],
    ]);
  });

  it("los inactivos quedan fuera de la actual y dentro de la historica", () => {
    const r = armarRanking(
      [cliente("a", "Ana"), cliente("x", "Xime", false)],
      [...racha("a", 1), ...racha("x", 4)],
      "a",
      HOY
    );
    expect(r.actual.map((f) => f.nombre)).toEqual(["Ana"]);
    expect(r.historica.map((f) => [f.puesto, f.nombre, f.racha])).toEqual([
      [1, "Xime", 4],
      [2, "Ana", 1],
    ]);
  });

  it("la historica usa la corrida mas larga, no la actual", () => {
    const asistencias: AsistenciaParaRanking[] = [
      // mar 01 a vie 04: 4 seguidos; falta lun 07; mie 09: 1
      ...["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-09"].map((fecha) => ({
        clienteId: "a", fecha, asistio: true, justificada: false,
      })),
    ];
    const r = armarRanking([cliente("a", "Ana")], asistencias, "a", HOY);
    expect(r.actual[0].racha).toBe(1); // mie 09 cuenta; el martes 08 falta y corta
    expect(r.historica[0].racha).toBe(4);
  });

  it("marca solo la fila de quien pide", () => {
    const r = armarRanking([cliente("a", "Ana"), cliente("b", "Beto")], [...racha("a", 1), ...racha("b", 2)], "a", HOY);
    expect(r.actual.filter((f) => f.esTuyo).map((f) => f.nombre)).toEqual(["Ana"]);
    expect(r.historica.filter((f) => f.esTuyo).map((f) => f.nombre)).toEqual(["Ana"]);
  });

  // Review Focus: sin asistencias aparece con 0, al fondo.
  it("un cliente sin asistencias aparece con racha 0 al fondo", () => {
    const r = armarRanking([cliente("n", "Nuevo"), cliente("a", "Ana")], racha("a", 2), "n", HOY);
    expect(r.actual.map((f) => [f.puesto, f.nombre, f.racha])).toEqual([
      [1, "Ana", 2],
      [2, "Nuevo", 0],
    ]);
    expect(r.historica.at(-1)).toEqual({ puesto: 2, nombre: "Nuevo", racha: 0, esTuyo: true });
  });

  // Review Focus: asistencias de un cliente borrado no crean filas.
  it("ignora asistencias de clientes que ya no existen", () => {
    const r = armarRanking([cliente("a", "Ana")], [...racha("a", 1), ...racha("borrado", 5)], "a", HOY);
    expect(r.historica.map((f) => f.nombre)).toEqual(["Ana"]);
  });

  it("sin clientes devuelve listas vacias", () => {
    expect(armarRanking([], [], "a", HOY)).toEqual({ actual: [], historica: [] });
  });

  it("las filas solo llevan puesto, nombre, racha y esTuyo", () => {
    const r = armarRanking([cliente("a", "Ana")], racha("a", 1), "a", HOY);
    expect(Object.keys(r.actual[0]).sort()).toEqual(["esTuyo", "nombre", "puesto", "racha"]);
  });
});

describe("normalizacion de documentos", () => {
  it("un cliente sin nombre queda como 'Sin nombre' y sin activo cuenta como inactivo", () => {
    expect(clienteDesdeDoc("a", {})).toEqual({ id: "a", nombre: "Sin nombre", activo: false });
    expect(clienteDesdeDoc("b", { nombre: 42, activo: "si" })).toEqual({ id: "b", nombre: "Sin nombre", activo: false });
    expect(clienteDesdeDoc("c", { nombre: "Caro", activo: true })).toEqual({ id: "c", nombre: "Caro", activo: true });
  });

  it("una asistencia sin fecha o sin clienteId se descarta", () => {
    expect(asistenciaDesdeDoc({ clienteId: "a", asistio: true })).toBeNull();
    expect(asistenciaDesdeDoc({ fecha: "2026-09-08", asistio: true })).toBeNull();
    expect(asistenciaDesdeDoc({ clienteId: "a", fecha: "2026-09-08", asistio: true })).toEqual({
      clienteId: "a", fecha: "2026-09-08", asistio: true, justificada: false,
    });
  });

  // Fix tras revisión final: una fecha con formato invalido tumbaba obtenerRanking para TODOS
  // los clientes (moverDias truena con Date invalido), y sin tope rachaMasLarga podia iterar
  // cientos de miles de dias sobre un typo como "0026-09-08".
  it("una fecha que no cumple AAAA-MM-DD se descarta, no solo si falta", () => {
    expect(asistenciaDesdeDoc({ clienteId: "a", fecha: "", asistio: true })).toBeNull();
    expect(asistenciaDesdeDoc({ clienteId: "a", fecha: "2026-9-8", asistio: true })).toBeNull();
    expect(asistenciaDesdeDoc({ clienteId: "a", fecha: "no-es-fecha", asistio: true })).toBeNull();
  });
});
