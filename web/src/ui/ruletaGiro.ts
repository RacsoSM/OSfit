// web/src/ui/ruletaGiro.ts

/**
 * El giro de la ruleta: la parte pura (dónde tiene que aterrizar) y la parte que toca el DOM
 * (cómo llega hasta ahí). Separadas porque los tests de este repo corren en Node sin jsdom.
 */

/** Los dos colores. GEMELO de `COLORES` en `functions/src/reglasRuleta.ts`. */
export const COLORES = ["rojo", "negro"] as const;
export type Color = (typeof COLORES)[number];

/**
 * Cuántas casillas tiene la rueda. Par, siempre: los colores se alternan, así que impar
 * dejaría dos del mismo color juntas en la costura del 0 y el reparto dejaría de ser mitad y
 * mitad.
 *
 * **Ocho** (2026-10-07): la rueda dejó de ser una ruleta de casino y pasó a ser una rueda de
 * concurso, copiada del video de referencia, que tiene ocho gajos. Con 45° por gajo el color
 * bajo el puntero se lee de un vistazo, que es la única pregunta que la clienta se hace.
 */
export const CASILLAS = 8;

/** Lo que ocupa cada casilla. Con 8 son 45°. */
export const GRADOS_POR_CASILLA = 360 / CASILLAS;

/**
 * El reparto del dibujo. **Esta constante es el contrato:** de acá salen a la vez los `<path>`
 * del SVG que pinta `modalRuleta` y el aterrizaje que calcula `rotacionDestino`, así que
 * moverlo mueve las dos cosas juntas y no pueden discrepar (entradas 25 §4 y 28 del backlog).
 *
 * **Sigue siendo mitad y mitad**, que es lo que pide el spec: la mitad de los gajos de cada
 * color, alternos.
 *
 * Los grados se miden desde las 12 en horario, que es donde el puntero está fijo.
 */
export const SECTORES: ReadonlyArray<{ color: Color; desde: number; hasta: number }> =
  Array.from({ length: CASILLAS }, (_, i) => ({
    color: COLORES[i % COLORES.length],
    desde: i * GRADOS_POR_CASILLA,
    hasta: (i + 1) * GRADOS_POR_CASILLA,
  }));

/** Radio de los gajos, dentro del `viewBox`: el centro es (100, 100). El aro va por fuera. */
export const RADIO = 84;

/** Un punto a [r] del centro. 0° son las 12 y crece en horario, como todo acá. */
function punto(grados: number, r: number): string {
  const rad = ((grados - 90) * Math.PI) / 180;
  return `${(100 + r * Math.cos(rad)).toFixed(2)},${(100 + r * Math.sin(rad)).toFixed(2)}`;
}

/**
 * El `d` de un gajo: una porción entera, del eje al borde, como en la rueda de referencia. Se
 * GENERA desde [SECTORES] en vez de escribirse a mano, que es lo que impide que el dibujo y el
 * aterrizaje se separen.
 */
export function arcoDelSector(sector: { desde: number; hasta: number }): string {
  const grande = sector.hasta - sector.desde > 180 ? 1 : 0;
  return (
    `M100,100 L${punto(sector.desde, RADIO)}` +
    ` A${RADIO},${RADIO} 0 ${grande},1 ${punto(sector.hasta, RADIO)} Z`
  );
}

