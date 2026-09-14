import { describe, expect, it } from "vitest";
// El cableado se lee como texto (`?raw`, de Vite): ver el porqué abajo.
import fuente from "./main.ts?raw";

/**
 * El orden de las secciones lo fija el spec (`web-clientes-design.md`, "La página"): es el
 * orden de urgencia, lo que se consulta a diario primero y el historial después. No vive en
 * una función pura sino en el cableado de `main.ts`, que arranca la sesión apenas se importa
 * y por eso no se puede montar en un test; se lee el fuente para que un reacomodo del orden
 * no pase de largo, que es exactamente lo que pasó con los videos.
 *
 * `bloqueRepintado` es lo que `pintar()` reconstruye en cada snapshot; los videos quedan
 * fuera a propósito (ver `pintarVideos` en `main.ts`).
 */
const bloqueRepintado = fuente.slice(
  fuente.indexOf("contenido.innerHTML"),
  fuente.indexOf("pintarVideos();")
);

function posicion(fragmento: string): number {
  const indice = bloqueRepintado.indexOf(fragmento);
  expect(indice, `no se encontró ${fragmento}`).toBeGreaterThan(-1);
  return indice;
}

describe("orden de las secciones de la página", () => {
  it("va calendario, medallas y logros, en ese orden", () => {
    expect(posicion("calendario(")).toBeLessThan(posicion("tarjetaMedallas("));
    expect(posicion("tarjetaMedallas(")).toBeLessThan(posicion("tarjetaLogrosPersonales("));
  });

  it("los videos van al final, en su propio contenedor después del repintado", () => {
    expect(bloqueRepintado).not.toContain("tarjetaVideos(");
    expect(fuente.indexOf(`<div id="contenido">`)).toBeLessThan(
      fuente.indexOf(`<div id="videos">`)
    );
  });
});
