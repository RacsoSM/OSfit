// web/src/ui/ruletaGiro.ts

/**
 * El giro de la ruleta: la parte pura (dónde tiene que aterrizar) y la parte que toca el DOM
 * (cómo llega hasta ahí). Separadas porque los tests de este repo corren en Node sin jsdom.
 */

/** Dos colores, media vuelta cada uno. La ruleta se dibuja mitad y mitad (ver el spec). */
export const GRADOS_POR_SECTOR = 180;

/** Margen en grados para no aterrizar pegada al borde, donde el puntero queda ambiguo. */
const MARGEN = 10;

/** Milisegundos de giro libre antes de empezar a frenar, aunque el servidor responda antes. */
export const MINIMO_GIRO_LIBRE_MS = 800;

/** Vueltas completas que dura el frenado. Tres es lo que absorbe la corrección sin que se vea. */
export const VUELTAS_DE_FRENADO = 3;

/** Duración del frenado. La curva de salida hace que las últimas vueltas sean las lentas. */
export const MS_DE_FRENADO = 4000;

/**
 * El ángulo final, dentro del sector del color que mandó el servidor.
 *
 * [azar] entra como parámetro (0 a 1) en vez de llamar a `Math.random()` acá para poder
 * probarlo. No decide nada del resultado: el color ya viene decidido, esto solo elige en qué
 * punto de ese medio círculo se detiene, para que dos tiradas del mismo color no se vean
 * idénticas.
 */
export function anguloDestino(color: "primario" | "ambar", azar: number): number {
  const inicio = color === "primario" ? 0 : GRADOS_POR_SECTOR;
  const util = GRADOS_POR_SECTOR - MARGEN * 2;
  return inicio + MARGEN + azar * util;
}

/** El ángulo en el que está la rueda AHORA, leído de la matriz de transformación calculada. */
function anguloActual(rueda: HTMLElement): number {
  const matriz = new DOMMatrixReadOnly(getComputedStyle(rueda).transform);
  const grados = (Math.atan2(matriz.b, matriz.a) * 180) / Math.PI;
  return (grados + 360) % 360;
}

/** Fase 1: rotación pareja e infinita, desde el instante en que el cliente toca "Jugar". */
export function girarLibre(rueda: HTMLElement): void {
  rueda.style.transition = "none";
  rueda.classList.add("girando");
}

/**
 * Fase 2: frena hasta [color]. Devuelve los milisegundos que va a tardar.
 *
 * Lee el ángulo real del instante del relevo en vez de asumirlo: si se asumiera, la rueda
 * pegaría un salto visible justo en el momento en que el cliente más la está mirando. Y frena
 * a lo largo de VUELTAS_DE_FRENADO completas, de modo que la corrección hacia el sector
 * ganador queda absorbida dentro de las vueltas y es imperceptible.
 */
export function frenar(rueda: HTMLElement, color: "primario" | "ambar", azar: number): number {
  const desde = anguloActual(rueda);
  const hasta = desde + VUELTAS_DE_FRENADO * 360 + ((anguloDestino(color, azar) - desde + 360) % 360);

  rueda.classList.remove("girando");
  rueda.style.transform = `rotate(${desde}deg)`;
  // Fuerza el recálculo: sin esto el navegador agrupa las dos escrituras y la transición
  // arranca desde el ángulo viejo, que es exactamente el salto que se quiere evitar.
  void rueda.offsetWidth;
  rueda.style.transition = `transform ${MS_DE_FRENADO}ms cubic-bezier(0.17, 0.67, 0.2, 1)`;
  rueda.style.transform = `rotate(${hasta}deg)`;
  return MS_DE_FRENADO;
}
