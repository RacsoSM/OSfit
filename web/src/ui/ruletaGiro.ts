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
 * La ROTACIÓN que hay que darle a la rueda para que el puntero caiga en el color que mandó
 * el servidor. Devuelve la rotación y no el ángulo del sector porque es lo que `frenar` le
 * pasa a `transform: rotate()`, y confundir los dos números es exactamente lo que hacía que
 * el puntero aterrizara en el color contrario al que anunciaba el acuse.
 *
 * El `conic-gradient` de `estilos.css` pinta `primario` de 0° a 180° y `ambar` de 180° a
 * 360°, medidos desde las 12 en sentido horario, y el puntero es fijo a las 12. Como
 * `rotate(D)` gira la rueda D grados en horario, bajo el puntero queda el material que
 * estaba en `360 − D`: la rotación es el espejo del ángulo del sector, no el mismo número.
 *
 * [azar] entra como parámetro (0 a 1) en vez de llamar a `Math.random()` acá para poder
 * probarlo. No decide nada del resultado: el color ya viene decidido, esto solo elige en qué
 * punto de ese medio círculo se detiene, para que dos tiradas del mismo color no se vean
 * idénticas.
 */
export function rotacionDestino(color: "primario" | "ambar", azar: number): number {
  const inicio = color === "primario" ? 0 : GRADOS_POR_SECTOR;
  const util = GRADOS_POR_SECTOR - MARGEN * 2;
  const enElSector = inicio + MARGEN + azar * util;
  return (360 - enElSector) % 360;
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
  // El `transform` inline que dejó el frenado anterior se borra antes de animar: el keyframe
  // arranca en 0°, y arrastrar el ángulo viejo convertía el giro de la segunda tirada de la
  // sesión en un bamboleo entre ese ángulo y 360°.
  rueda.style.transform = "";
  rueda.classList.add("girando");
}

/**
 * Quien pidió menos movimiento no ve el frenado (lo corta `estilos.css`), así que esperar los
 * 4 segundos antes del acuse sería dejarla mirando una rueda ya parada en su color: le
 * adelanta el resultado y recién entonces se lo deja leer.
 */
function prefiereMenosMovimiento(): boolean {
  return (
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Lo que dura el fundido del acuse cuando no hay giro. Gemelo de `ruleta-fundido` en el CSS. */
export const MS_DE_FUNDIDO = 200;

/**
 * Fase 2: frena hasta [color]. Devuelve los milisegundos que va a tardar.
 *
 * Lee el ángulo real del instante del relevo en vez de asumirlo: si se asumiera, la rueda
 * pegaría un salto visible justo en el momento en que el cliente más la está mirando. Y frena
 * a lo largo de VUELTAS_DE_FRENADO completas, de modo que la corrección hacia el sector
 * ganador queda absorbida dentro de las vueltas y es imperceptible.
 *
 * Los milisegundos que devuelve son los que quien llama espera antes de mostrar el acuse, y
 * por eso bajan al fundido cuando no hay frenado que mirar.
 */
export function frenar(rueda: HTMLElement, color: "primario" | "ambar", azar: number): number {
  const desde = anguloActual(rueda);
  const hasta =
    desde + VUELTAS_DE_FRENADO * 360 + ((rotacionDestino(color, azar) - desde + 360) % 360);

  rueda.classList.remove("girando");
  rueda.style.transform = `rotate(${desde}deg)`;
  // Fuerza el recálculo: sin esto el navegador agrupa las dos escrituras y la transición
  // arranca desde el ángulo viejo, que es exactamente el salto que se quiere evitar.
  void rueda.offsetWidth;
  rueda.style.transition = `transform ${MS_DE_FRENADO}ms cubic-bezier(0.17, 0.67, 0.2, 1)`;
  rueda.style.transform = `rotate(${hasta}deg)`;
  return prefiereMenosMovimiento() ? MS_DE_FUNDIDO : MS_DE_FRENADO;
}
