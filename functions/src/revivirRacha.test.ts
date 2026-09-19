import { describe, expect, it } from "vitest";
import { cupoDelRevive } from "./revivirRacha";
import { castigoDelMes } from "./reglasRuleta";

/**
 * Lo que fija esto es que el castigo de la ruleta lo sostenga el servidor. Antes, la funcion
 * que de verdad otorga los revives comparaba contra un 3 fijo: a una clienta castigada, cuya
 * pagina ya le mostraba 0 y le ofrecia la ruleta, una llamada desde la consola del navegador
 * le justificaba una tercera falta. El castigo quedaba sostenido solo por el `disabled` de un
 * boton, y el spec dice que se revalida todo en el servidor.
 */
describe("cupoDelRevive", () => {
  it("en un mes sin castigo los tres revives pasan y el cuarto no", () => {
    expect(cupoDelRevive(0, 0, false)).toEqual({ sinCupo: false, disponibles: 2 });
    expect(cupoDelRevive(2, 0, false)).toEqual({ sinCupo: false, disponibles: 0 });
    expect(cupoDelRevive(3, 0, false).sinCupo).toBe(true);
  });

  it("en un mes castigado el tercer revive se rechaza", () => {
    const castigo = castigoDelMes({ gano: false });
    expect(cupoDelRevive(1, castigo, false)).toEqual({ sinCupo: false, disponibles: 0 });
    expect(cupoDelRevive(2, castigo, false).sinCupo).toBe(true);
  });

  // Ganar la ruleta no castiga: el mes siguiente vuelve a ser de tres.
  it("haber ganado la ruleta no quita revives", () => {
    expect(cupoDelRevive(2, castigoDelMes({ gano: true }), false).sinCupo).toBe(false);
  });

  // El numero que devuelve es el que la pagina muestra, y tiene que coincidir con el que va a
  // contar la proxima llamada: si la fecha ya estaba justificada no se gasta nada nuevo.
  it("repetir una fecha ya justificada no descuenta de nuevo", () => {
    expect(cupoDelRevive(1, 0, true).disponibles).toBe(2);
    expect(cupoDelRevive(1, 1, true).disponibles).toBe(1);
  });

  it("nunca devuelve un cupo negativo", () => {
    expect(cupoDelRevive(5, 1, false).disponibles).toBe(0);
  });
});
