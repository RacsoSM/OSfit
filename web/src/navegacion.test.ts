import { beforeEach, describe, expect, it } from "vitest";
import {
  abrirMenu, abrirVentana, cerrarMenu, iniciarNavegacion, menuAbierto, ventanaActiva,
  type Historial,
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
    pila: () => pila.slice(0, i + 1),
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

  it("saltar de una a otra reemplaza, así atrás siempre vuelve a Inicio", () => {
    abrirVentana("medallas");
    abrirVentana("videos");
    expect(h.pila()).toEqual([null, { ventana: "videos" }]);
    h.atras();
    expect(ventanaActiva()).toBe("inicio");
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

  it("desde Medallas, menú → Videos deja [Inicio, Videos]", () => {
    abrirVentana("medallas");
    abrirMenu();
    abrirVentana("videos");
    h.soltar();
    expect(ventanaActiva()).toBe("videos");
    expect(h.pila()).toEqual([null, { ventana: "videos" }]);
  });

  it("desde Medallas, menú → Inicio deja [Inicio]", () => {
    abrirVentana("medallas");
    abrirMenu();
    abrirVentana("inicio");
    h.soltar();
    expect(ventanaActiva()).toBe("inicio");
    expect(h.pila()).toEqual([null]);
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
