import { describe, expect, it } from "vitest";
import { MS_DEL_FINAL, MS_HASTA_SALIDA, turnosDelBarrido } from "./ruletaEfectos";
import { CASILLAS, GRADOS_POR_CASILLA, rotacionDestino } from "./ruletaGiro";

describe("turnosDelBarrido", () => {
  // El barrido arranca en el gajo del puntero: es el que ya tiene el color ganador.
  it("el gajo bajo el puntero es el primero", () => {
    for (const azar of [0, 0.4, 0.99]) {
      for (const color of ["rojo", "negro"] as const) {
        const rotacion = rotacionDestino(color, azar);
        const bajoPuntero = Math.floor(((360 - rotacion) % 360) / GRADOS_POR_CASILLA);
        expect(turnosDelBarrido(rotacion)[bajoPuntero]).toBe(0);
      }
    }
  });

  // En horario, como en el video: el siguiente en el dibujo es el siguiente en pantalla.
  it("sigue en horario y pasa por todos una sola vez", () => {
    const turnos = turnosDelBarrido(rotacionDestino("rojo", 0.5));
    expect(new Set(turnos).size).toBe(CASILLAS);
    const primero = turnos.indexOf(0);
    for (let k = 1; k < CASILLAS; k++) {
      expect(turnos[(primero + k) % CASILLAS]).toBe(k);
    }
  });

  // Una rotación acumulada de varias vueltas es la misma posición.
  it("no depende de cuantas vueltas lleve", () => {
    expect(turnosDelBarrido(1440 + 67.5)).toEqual(turnosDelBarrido(67.5));
  });
});

// Del video de referencia: de rueda quieta a desaparecer son unos cuatro segundos y medio.
it("el final dura lo que en el video", () => {
  expect(MS_HASTA_SALIDA).toBeGreaterThan(3000);
  expect(MS_DEL_FINAL).toBeGreaterThan(4000);
  expect(MS_DEL_FINAL).toBeLessThan(5000);
});
