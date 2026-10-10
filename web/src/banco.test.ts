import { describe, expect, it } from "vitest";
import type { EjercicioBanco, Rutina } from "./datos";
import { claveBanco, gifsPorRuta, indiceBanco, nombresDeLaRutina, rutasDeGifs } from "./banco";

function delBanco(campos: Partial<EjercicioBanco> = {}): EjercicioBanco {
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
    const indice = indiceBanco([delBanco()]);
    expect(indice.get(claveBanco("Sentadilla bulgara"))?.id).toBe("sentadilla-bulgara");
    expect(indice.get(claveBanco("Búlgaras"))?.id).toBe("sentadilla-bulgara");
    expect(indice.get(claveBanco("Split  Squat"))?.id).toBe("sentadilla-bulgara");
  });

  it("aguanta un documento viejo sin alias", () => {
    const indice = indiceBanco([delBanco({ alias: undefined })]);
    expect(indice.get("sentadilla bulgara")?.id).toBe("sentadilla-bulgara");
  });
});

const rutina: Rutina = {
  id: "r1",
  nombre: "Pierna",
  dias: [
    { nombreDia: "Pierna", ejercicios: [{ nombre: "Búlgaras", series: 4, repeticiones: "10", pesoONota: "" }] },
    {
      nombreDia: "Variado",
      ejercicios: [],
      variaciones: [
        { ejercicios: [{ nombre: "Sentadilla bulgara", series: 3, repeticiones: "8", pesoONota: "" }] },
        { ejercicios: [{ nombre: "Caminar", series: 1, repeticiones: "20 min", pesoONota: "" }] },
      ],
    },
  ],
};

describe("nombresDeLaRutina", () => {
  it("incluye los ejercicios de las variaciones", () => {
    expect(nombresDeLaRutina(rutina)).toEqual(["Búlgaras", "Sentadilla bulgara", "Caminar"]);
  });
});

describe("rutasDeGifs", () => {
  it("pide cada GIF una sola vez y omite lo que no está en el banco o no tiene GIF", () => {
    const indice = indiceBanco([
      delBanco(),
      delBanco({ id: "caminar", nombre: "Caminar", alias: [], gifRuta: null }),
    ]);
    expect(rutasDeGifs(rutina, indice)).toEqual(["ejercicios/sentadilla-bulgara.webp"]);
  });

  it("sin rutina no pide nada", () => {
    expect(rutasDeGifs(null, indiceBanco([delBanco()]))).toEqual([]);
  });
});

describe("gifsPorRuta", () => {
  it("da la URL de cada nombre que ya la tiene resuelta", () => {
    const indice = indiceBanco([delBanco()]);
    const gifDe = gifsPorRuta(indice, { "ejercicios/sentadilla-bulgara.webp": "https://x/b.webp" });
    expect(gifDe("búlgaras")).toBe("https://x/b.webp");
    expect(gifDe("Caminar")).toBeNull();
  });

  it("sin URL resuelta todavía no devuelve nada, en vez de una imagen rota", () => {
    expect(gifsPorRuta(indiceBanco([delBanco()]), {})("Búlgaras")).toBeNull();
  });
});
