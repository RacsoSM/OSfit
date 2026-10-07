import { describe, expect, it } from "vitest";
import { tarjetaAjustes } from "./tarjetaAjustes";

describe("tarjetaAjustes", () => {
  it("el combo trae todos los estilos, con el clásico marcado por defecto", () => {
    const html = tarjetaAjustes("clasico");
    expect(html).toContain(`<option value="clasico" selected>Clásico</option>`);
    expect(html).toContain(`<option value="pixel">Pixel art</option>`);
    expect(html).toContain(`<option value="neon">Neón</option>`);
    expect(html).toContain(`<option value="comic">Cómic</option>`);
    expect(html).toContain(`<option value="minimalista">Minimalista</option>`);
    expect(html).toContain(`<option value="sakura">Sakura</option>`);
  });

  it("marca el elegido y muestra su descripción", () => {
    const html = tarjetaAjustes("pixel");
    expect(html).toContain(`<option value="pixel" selected>`);
    expect(html).not.toContain(`<option value="clasico" selected>`);
    expect(html).toContain("8 bits");
  });

  it("el combo tiene etiqueta y descripción para el lector de pantalla", () => {
    const html = tarjetaAjustes("clasico");
    expect(html).toContain(`<label class="ajuste-etiqueta" for="selector-estilo">`);
    expect(html).toContain(`aria-describedby="estilo-descripcion"`);
    expect(html).toContain(`id="estilo-descripcion"`);
  });
});
