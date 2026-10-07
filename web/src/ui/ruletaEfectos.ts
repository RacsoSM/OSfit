// web/src/ui/ruletaEfectos.ts
import {
  CASILLAS,
  anguloActual,
  colorBajoElPuntero,
  prefiereMenosMovimiento,
} from "./ruletaGiro";
import type { Color } from "./ruletaGiro";

/**
 * Todo lo que la rueda hace además de girar: la entrada, el desenfoque y la gema del puntero
 * mientras gira, y la fiesta del final. Copiado del video de referencia (2026-10-07), con sus
 * tiempos medidos cuadro a cuadro:
 *
 * - **Entrada:** aparece como silueta blanca que crece y se colorea en ~0,4 s.
 * - **Giro:** la gema del puntero toma el color del gajo que tiene debajo, y la rueda se
 *   desenfoca en proporción a su velocidad.
 * - **Final:** quieta 0,6 s → destello blanco de 0,5 s → los gajos pasan al color ganador uno a
 *   uno, en horario desde el puntero, cada 0,15 s → 1,1 s de pausa → se encoge, crece en blanco
 *   y desaparece (0,8 s).
 *
 * Separado de `ruletaGiro.ts` porque aquello es el giro y su cuenta; esto es decoración.
 */

/** Los tiempos del final, en ms. Cada uno cuenta desde que la rueda se detiene. */
export const FINAL = {
  destello: 600,
  msDestello: 500,
  barrido: 1200,
  pasoBarrido: 150,
  msTinte: 220,
  sosten: 1100,
  msSalida: 800,
} as const;

/** Cuándo empieza la salida y cuánto dura el final entero. */
export const MS_HASTA_SALIDA =
  FINAL.barrido + (CASILLAS - 1) * FINAL.pasoBarrido + FINAL.msTinte + FINAL.sosten;
export const MS_DEL_FINAL = MS_HASTA_SALIDA + FINAL.msSalida;

/**
 * En qué turno se tiñe cada gajo del barrido. El índice es el del gajo en `SECTORES`; el valor,
 * su turno: 0 es el que está bajo el puntero y los demás siguen en horario, como en el video.
 *
 * Funciona porque el dibujo y la pantalla crecen los dos en horario: girada la rueda, el gajo
 * que sigue al del puntero en pantalla es también el que le sigue en `SECTORES`.
 */
export function turnosDelBarrido(rotacion: number): number[] {
  const bajoPuntero = (360 - (((rotacion % 360) + 360) % 360)) % 360;
  const primero = Math.floor(bajoPuntero / (360 / CASILLAS)) % CASILLAS;
  return Array.from({ length: CASILLAS }, (_, i) => (i - primero + CASILLAS) % CASILLAS);
}

/** Pinta la gema del puntero. `className` no sirve en SVG: es un `SVGAnimatedString`. */
export function pintarGema(svg: ParentNode, color: Color): void {
  svg.querySelector("#ruleta-gema")?.setAttribute("class", `ruleta-gema ${color}`);
}

/** La silueta crece desde dentro y se le va el blanco: es como aparece en el video. */
export function entrar(svg: SVGSVGElement): void {
  if (prefiereMenosMovimiento()) return;
  svg.animate(
    [
      { transform: "scale(0.55)" },
      { transform: "scale(1.06)", offset: 0.6 },
      { transform: "scale(1)" },
    ],
    { duration: 380, easing: "ease-out" }
  );
  svg.querySelector(".ruleta-blanco")?.animate(
    [{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }],
    { duration: 450, easing: "ease-out" }
  );
}

/** Desenfoque máximo, en unidades del `viewBox`. Lo que se ve en el video a toda velocidad. */
const DESENFOQUE_MAXIMO = 5;

/**
 * Mientras gira: lee el ángulo en cada cuadro, pone la gema del color que hay bajo el puntero y
 * desenfoca la rueda según la velocidad. Devuelve con qué pararlo.
 *
 * El desenfoque va en un filtro SVG y no en `filter: blur()` de CSS porque los navegadores no
 * aplican igual las funciones de filtro CSS a elementos SVG sueltos.
 */
export function vigilar(svg: SVGSVGElement): () => void {
  const rueda = svg.querySelector<SVGGElement>("#ruleta-rueda");
  const desenfoque = svg.querySelector("#ruleta-estela-desenfoque");
  if (!rueda) return () => {};

  let vivo = true;
  let previo = anguloActual(rueda);
  let tPrevio = performance.now();
  let velocidad = 0;

  const paso = (t: number) => {
    if (!vivo) return;
    const angulo = anguloActual(rueda);
    const dt = t - tPrevio;
    if (dt > 0) {
      // Por cuadro la rueda avanza bastante menos de media vuelta, así que la diferencia
      // módulo 360 es el avance real aunque haya pasado por 0°.
      const avance = (angulo - previo + 360) % 360;
      velocidad = velocidad * 0.6 + (avance / dt) * 0.4;
    }
    previo = angulo;
    tPrevio = t;
    pintarGema(svg, colorBajoElPuntero(angulo));
    const d = Math.min(DESENFOQUE_MAXIMO, velocidad * 7);
    desenfoque?.setAttribute("stdDeviation", d < 0.15 ? "0" : d.toFixed(2));
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);

  return () => {
    vivo = false;
    desenfoque?.setAttribute("stdDeviation", "0");
  };
}

/**
 * El final, con la rueda ya quieta en [color]. Devuelve los ms que dura, que es lo que quien
 * llama espera antes de mostrar el acuse.
 *
 * Con "reducir movimiento" no hay destello ni salida: los gajos pasan al color de golpe y el
 * acuse llega enseguida.
 */
export function celebrar(svg: SVGSVGElement, color: Color): number {
  const rueda = svg.querySelector<SVGGElement>("#ruleta-rueda");
  const tintes = Array.from(svg.querySelectorAll<SVGPathElement>(".ruleta-tinte"));
  const blanco = svg.querySelector<SVGGElement>(".ruleta-blanco");
  const turnos = turnosDelBarrido(rueda ? anguloActual(rueda) : 0);
  pintarGema(svg, color);
  for (const t of tintes) t.setAttribute("fill", `url(#ruleta-gajo-${color})`);

  if (prefiereMenosMovimiento()) {
    for (const t of tintes) t.style.opacity = "1";
    return 600;
  }

  svg.classList.add("fiesta");

  blanco?.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }],
    { duration: FINAL.msDestello, delay: FINAL.destello }
  );

  tintes.forEach((t, i) => {
    t.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FINAL.msTinte,
      delay: FINAL.barrido + turnos[i] * FINAL.pasoBarrido,
      easing: "ease-out",
      fill: "forwards",
    });
  });

  // Se encoge, rebota grande volviéndose blanca y se apaga. `fill: forwards` la deja invisible
  // hasta el repintado que trae el acuse; sin él reaparecería un cuadro antes.
  svg.animate(
    [
      { transform: "scale(1)", opacity: 1, easing: "ease-in" },
      { transform: "scale(0.6)", opacity: 1, offset: 0.3, easing: "ease-out" },
      { transform: "scale(1.12)", opacity: 1, offset: 0.7 },
      { transform: "scale(1)", opacity: 1, offset: 0.88 },
      { transform: "scale(0.95)", opacity: 0 },
    ],
    { duration: FINAL.msSalida, delay: MS_HASTA_SALIDA, fill: "forwards" }
  );
  blanco?.animate(
    [{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.7 }, { opacity: 1 }],
    { duration: FINAL.msSalida, delay: MS_HASTA_SALIDA, fill: "forwards" }
  );

  return MS_DEL_FINAL;
}
