import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatosBatalla } from "../batalla";
import { DURACION_ANIMACION, ponerBatalla, reiniciarBatalla, relojBatalla, vistaBatalla } from "./batalla";
import { elegirEnComparar, reiniciarComparar, ventanaComparar, type PersonaComparar } from "./comparar";

const d: DatosBatalla = {
  a: { nombre: "Said", sexo: "H" },
  b: { nombre: "Bogue <3", sexo: "H" },
  ejercicios: [
    { id: "press-banca", nombre: "Press de banca", tipo: "peso", musculos: ["pecho"], pesoPorMancuerna: false,
      a: { reps: 8, peso: 60, unoRm: 76, puntaje: 0.7 }, b: { reps: 10, peso: 70, unoRm: 93.3, puntaje: 0.8 } },
    { id: "lagartijas", nombre: "Lagartijas", tipo: "corporal", musculos: ["pecho"], pesoPorMancuerna: false,
      a: { reps: 30, peso: null, unoRm: null, puntaje: 0.75 }, b: { reps: 20, peso: null, unoRm: null, puntaje: 0.5 } },
    { id: "curl", nombre: "Curl", tipo: "peso", musculos: ["biceps"], pesoPorMancuerna: true,
      a: { reps: 10, peso: 12, unoRm: 16, puntaje: 0.5 }, b: { reps: 10, peso: 10, unoRm: 13.3, puntaje: 0.4 } },
  ],
};
let reloj = 0;
beforeEach(() => { reiniciarBatalla(); reloj = 10_000; relojBatalla(() => reloj); });
afterEach(() => relojBatalla(() => Date.now()));

describe("vistaBatalla", () => {
  it("cargando y error", () => {
    ponerBatalla({ rival: "Bogue <3" });
    expect(vistaBatalla()).toContain("Preparando la batalla");
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "error" } });
    expect(vistaBatalla()).toContain('data-bat="reintentar"');
  });

  it("por músculo ofrece los que tienen en común; por ejercicio, cada uno", () => {
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d } });
    let html = vistaBatalla();
    expect(html).toContain('data-bat-musculo="pecho"');
    expect(html).toContain("2 ejercicios");
    expect(html).toContain('data-bat-musculo="biceps"');
    expect(html).toContain("Bogue &lt;3");
    expect(html).not.toContain("Bogue <3");
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d }, modo: "ejercicio" });
    html = vistaBatalla();
    expect(html).toContain('data-bat-ejercicio="press-banca"');
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d }, modo: "todo" });
    expect(vistaBatalla()).toContain("los 3 ejercicios");
  });

  it("sin ejercicios en común lo dice", () => {
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: { ...d, ejercicios: [] } } });
    expect(vistaBatalla()).toContain("ningún ejercicio en común");
  });

  it("primero la animación y a los 3 s el resultado, con series y 1RM", () => {
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d }, eleccion: { modo: "musculo", musculo: "pecho" }, inicio: reloj - 1000 });
    let html = vistaBatalla();
    expect(html).toContain("bat-arena");
    expect(html).toContain("--ya:-1000ms");
    reloj += DURACION_ANIMACION;
    html = vistaBatalla();
    expect(html).not.toContain("bat-arena");
    expect(html).toContain("¡Empate!");
    expect(html).toContain("60 kg × 8");
    expect(html).toContain("1RM ≈ 93.3 kg");
    expect(html).toContain("30 reps");
    expect(html).toContain('data-bat="otra"');
  });

  it("el resultado de un ejercicio, y la nota de mancuerna", () => {
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d }, eleccion: { modo: "ejercicio", ejercicio: "curl" }, inicio: 0 });
    const html = vistaBatalla();
    expect(html).toContain("¡Ganaste la batalla!");
    expect(html).toContain("por mancuerna");
  });
});

describe("en Amigos", () => {
  const yo: PersonaComparar = { nombre: "Said", sexo: "H", esTuyo: true, niveles: { pecho: 3 } };
  const bogue: PersonaComparar = { nombre: "Bogue <3", sexo: "H", esTuyo: false, niveles: { pecho: 4 } };
  beforeEach(() => { reiniciarComparar(); elegirEnComparar("Bogue <3"); });

  it("la comparación tiene el botón de batalla, y con la batalla abierta se ve ella", () => {
    const listo = { estado: "listo" as const, personas: [yo, bogue] };
    expect(ventanaComparar(listo, "H", {}, { mostrarEnAmigos: true })).toContain('data-cmp="batalla"');
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d } });
    const html = ventanaComparar(listo, "H", {}, { mostrarEnAmigos: true });
    expect(html).toContain('data-bat="cerrar"');
    expect(html).not.toContain('data-cmp="batalla"');
  });

  it("sin músculos propios el botón está apagado", () => {
    const html = ventanaComparar({ estado: "listo", personas: [bogue] }, "H", {}, { mostrarEnAmigos: true });
    expect(html).toMatch(/data-cmp="batalla" disabled/);
  });
});
