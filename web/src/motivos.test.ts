import { describe, expect, it } from "vitest";
import { MOTIVOS, motivosPara } from "./motivos";

const ids = (nombre: string) => motivosPara(nombre).map((m) => m.id);

describe("MOTIVOS", () => {
  it("el catalogo tiene los seis motivos", () => {
    expect(MOTIVOS.map((m) => m.id)).toEqual([
      "lunes",
      "ausencia",
      "adelantar",
      "reservado",
      "fragil",
      "otro",
    ]);
  });

  it("solo el de texto libre habilita el campo", () => {
    expect(MOTIVOS.filter((m) => m.libre).map((m) => m.id)).toEqual(["otro"]);
  });
});

describe("motivosPara", () => {
  it("los cinco motivos generales no dependen de quien mire", () => {
    // Ni la fecha ni el historial los filtran ya: el único condicional es el de la broma.
    expect(ids("Quien Sea")).toEqual(["lunes", "ausencia", "adelantar", "reservado", "otro"]);
  });

  it("ofrece el de la broma a quien esta en la lista", () => {
    expect(ids("Estela")).toContain("fragil");
    expect(ids("Dulce")).toContain("fragil");
    expect(ids("Carito")).toContain("fragil");
  });

  it("basta el nombre de pila: casa con el apellido detras", () => {
    expect(ids("Estela Ramírez")).toContain("fragil");
  });

  it("no lo ofrece a quien no esta en la lista", () => {
    expect(ids("Marisol")).not.toContain("fragil");
  });

  it("ignora acentos, mayusculas y espacios de mas", () => {
    expect(ids("  JOSÉ   JAIME  ")).toContain("fragil");
  });

  it("un nombre compuesto de la lista no lo hereda quien solo comparte la primera parte", () => {
    // "Brianda tics" está entera en la lista justamente para que la otra Brianda no la vea.
    expect(ids("Brianda Tics")).toContain("fragil");
    expect(ids("Brianda Gómez")).not.toContain("fragil");
  });

  it("Jaime no se come a Jose Jaime ni al reves", () => {
    // Casa por prefijo de palabra completa, no por substring: los dos están invitados por
    // separado y ninguno entra por arrastre del otro.
    expect(ids("Jaime Ruiz")).toContain("fragil");
    expect(ids("Jose Jaime Ruiz")).toContain("fragil");
  });

  it("el nombre listado no cuela metido dentro de otro nombre", () => {
    expect(ids("Ana Dulce")).not.toContain("fragil");
    expect(ids("Dulcinea")).not.toContain("fragil");
  });
});
