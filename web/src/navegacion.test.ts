import { beforeEach, describe, expect, it } from "vitest";
import {
  abrirMenu, abrirVentana, alRetrocederSub, cerrarMenu, iniciarNavegacion, irSub, marcarSub, menuAbierto,
  subActiva, ventanaActiva, ventanaDeBarra, type Historial,
} from "./navegacion";

/**
 * `history` de mentira. Igual que el navegador, `back()` no avisa en el acto: el `popstate`
 * llega en otra vuelta del bucle. `soltar()` lo entrega, y es donde se ve si la lógica
 * aguanta ese hueco.
 */
function historialFalso(inicial: unknown = null) {
  const pila: unknown[] = [inicial];
  let i = 0;
  let pendientes = 0;
  let escucha: () => void = () => {};
  const h: Historial & { pila(): unknown[]; soltar(): void; atras(): void } = {
    get state() { return pila[i]; },
    pushState(e) { pila.splice(i + 1); pila.push(e); i++; },
    replaceState(e) { pila[i] = e; },
    back() { if (i > 0) { i--; pendientes++; } },
    alRetroceder(f) { escucha = f; },
    /** Las entradas hasta la actual, sin `ant` (de dónde venía): solo dónde está cada una. */
    pila: () => pila.slice(0, i + 1).map((e) => {
      if (e === null || typeof e !== "object") return e;
      const { ant: _ant, ...resto } = e as Record<string, unknown>;
      return resto;
    }),
    soltar() { while (pendientes > 0) { pendientes--; escucha(); } },
    /** El botón "atrás" del teléfono. */
    atras() { h.back(); h.soltar(); },
  };
  return h;
}

let h: ReturnType<typeof historialFalso>;
let avisos: number;

beforeEach(() => {
  h = historialFalso();
  avisos = 0;
  iniciarNavegacion(h, () => { avisos++; });
});

describe("arranque", () => {
  it("empieza en Inicio con el menú cerrado", () => {
    expect(ventanaActiva()).toBe("inicio");
    expect(menuAbierto()).toBe(false);
  });

  it("una recarga sobre una ventana empujada cae en Inicio y limpia el estado heredado", () => {
    const heredado = historialFalso({ ventana: "medallas" });
    iniciarNavegacion(heredado, () => {});
    expect(ventanaActiva()).toBe("inicio");
    expect(heredado.state).toBeNull();
  });
});

describe("entre ventanas", () => {
  it("abrir una desde Inicio empuja una entrada", () => {
    abrirVentana("medallas");
    expect(ventanaActiva()).toBe("medallas");
    expect(h.pila()).toEqual([null, { ventana: "medallas" }]);
    expect(avisos).toBe(1);
  });

  it("cada ventana queda en el historial: atrás regresa a la anterior", () => {
    abrirVentana("medallas");
    abrirVentana("videos");
    expect(h.pila()).toEqual([null, { ventana: "medallas" }, { ventana: "videos" }]);
    h.atras();
    expect(ventanaActiva()).toBe("medallas");
    h.atras();
    expect(ventanaActiva()).toBe("inicio");
  });

  it("también al volver a Inicio con la barra: atrás regresa a donde estaba", () => {
    abrirVentana("registro");
    abrirVentana("musculos");
    abrirVentana("inicio");
    expect(h.pila()).toEqual([null, { ventana: "registro" }, { ventana: "musculos" }, { ventana: "inicio" }]);
    h.atras();
    expect(ventanaActiva()).toBe("musculos");
    h.atras();
    expect(ventanaActiva()).toBe("registro");
  });

  it("abrir la que ya está activa no toca el historial", () => {
    abrirVentana("medallas");
    abrirVentana("medallas");
    expect(h.pila()).toEqual([null, { ventana: "medallas" }]);
  });
});

describe("el menú", () => {
  it("atrás con el menú abierto solo cierra el menú", () => {
    abrirVentana("medallas");
    abrirMenu();
    expect(menuAbierto()).toBe(true);
    h.atras();
    expect(menuAbierto()).toBe(false);
    expect(ventanaActiva()).toBe("medallas");
  });

  it("cerrarlo con la ✕ retira su entrada", () => {
    abrirMenu();
    cerrarMenu();
    expect(menuAbierto()).toBe(false); // el panel se cierra sin esperar al popstate
    h.soltar();
    expect(h.pila()).toEqual([null]);
  });

  it("elegir una ventana desde Inicio no deja la entrada del menú", () => {
    abrirMenu();
    abrirVentana("logros");
    h.soltar();
    expect(ventanaActiva()).toBe("logros");
    expect(h.pila()).toEqual([null, { ventana: "logros" }]);
  });

  it("desde Medallas, menú → Videos deja [Inicio, Medallas, Videos], sin la entrada del menú", () => {
    abrirVentana("medallas");
    abrirMenu();
    abrirVentana("videos");
    h.soltar();
    expect(ventanaActiva()).toBe("videos");
    expect(h.pila()).toEqual([null, { ventana: "medallas" }, { ventana: "videos" }]);
  });

  it("desde Medallas, menú → Inicio deja [Inicio, Medallas, Inicio]", () => {
    abrirVentana("medallas");
    abrirMenu();
    abrirVentana("inicio");
    h.soltar();
    expect(ventanaActiva()).toBe("inicio");
    expect(h.pila()).toEqual([null, { ventana: "medallas" }, { ventana: "inicio" }]);
  });

  it("elegir la ventana activa solo cierra el menú", () => {
    abrirVentana("medallas");
    abrirMenu();
    abrirVentana("medallas");
    h.soltar();
    expect(menuAbierto()).toBe(false);
    expect(h.pila()).toEqual([null, { ventana: "medallas" }]);
  });

  it("ignora toques mientras espera el popstate", () => {
    abrirMenu();
    cerrarMenu();
    abrirMenu(); // antes de que llegue el popstate del cierre
    abrirVentana("ranking");
    h.soltar();
    expect(menuAbierto()).toBe(false);
    expect(ventanaActiva()).toBe("inicio");
    expect(h.pila()).toEqual([null]);
  });
});

