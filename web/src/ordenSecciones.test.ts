import { describe, expect, it } from "vitest";
// El cableado se lee como texto (`?raw`, de Vite): `main.ts` arranca la sesión apenas se
// importa y no se puede montar en un test.
import fuente from "./main.ts?raw";

/**
 * El orden de lo que va en Inicio ya no vive en `main.ts`: es la ventana Inicio del registro
 * y se prueba en `ventanas.test.ts`. Acá queda lo que sí es cableado: que `pintar()` pinte la
 * ventana del registro en vez de una lista fija, y que los videos sigan fuera de lo que se
 * repinta (ver `pintarVideos` en `main.ts`).
 */
const bloqueRepintado = fuente.slice(
  fuente.indexOf("contenido.innerHTML"),
  fuente.indexOf("pintarVideos(activa")
);

describe("el cableado de las ventanas", () => {
  it("pintar() pinta la ventana activa del registro", () => {
    expect(bloqueRepintado).toContain("contenidoDe(");
    expect(bloqueRepintado).not.toContain("tarjetaMedallas(");
    expect(bloqueRepintado).not.toContain("calendario(");
  });

  it("los videos siguen en su propio contenedor, después del repintado", () => {
    expect(bloqueRepintado).not.toContain("tarjetaVideos(");
    expect(fuente.indexOf(`<div id="contenido">`)).toBeLessThan(
      fuente.indexOf(`<div id="videos" hidden>`)
    );
  });

  it("la navegación arranca después de la sesión", () => {
    expect(fuente.indexOf("iniciarNavegacion(")).toBeGreaterThan(
      fuente.indexOf("const clienteId = sesion.clienteId")
    );
  });
});
