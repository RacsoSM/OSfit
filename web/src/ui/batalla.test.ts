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

  it("el menú: cartel con rangos, los tres combates y la casilla de suspenso", () => {
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d } });
    const html = vistaBatalla({ a: "Atlético", b: "Fuerte" });
    expect(html).toContain("bat-cartel");
    expect(html).toContain("Atlético");
    expect(html).toContain("Bogue &lt;3");
    expect(html).not.toContain("Bogue <3");
    expect(html).toContain('data-bat="todo"');
    expect(html).toContain("Los 3 ejercicios en común");
    expect(html).toContain('data-bat-vista="musculo"');
    expect(html).toContain("2 músculos para elegir");
    expect(html).toContain('data-bat-vista="ejercicio"');
    expect(html).toContain("Modo suspenso");
    expect(html).toContain('data-bat="cerrar"');
  });

  it("las listas de músculos y de ejercicios; la flecha regresa al menú", () => {
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d }, vista: "musculo" });
    let html = vistaBatalla();
    expect(html).toContain('data-bat-musculo="pecho"');
    expect(html).toContain("2 ejercicios");
    expect(html).toContain('data-bat="menu"');
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d }, vista: "ejercicio" });
    html = vistaBatalla();
    expect(html).toContain('data-bat-ejercicio="press-banca"');
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
    expect(html).not.toContain("data-bat-destapar");
  });

  it("el % de su peso sale si el servidor lo manda (solo entre hombres)", () => {
    const conPct: DatosBatalla = { ...d, ejercicios: d.ejercicios.map((e) => ({ ...e, a: { ...e.a, porPeso: 120 }, b: { ...e.b, porPeso: 92 } })) };
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: conPct }, eleccion: { modo: "ejercicio", ejercicio: "curl" }, inicio: 0 });
    let html = vistaBatalla();
    expect(html).toContain("120 % de tu peso");
    expect(html).toContain("92 % de su peso");
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d }, eleccion: { modo: "ejercicio", ejercicio: "curl" }, inicio: 0 });
    html = vistaBatalla();
    expect(html).not.toContain("% de tu peso");
  });

  it("el resultado de un ejercicio, con corona y la nota de mancuerna", () => {
    ponerBatalla({ rival: "Bogue <3", datos: { estado: "listo", datos: d }, eleccion: { modo: "ejercicio", ejercicio: "curl" }, inicio: 0 });
    const html = vistaBatalla();
    expect(html).toContain("¡Ganaste la batalla!");
    expect(html).toContain("bat-corona");
    expect(html).toContain("por mancuerna");
  });

  it("modo suspenso: todo tapado, sin ganador ni marcador hasta destapar", () => {
    ponerBatalla({ rival: "Bogue <3", suspenso: true, datos: { estado: "listo", datos: d }, eleccion: { modo: "musculo", musculo: "pecho" }, inicio: 0 });
    const html = vistaBatalla();
    expect(html).toContain('data-bat-destapar="0:a"');
    expect(html).toContain('data-bat-destapar="1:b"');
    expect(html).not.toContain("60 kg × 8");
    expect(html).not.toContain("¡Empate!");
    expect(html).toContain("Quedan 2 ejercicios por destapar");
    expect(html).toContain('data-bat="destapar-todo"');
  });

  it("modo suspenso: una destapada espera a la otra; con las dos sube el marcador", () => {
    const base = { rival: "Bogue <3", suspenso: true, datos: { estado: "listo" as const, datos: d }, eleccion: { modo: "musculo" as const, musculo: "pecho" }, inicio: 0 };
    ponerBatalla({ ...base, destapadas: new Set(["0:a"]) });
    let html = vistaBatalla();
    expect(html).toContain("60 kg × 8");
    expect(html).toContain("Esperando a Bogue &lt;3…");
    expect(html).not.toContain("bat-gana");
    ponerBatalla({ ...base, destapadas: new Set(["0:a", "0:b"]) });
    html = vistaBatalla();
    // El press lo gana Bogue: 0 a 1, y falta uno.
    expect(html).toMatch(/<strong>0<\/strong>[\s\S]*<strong>1<\/strong>/);
    expect(html).toContain("Queda 1 ejercicio por destapar");
    expect(html).toContain("bat-gana");
    ponerBatalla({ ...base, destapadas: new Set(["0:a", "0:b", "1:a", "1:b"]) });
    html = vistaBatalla();
    expect(html).toContain("¡Empate!");
    expect(html).not.toContain("data-bat-destapar");
    expect(html).not.toContain("destapar-todo");
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
    expect(html).toMatch(/data-cmp="batalla"[^>]*disabled/);
    expect(html).toContain("Registra tus entrenamientos para batallar");
  });
});