describe("subventanas (Compararme dentro de Músculos)", () => {
  beforeEach(() => abrirVentana("musculos"));

  it("se abre encima de Músculos, y atrás regresa a Músculos", () => {
    abrirVentana("comparar");
    expect(h.pila()).toEqual([null, { ventana: "musculos" }, { ventana: "comparar" }]);
    h.atras();
    expect(ventanaActiva()).toBe("musculos");
    h.atras();
    expect(ventanaActiva()).toBe("inicio");
  });

  it("ir a otra pestaña desde ella sale primero a Músculos: atrás regresa a Músculos", () => {
    abrirVentana("comparar");
    abrirVentana("registro");
    h.soltar();
    expect(ventanaActiva()).toBe("registro");
    expect(h.pila()).toEqual([null, { ventana: "musculos" }, { ventana: "registro" }]);
  });

  it("volver a Músculos desde ella es retroceder, sin apilar Músculos otra vez", () => {
    abrirVentana("comparar");
    abrirVentana("musculos");
    h.soltar();
    expect(ventanaActiva()).toBe("musculos");
    expect(h.pila()).toEqual([null, { ventana: "musculos" }]);
  });

  it("la pestaña de Músculos queda marcada", () => {
    expect(ventanaDeBarra("comparar")).toBe("musculos");
    expect(ventanaDeBarra("registro")).toBe("registro");
  });
});

describe("pantallas dentro de una ventana (Registro)", () => {
  let puestas: (string | null)[];
  beforeEach(() => {
    puestas = [];
    alRetrocederSub((v, s) => { if (v === "registro") puestas.push(s); });
    abrirVentana("registro");
  });

  it("abrir una pantalla la apila, y atrás regresa a la anterior", () => {
    irSub("capturar", "adelante");
    irSub("elegir", "adelante");
    expect(h.pila()).toEqual([
      null, { ventana: "registro" }, { ventana: "registro", sub: "capturar" }, { ventana: "registro", sub: "elegir" },
    ]);
    h.atras();
    expect(subActiva()).toBe("capturar");
    expect(puestas).toEqual(["capturar"]);
    h.atras();
    expect(subActiva()).toBeNull();
    expect(puestas).toEqual(["capturar", null]);
    h.atras();
    expect(ventanaActiva()).toBe("inicio");
  });

  it("volver a la pantalla anterior desde la página retrocede en vez de apilar", () => {
    irSub("capturar", "adelante");
    irSub("elegir", "adelante");
    irSub("capturar", "volver"); // eligió un ejercicio
    h.soltar();
    expect(h.pila()).toEqual([null, { ventana: "registro" }, { ventana: "registro", sub: "capturar" }]);
  });

  it("volver a una que no es la anterior reemplaza", () => {
    irSub("historial", "adelante");
    irSub("capturar", "volver");
    expect(h.pila()).toEqual([null, { ventana: "registro" }, { ventana: "registro", sub: "capturar" }]);
  });

  it("terminar reemplaza la captura por el resumen: atrás no regresa al entrenamiento guardado", () => {
    irSub("capturar", "adelante");
    irSub("resumen", "reemplazar");
    expect(h.pila()).toEqual([null, { ventana: "registro" }, { ventana: "registro", sub: "resumen" }]);
    irSub(null, "volver"); // "Listo" → inicio de Registro
    h.soltar();
    expect(h.pila()).toEqual([null, { ventana: "registro" }]);
  });

  it("marcar anota la pantalla en la que abrió sin agregar entradas", () => {
    marcarSub("capturar");
    expect(h.pila()).toEqual([null, { ventana: "registro", sub: "capturar" }]);
  });

  it("de otra pestaña, atrás regresa a la pantalla de Registro donde estaba", () => {
    irSub("historial", "adelante");
    abrirVentana("musculos");
    h.atras();
    expect(ventanaActiva()).toBe("registro");
    expect(subActiva()).toBe("historial");
    expect(puestas).toEqual(["historial"]);
  });

  it("el menú abierto encima de una pantalla regresa a ella al cerrarse", () => {
    irSub("historial", "adelante");
    abrirMenu();
    h.atras();
    expect(menuAbierto()).toBe(false);
    expect(subActiva()).toBe("historial");
  });
});

