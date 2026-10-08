import { describe, expect, it } from "vitest";
import {
  CALABAZAS_DEL_SUELO, arbolSeco, bandadaDeMurcielagos, calabaza, estrellas, fantasma, fondoHalloween, suelo, telarana,
} from "./halloween";

describe("las figuras", () => {
  it("la calabaza trae su cara encendida, que es lo que titila", () => {
    expect(calabaza("x")).toContain(`class="hw-cara"`);
  });

  it("los degradados llevan el prefijo pedido: dos calabazas no se pisan los ids", () => {
    expect(calabaza("a")).toContain(`id="a-piel"`);
    expect(calabaza("b")).not.toContain(`id="a-piel"`);
    expect(fantasma("f")).toContain(`url(#f-sabana)`);
  });

  it("el ruedo del fantasma ondula: tiene una curva por onda", () => {
    const d = fantasma("f").match(/<path d="([^"]*)"/)![1];
    expect(d.match(/Q/g)).toHaveLength(5);
  });
});

describe("telarana", () => {
  const t = telarana(150, 1031);

  it("es la misma en cada carga", () => {
    expect(telarana(150, 1031)).toBe(t);
  });

  it("tiene rayos desde la esquina y anillos que se vencen entre rayo y rayo", () => {
    expect(t.match(/M0 0L/g)).toHaveLength(7);
    expect((t.match(/Q/g) ?? []).length).toBeGreaterThan(6 * 5);
  });
});

describe("arbolSeco", () => {
  const a = arbolSeco(42, 400, 70, 16, 4);

  it("es el mismo en cada carga", () => {
    expect(arbolSeco(42, 400, 70, 16, 4)).toEqual(a);
  });

  it("nace del suelo y las ramas adelgazan hacia las puntas", () => {
    expect(a[0]).toContain(`M400 ${Math.round((suelo(400) + 6) * 10) / 10}`);
    const grosores = a.map((r) => Number(r.match(/stroke-width="([\d.]+)"/)![1]));
    expect(grosores[0]).toBe(Math.max(...grosores));
    expect(Math.min(...grosores)).toBeLessThan(grosores[0] / 4);
  });
});

describe("estrellas", () => {
  it("se reparten en tres grupos que titilan por turnos", () => {
    const g = estrellas(30, 7);
    expect(g).toHaveLength(3);
    for (const grupo of g) expect(grupo.match(/<circle/g)).toHaveLength(10);
  });
});

describe("fondoHalloween", () => {
  const html = fondoHalloween();

  it("es decorativo: el lector de pantalla no lo lee", () => {
    expect(html).toContain(`aria-hidden="true"`);
  });

  it("trae luna, bruja, telarañas, araña, murciélagos, fantasmas, casa y calabazas", () => {
    for (const clase of [
      "hw-luna", "hw-bruja", "hw-telarana", "hw-arana", "hw-murcielago", "hw-fantasma", "hw-asomado", "hw-ventana", "hw-cara",
    ]) {
      expect(html).toContain(clase);
    }
    expect(html.match(/class="hw-resplandor/g)).toHaveLength(CALABAZAS_DEL_SUELO.length);
  });

  it("no es pixel art: nada se dibuja con bordes duros", () => {
    expect(html).not.toContain("crispEdges");
  });

  it("cada id de degradado aparece una sola vez", () => {
    const ids = html.match(/id="[^"]+"/g)!;
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("bandadaDeMurcielagos", () => {
  it("da un estilo por murciélago, con todas sus variables", () => {
    const b = bandadaDeMurcielagos(5, () => 0.5);
    expect(b).toHaveLength(5);
    expect(b[0]).toBe("--y:45vh;--subida:-22vh;--retraso:190ms;--escala:1.3");
  });
});
