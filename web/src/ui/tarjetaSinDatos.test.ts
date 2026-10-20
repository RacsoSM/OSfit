import { describe, expect, it } from "vitest";
import { tarjetaSinDatos } from "./tarjetaSinDatos";

describe("tarjetaSinDatos", () => {
  it("el interruptor dice si el modo está puesto", () => {
    expect(tarjetaSinDatos(true, true)).toContain(`aria-checked="true"`);
    expect(tarjetaSinDatos(false, true)).toContain(`aria-checked="false"`);
  });

  it("es un interruptor con etiqueta y descripción para el lector de pantalla", () => {
    const html = tarjetaSinDatos(false, true);
    expect(html).toContain(`role="switch"`);
    expect(html).toContain(`aria-labelledby="sin-datos-etiqueta"`);
    expect(html).toContain(`id="sin-datos-nota"`);
  });

  it("puesto, dice qué deja de funcionar sin internet", () => {
    expect(tarjetaSinDatos(true, true)).toContain("La ruleta, el ranking");
  });

  it("en un teléfono que no avisa del Wi-Fi, dice que hay que apagarlo a mano", () => {
    expect(tarjetaSinDatos(true, false)).toContain("no avisa cuándo estás en Wi-Fi");
    expect(tarjetaSinDatos(true, true)).toContain("te sugeriremos desactivarlo");
  });
});

describe("tarjetaSinDatos al guardar los ejercicios", () => {
  it("mientras se bajan los GIF, muestra el avance y el interruptor espera", () => {
    const html = tarjetaSinDatos(false, true, { hechos: 80, total: 121 });
    expect(html).toContain("Guardando los ejercicios en tu teléfono para verlos sin datos… 80 de 121");
    expect(html).toContain(`disabled aria-busy="true"`);
  });

  it("si algo no se pudo guardar, lo dice", () => {
    expect(tarjetaSinDatos(true, true, null, "2 ejercicios no se pudieron guardar")).toContain("2 ejercicios no se pudieron guardar");
  });
});
