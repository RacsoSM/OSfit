import { describe, expect, it } from "vitest";
import type { VideoConUrl } from "./tarjetaVideos";
import { firmaVideos, tarjetaVideos } from "./tarjetaVideos";

function video(campos: Partial<VideoConUrl> = {}): VideoConUrl {
  return {
    rangoInicio: "2026-08-16",
    encabezadoRango: "2da quincena de agosto",
    rutaStorage: "resumenes/c1/2026-08-16.mp4",
    duracionSegundos: 125,
    url: "https://storage/video.mp4?token=abc",
    ...campos,
  };
}

/** Los rangos van en el orden en que se pintaron. */
function rangos(html: string): string[] {
  return [...html.matchAll(/class="video-rango">([^<]*)</g)].map((m) => m[1]);
}

describe("tarjetaVideos", () => {
  it("sin videos dice que faltan y quien los publica", () => {
    const html = tarjetaVideos([]);
    expect(html).toContain("Todavía no tienes videos");
    expect(html).toContain("Tu entrenador");
  });

  it("pinta el reproductor con la url ya resuelta", () => {
    const html = tarjetaVideos([video({ url: "https://storage/video.mp4?token=abc" })]);
    expect(html).toContain(`src="https://storage/video.mp4?token=abc"`);
    expect(html).toContain("<video");
    expect(html).not.toContain("no disponible");
  });

  it('si la url no se pudo resolver dice "video no disponible" en vez de un reproductor roto', () => {
    const html = tarjetaVideos([video({ url: null })]);
    expect(html).toContain("Video no disponible");
    expect(html).not.toContain("<video");
  });

  it("muestra el encabezado del rango y la duracion en mm:ss", () => {
    const html = tarjetaVideos([video({ encabezadoRango: "1ra quincena de septiembre", duracionSegundos: 125 })]);
    expect(html).toContain("1ra quincena de septiembre");
    expect(html).toContain("2:05");
  });

  it("recorta a los ultimos 6, mas reciente primero", () => {
    const videos = [
      video({ rangoInicio: "2026-01-01", encabezadoRango: "enero" }),
      video({ rangoInicio: "2026-02-01", encabezadoRango: "febrero" }),
      video({ rangoInicio: "2026-03-01", encabezadoRango: "marzo" }),
      video({ rangoInicio: "2026-04-01", encabezadoRango: "abril" }),
      video({ rangoInicio: "2026-05-01", encabezadoRango: "mayo" }),
      video({ rangoInicio: "2026-06-01", encabezadoRango: "junio" }),
      video({ rangoInicio: "2026-07-01", encabezadoRango: "julio" }),
    ];
    const html = tarjetaVideos(videos);
    expect(rangos(html)).toEqual(["julio", "junio", "mayo", "abril", "marzo", "febrero"]);
  });

  it("no reordena la lista que le pasaron", () => {
    const lista = [video({ rangoInicio: "2026-07-01" }), video({ rangoInicio: "2026-09-01" })];
    tarjetaVideos(lista);
    expect(lista[0].rangoInicio).toBe("2026-07-01");
  });

  it("escapa el encabezado del rango", () => {
    const html = tarjetaVideos([video({ encabezadoRango: `<img onerror="x">` })]);
    expect(html).toContain("&lt;img onerror=&quot;x&quot;&gt;");
    expect(html).not.toContain("<img onerror");
  });

  it("escapa la url para que no se salga del atributo", () => {
    const html = tarjetaVideos([video({ url: `x" onerror="alert(1)` })]);
    expect(html).toContain(`src="x&quot; onerror=&quot;alert(1)"`);
  });

  it("sin duracion valida no pinta \"NaN:NaN\"", () => {
    const html = tarjetaVideos([video({ duracionSegundos: undefined as unknown as number })]);
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("video-duracion");
  });
});

describe("firmaVideos", () => {
  it("no cambia si la lista describe los mismos videos con las mismas urls", () => {
    const uno = [video({ rangoInicio: "2026-08-16" })];
    const otro = [video({ rangoInicio: "2026-08-16" })];
    expect(firmaVideos(otro)).toBe(firmaVideos(uno));
  });

  it("cambia cuando llega un video nuevo", () => {
    const antes = [video({ rangoInicio: "2026-08-16" })];
    const despues = [...antes, video({ rangoInicio: "2026-09-01" })];
    expect(firmaVideos(despues)).not.toBe(firmaVideos(antes));
  });

  it("cambia cuando la url del mismo video se resolvio distinto", () => {
    const sinUrl = [video({ url: null })];
    const conUrl = [video({ url: "https://storage/video.mp4?token=abc" })];
    expect(firmaVideos(conUrl)).not.toBe(firmaVideos(sinUrl));
  });

  it("ignora los videos que ya no se pintan por el recorte a 6", () => {
    const seis = ["01", "02", "03", "04", "05", "06"].map((d) =>
      video({ rangoInicio: `2026-01-${d}` })
    );
    const conUnoViejoMas = [...seis, video({ rangoInicio: "2025-12-31" })];
    expect(firmaVideos(conUnoViejoMas)).toBe(firmaVideos(seis));
  });
});
