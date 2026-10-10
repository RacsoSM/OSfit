import { describe, expect, it } from "vitest";
import type { EjercicioBanco } from "./datos";
import { claveBanco, indiceBanco, urlGif, urlVideo } from "./banco";

function ej(campos: Partial<EjercicioBanco> = {}): EjercicioBanco {
  return {
    id: "sentadilla-bulgara",
    nombre: "Sentadilla búlgara",
    alias: ["bulgaras", "split squat"],
    tipo: "peso",
    musculos: { cuadriceps: 1, gluteo: 1 },
    gifRuta: "ejercicios/sentadilla-bulgara.webp",
    ...campos,
  };
}

describe("claveBanco", () => {
  it("ignora acentos, mayúsculas y espacios de sobra", () => {
    expect(claveBanco("  Sentadilla   BÚLGARA ")).toBe("sentadilla bulgara");
    expect(claveBanco("Jalón al pecho")).toBe(claveBanco("jalon al pecho"));
  });
});

describe("indiceBanco", () => {
  it("encuentra el ejercicio por su nombre o por cualquiera de sus alias", () => {
    const indice = indiceBanco([ej()]);
    expect(indice.get(claveBanco("Sentadilla bulgara"))?.id).toBe("sentadilla-bulgara");
    expect(indice.get(claveBanco("Búlgaras"))?.id).toBe("sentadilla-bulgara");
    expect(indice.get(claveBanco("Split  Squat"))?.id).toBe("sentadilla-bulgara");
  });

  it("aguanta un documento viejo sin alias", () => {
    expect(indiceBanco([ej({ alias: undefined })]).get("sentadilla bulgara")?.id)
      .toBe("sentadilla-bulgara");
  });
});

describe("urlGif", () => {
  it("arma la URL pública de Storage con la ruta codificada", () => {
    expect(urlGif("ejercicios/press-banca.webp")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/osfit-cccfe.firebasestorage.app/o/ejercicios%2Fpress-banca.webp?alt=media"
    );
  });

  it("sin ruta no hay URL", () => {
    expect(urlGif(null)).toBeNull();
    expect(urlGif(undefined)).toBeNull();
  });
});

describe("urlVideo", () => {
  it("arma la URL pública del video igual que la del GIF", () => {
    expect(urlVideo("ejercicios/press-banca.mp4")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/osfit-cccfe.firebasestorage.app/o/ejercicios%2Fpress-banca.mp4?alt=media"
    );
    expect(urlVideo(null)).toBeNull();
  });
});