/** La varilla negra que separa dos gajos: del eje al borde. */
export function varillaEn(grados: number): { x1: string; y1: string; x2: string; y2: string } {
  const [x2, y2] = punto(grados, RADIO).split(",");
  return { x1: "100", y1: "100", x2, y2 };
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

/**
 * Los tiempos salen del video de referencia (2026-10-07): la rueda acelera durante un segundo,
 * gira desenfocada a toda velocidad, frena a lo largo de unos cinco segundos y medio y se
 * detiene a los ~9 s de haber arrancado.
 */

/** Lo que dura el arranque, de parada a velocidad de crucero. Gemelo de `ruleta-arranque`. */
export const MS_DE_ARRANQUE = 1000;

/** Velocidad de crucero, en grados por milisegundo: dos vueltas por segundo. Gemela de
 *  `ruleta-libre` (0.5s por vuelta) en el CSS. */
export const VELOCIDAD_LIBRE = 360 / 500;

/**
 * Milisegundos de giro libre (arranque incluido) antes de empezar a frenar, aunque el servidor
 * responda antes: así el frenado siempre tiene la misma forma y la espera no delata nada.
 */
export const MINIMO_GIRO_LIBRE_MS = 3500;

/** Vueltas completas que dura el frenado, más la corrección hasta la casilla. */
export const VUELTAS_DE_FRENADO = 4;

/** Duración del frenado. La curva de salida hace que las últimas vueltas sean las lentas. */
export const MS_DE_FRENADO = 5500;

/**
 * La curva del frenado, hecha a medida de cuánto tiene que recorrer. Una `cubic-bezier`
 * arranca con pendiente `y1/x1`, y la velocidad inicial del frenado es esa pendiente por
 * `grados / ms`; igualarla a [VELOCIDAD_LIBRE] es lo que hace que el relevo entre el giro libre
 * y el frenado no se note — con una curva fija la rueda daba un tirón justo ahí.
 */
export function curvaDeFrenado(grados: number, ms: number): string {
  const x1 = 0.2;
  const pendiente = (VELOCIDAD_LIBRE * ms) / grados;
  const y1 = Math.min(1, x1 * pendiente);
  return `cubic-bezier(${x1}, ${y1.toFixed(3)}, 0.3, 1)`;
}

/**
 * La ROTACIÓN que hay que darle a la rueda para que el puntero caiga en el color que mandó
 * el servidor. Devuelve la rotación y no el ángulo de la casilla porque es lo que `frenar` le
 * pasa a `transform: rotate()`, y confundir los dos números es exactamente lo que hacía que
 * el puntero aterrizara en el color contrario al que anunciaba el acuse.
 *
 * [SECTORES] dice qué hay pintado en cada grado, medido desde las 12 en horario, y el
 * puntero es fijo a las 12. Como `rotate(D)` gira la rueda D grados en horario, bajo el
 * puntero queda el material que estaba en `360 − D`: la rotación es el espejo del ángulo de
 * la casilla, no el mismo número.
 *
 * **Aterriza en el CENTRO de una casilla.** Antes elegía un punto al azar de medio círculo y
 * hacía falta un margen de 10° para no parar pegada a la costura, donde el puntero quedaba
 * ambiguo. Con casillas, el centro es el único sitio sensato —el puntero queda en el gajo,
 * no encima de la varilla— y la ambigüedad desaparece sin margen que mantener.
 *
 * [azar] entra como parámetro (0 a 1) en vez de llamar a `Math.random()` acá para poder
 * probarlo. No decide nada del resultado: el color ya viene decidido, esto sólo elige EN CUÁL
 * de las casillas de ese color se detiene, para que dos tiradas iguales no se vean iguales.
 */
export function rotacionDestino(color: Color, azar: number): number {
  const suyas = SECTORES.filter((s) => s.color === color);
  const elegida = suyas[Math.min(suyas.length - 1, Math.floor(azar * suyas.length))];
  const centro = (elegida.desde + elegida.hasta) / 2;
  return (360 - centro) % 360;
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
export function anguloActual(rueda: SVGElement): number {
  return anguloDesdeTransform(getComputedStyle(rueda).transform);
}

/**
 * Fase 1: arranca (un segundo acelerando) y sigue a velocidad pareja e infinita, desde el
 * instante en que el cliente toca "Jugar". Las dos animaciones viven en el CSS (`.girando`).
 */
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
 * segundos del frenado antes del acuse sería dejarla mirando una rueda ya parada en su color: le
 * adelanta el resultado y recién entonces se lo deja leer.
 */
export function prefiereMenosMovimiento(): boolean {
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
  rueda.style.transition = `transform ${MS_DE_FRENADO}ms ${curvaDeFrenado(hasta - desde, MS_DE_FRENADO)}`;
  rueda.style.transform = `rotate(${hasta}deg)`;
  return prefiereMenosMovimiento() ? MS_DE_FUNDIDO : MS_DE_FRENADO;
}
