// web/src/ui/ruletaGiro.ts

/**
 * El giro de la ruleta: la parte pura (dónde tiene que aterrizar) y la parte que toca el DOM
 * (cómo llega hasta ahí). Separadas porque los tests de este repo corren en Node sin jsdom.
 */

/**
 * Los dos colores y cómo se reparten el dibujo. **Esta constante es el contrato:** de acá
 * salen a la vez los sectores del SVG que pinta `modalRuleta` y el aterrizaje que calcula
 * `rotacionDestino`, así que mover un sector mueve las dos cosas juntas y no pueden discrepar.
 *
 * Antes no era así. El reparto vivía en un `conic-gradient` de `estilos.css` y el test lo
 * reimplementaba a mano, de modo que invertir los colores habría dejado el test en verde y al
 * puntero señalando el color contrario al que anunciaba el acuse. Ver la entrada 28 del
 * backlog.
 *
 * Los grados se miden desde las 12 en sentido horario, que es donde el puntero está fijo.
 * GEMELO de `COLORES` en `functions/src/reglasRuleta.ts`: los nombres viajan a Firestore.
 */
export const SECTORES = [
  { color: "rojo", desde: 0, hasta: 180 },
  { color: "negro", desde: 180, hasta: 360 },
] as const;

export type Color = (typeof SECTORES)[number]["color"];

/** Media vuelta cada uno: la ruleta se dibuja justa aunque el sorteo no lo sea (ver el spec). */
export const GRADOS_POR_SECTOR = 180;

/** Margen en grados para no aterrizar pegada al borde, donde el puntero queda ambiguo. */
export const MARGEN = 10;

/** Radio del disco dentro del `viewBox` de 200×200. El aro va por fuera, en 96. */
const RADIO = 92;

/** Un punto del borde del disco. 0° son las 12 y crece en horario, como todo acá. */
function punto(grados: number): string {
  const rad = ((grados - 90) * Math.PI) / 180;
  return `${(100 + RADIO * Math.cos(rad)).toFixed(2)},${(100 + RADIO * Math.sin(rad)).toFixed(2)}`;
}

/**
 * El atributo `d` de un sector. Se GENERA desde [SECTORES] en vez de escribirse a mano en el
 * marcado, que es lo que impide que el dibujo y el aterrizaje se separen.
 */
export function arcoDelSector(sector: { desde: number; hasta: number }): string {
  const grande = sector.hasta - sector.desde > 180 ? 1 : 0;
  return `M100,100 L${punto(sector.desde)} A${RADIO},${RADIO} 0 ${grande},1 ${punto(sector.hasta)} Z`;
}

/**
 * Sólo el arco del borde, sin los dos radios que cierran la porción. [arcoDelSector] devuelve
 * una porción de tarta, así que trazarla en vez de rellenarla dibuja también las dos rectas
 * hasta el centro — una V. Esto es para lo que se traza: el filo del disco.
 */
export function arcoDelBorde(desde: number, hasta: number): string {
  const grande = hasta - desde > 180 ? 1 : 0;
  return `M${punto(desde)} A${RADIO},${RADIO} 0 ${grande},1 ${punto(hasta)}`;
}

/** Qué color está pintado en ese punto del dibujo, medido desde las 12 en horario. */
export function colorEnElDibujo(grados: number): Color {
  const g = ((grados % 360) + 360) % 360;
  return (SECTORES.find((s) => g >= s.desde && g < s.hasta) ?? SECTORES[0]).color;
}

/**
 * Qué color queda bajo el puntero —fijo a las 12— con la rueda girada [rotacion] grados.
 * Es la relación que los tests fijan, y vive acá para que la fijen contra el dibujo de verdad.
 */
export function colorBajoElPuntero(rotacion: number): Color {
  return colorEnElDibujo(360 - (((rotacion % 360) + 360) % 360));
}

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
 * [SECTORES] dice qué hay pintado en cada grado, medido desde las 12 en horario, y el
 * puntero es fijo a las 12. Como `rotate(D)` gira la rueda D grados en horario, bajo el
 * puntero queda el material que estaba en `360 − D`: la rotación es el espejo del ángulo del
 * sector, no el mismo número.
 *
 * [azar] entra como parámetro (0 a 1) en vez de llamar a `Math.random()` acá para poder
 * probarlo. No decide nada del resultado: el color ya viene decidido, esto solo elige en qué
 * punto de ese medio círculo se detiene, para que dos tiradas del mismo color no se vean
 * idénticas.
 */
export function rotacionDestino(color: Color, azar: number): number {
  const sector = SECTORES.find((s) => s.color === color) ?? SECTORES[0];
  const util = sector.hasta - sector.desde - MARGEN * 2;
  const enElSector = sector.desde + MARGEN + azar * util;
  return (360 - enElSector) % 360;
}

/**
 * Convierte el `transform` computado en grados. Separada de `anguloActual` para poder probar
 * la guarda sin DOM: los tests de este repo corren en Node sin jsdom.
 *
 * Cuando la rueda no tiene transform, el computado no es la cadena vacía sino el string
 * literal "none", y `DOMMatrixReadOnly` lo rechaza con `SyntaxError` porque no es un
 * `<transform-list>` válido. Esto no es un borde raro: con "reducir movimiento" activo (común
 * en iOS por mareo) `estilos.css` apaga la animación del giro libre y nunca hay transform
 * inline, así que este es el camino normal para esas clientas, y antes reventaba `frenar` a
 * mitad de una tirada que el servidor ya había registrado.
 */
export function anguloDesdeTransform(transformComputado: string): number {
  if (transformComputado === "none" || transformComputado === "") {
    return 0;
  }
  const matriz = new DOMMatrixReadOnly(transformComputado);
  const grados = (Math.atan2(matriz.b, matriz.a) * 180) / Math.PI;
  return (grados + 360) % 360;
}

/** El ángulo en el que está la rueda AHORA, leído de la matriz de transformación calculada. */
function anguloActual(rueda: SVGElement): number {
  return anguloDesdeTransform(getComputedStyle(rueda).transform);
}

/** Fase 1: rotación pareja e infinita, desde el instante en que el cliente toca "Jugar". */
export function girarLibre(rueda: SVGElement): void {
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
export function frenar(rueda: SVGElement, color: Color, azar: number): number {
  const desde = anguloActual(rueda);
  const hasta =
    desde + VUELTAS_DE_FRENADO * 360 + ((rotacionDestino(color, azar) - desde + 360) % 360);

  rueda.classList.remove("girando");
  rueda.style.transform = `rotate(${desde}deg)`;
  // Fuerza el recálculo: sin esto el navegador agrupa las dos escrituras y la transición
  // arranca desde el ángulo viejo, que es exactamente el salto que se quiere evitar.
  //
  // Va por `getBoundingClientRect` y NO por `offsetWidth`: los elementos SVG no tienen
  // `offsetWidth` —es de `HTMLElement`—, así que desde que la rueda es un `<g>` aquello se
  // evaluaba a `undefined` y no forzaba nada, devolviendo el salto en silencio.
  void rueda.getBoundingClientRect().width;
  rueda.style.transition = `transform ${MS_DE_FRENADO}ms cubic-bezier(0.17, 0.67, 0.2, 1)`;
  rueda.style.transform = `rotate(${hasta}deg)`;
  return prefiereMenosMovimiento() ? MS_DE_FUNDIDO : MS_DE_FRENADO;
}
