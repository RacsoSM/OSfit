import { describe, expect, it } from "vitest";
import {
  ARANA, BRUJA, CALABAZA, CALABAZAS_DEL_SUELO, FANTASMA, MURCIELAGO, bandadaDeMurcielagos, cementerio,
  fondoHalloween, luna, niebla, pixeles, suelo, telarana, tira,
} from "./halloween";

/** Un sprite mal contado se ve corrido una columna: todos sus renglones miden lo mismo. */
describe("los sprites a mano", () => {
  it.each([
    ["calabaza", CALABAZA], ["fantasma", FANTASMA], ["murciélago", MURCIELAGO], ["araña", ARANA], ["bruja", BRUJA],
  ] as const)("%s: todos los renglones del mismo ancho", (_, mapa) => {
    expect(new Set(mapa.map((fila) => fila.length)).size).toBe(1);
  });

  it("la calabaza y el fantasma son simétricos, salvo el tallo y la sombra del costado", () => {
    const espejo = (fila: string) => [...fila].reverse().join("");
    const silueta = (fila: string) => fila.replace(/[^.]/g, "x");
    for (const fila of FANTASMA) expect(silueta(espejo(fila))).toBe(silueta(fila));
    for (const fila of CALABAZA.slice(2)) expect(silueta(espejo(fila))).toBe(silueta(fila));
  });

  it("el murciélago es una tira de dos cuadros del mismo ancho", () => {
    expect(MURCIELAGO[0].length).toBe(26);
  });
});

describe("pixeles", () => {
  it("junta cada tramo del mismo color en un solo rectángulo", () => {
    expect(pixeles(["aab.a"], { a: "#000", b: "#fff" })).toBe(
      `<path fill="#000" d="M0 0h2v1h-2zM4 0h1v1h-1z"/><path fill="#fff" d="M2 0h1v1h-1z"/>`
    );
  });

  it("marca con su clase los colores que se animan", () => {
    expect(pixeles(["y"], { y: "#ff0" }, { y: "vela" })).toContain(`class="vela"`);
  });

  it("tira pone los cuadros uno al lado del otro", () => {
    expect(tira(["ab", "cd"], ["ef", "gh"])).toEqual(["abef", "cdgh"]);
  });
});

describe("telarana", () => {
  const t = telarana(48, 1031);

  it("es la misma en cada carga", () => {
    expect(telarana(48, 1031)).toEqual(t);
  });

  it("nace en la esquina y llega a los dos bordes", () => {
    expect(t[0][0]).not.toBe(".");
    expect(t[0].at(-1)).not.toBe(".");
    expect(t.at(-1)![0]).not.toBe(".");
  });

  it("es una red y no un manchón: casi todo es aire", () => {
    const hilos = t.join("").replace(/\./g, "").length;
    expect(hilos).toBeGreaterThan(48 * 4);
    expect(hilos).toBeLessThan(48 * 48 * 0.35);
  });
});

describe("luna", () => {
  it("es redonda: el renglón del medio es el más ancho y las esquinas están vacías", () => {
    const l = luna(16);
    const ancho = (fila: string) => fila.replace(/\./g, "").length;
    expect(ancho(l[16])).toBe(32);
    expect(ancho(l[0])).toBeLessThan(16);
    expect(l[0][0]).toBe(".");
  });
});

describe("cementerio", () => {
  const c = cementerio(31102026);

  it("es el mismo en cada carga", () => {
    expect(cementerio(31102026)).toEqual(c);
  });

  it("el suelo de adelante llega hasta abajo en todo el ancho", () => {
    expect(c.frente.at(-1)).toMatch(/^a+$/);
  });

  it("las calabazas quedan dentro del dibujo y apoyadas en el suelo", () => {
    for (const [x, escala] of CALABAZAS_DEL_SUELO) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + 16 * escala).toBeLessThanOrEqual(320);
      expect(suelo(x)).toBeGreaterThan(40);
    }
  });
});

describe("niebla", () => {
  it("se repite sin costura: la primera y la última columna casi coinciden", () => {
    const n = niebla();
    const alto = (x: number) => n.filter((fila) => fila[x] !== ".").length;
    expect(Math.abs(alto(0) - alto(63))).toBeLessThanOrEqual(1);
  });
});

describe("fondoHalloween", () => {
  const html = fondoHalloween();

  it("es decorativo: el lector de pantalla no lo lee", () => {
    expect(html).toContain(`aria-hidden="true"`);
  });

  it("trae luna, bruja, telarañas, araña, murciélagos, fantasmas y calabazas", () => {
    for (const clase of ["hw-luna", "hw-bruja", "hw-telarana", "hw-arana", "hw-murcielago", "hw-fantasma", "hw-asomado", "hw-vela"]) {
      expect(html).toContain(clase);
    }
    expect(html.match(/class="hw-resplandor/g)).toHaveLength(CALABAZAS_DEL_SUELO.length);
  });

  it("todo se dibuja a píxeles: cada SVG lleva crispEdges", () => {
    const svgs = html.match(/<svg[^>]*>/g)!.filter((s) => !s.includes("xmlns"));
    for (const svg of svgs) expect(svg).toContain(`shape-rendering="crispEdges"`);
  });

  it("las imágenes en línea no rompen el atributo style", () => {
    const estilo = html.match(/id="fondo-halloween" aria-hidden="true" style="([^"]*)"/)![1];
    expect(estilo).toContain("--hw-murcielago: url(&quot;data:image/svg+xml,");
    expect(estilo).toContain("--hw-niebla: url(&quot;data:image/svg+xml,");
  });
});

describe("bandadaDeMurcielagos", () => {
  it("da un estilo por murciélago, con todas sus variables", () => {
    const b = bandadaDeMurcielagos(5, () => 0.5);
    expect(b).toHaveLength(5);
    expect(b[0]).toBe("--y:45vh;--subida:-22vh;--retraso:190ms;--escala:1.3");
  });
});
