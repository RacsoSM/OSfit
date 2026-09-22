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
 * **Doce, no treinta y seis.** Se probó con 36, que es lo realista, y el color bajo el puntero
 * quedaba en una franja de 10° que además la perspectiva comprime: había que entornar los ojos
 * para saber si se había ganado, que es justo la única pregunta que la clienta se hace. Con 30°
 * por casilla se lee de un vistazo. El realismo y la legibilidad tiran en contra acá, y gana la
 * legibilidad.
 */
export const CASILLAS = 12;

/** Lo que ocupa cada casilla. Con 36 son 10°. */
export const GRADOS_POR_CASILLA = 360 / CASILLAS;

/**
 * El reparto del dibujo. **Esta constante es el contrato:** de acá salen a la vez los `<path>`
 * del SVG que pinta `modalRuleta` y el aterrizaje que calcula `rotacionDestino`, así que
 * moverlo mueve las dos cosas juntas y no pueden discrepar.
 *
 * Antes no era así. El reparto vivía en un `conic-gradient` de `estilos.css` y el test lo
 * reimplementaba a mano, de modo que invertir los colores habría dejado el test en verde y al
 * puntero señalando el color contrario al que anunciaba el acuse (entradas 25 §4 y 28).
 *
 * **Sigue siendo mitad y mitad**, que es lo que pide el spec: 18 casillas de cada color. Que
 * sean muchas y alternas en vez de dos medias tartas es como funciona una ruleta de verdad
 * —la bola cae en UNA casilla y apostar al color sigue siendo binario— y es lo que hace que
 * el dibujo se lea como ruleta y no como gráfico de sectores.
 *
 * Los grados se miden desde las 12 en horario, que es donde el puntero está fijo.
 */
export const SECTORES: ReadonlyArray<{ color: Color; desde: number; hasta: number }> =
  Array.from({ length: CASILLAS }, (_, i) => ({
    color: COLORES[i % COLORES.length],
    desde: i * GRADOS_POR_CASILLA,
    hasta: (i + 1) * GRADOS_POR_CASILLA,
  }));

/** Borde exterior de las casillas, dentro del `viewBox` de 200×200. El aro va por fuera. */
const RADIO = 92;

/**
 * Donde acaban las casillas y empieza el cono. Las casillas de una ruleta viven en un ANILLO,
 * no en porciones que llegan al eje: con 36 porciones completas el centro sería una estrella
 * de picos y se volvería a leer como gráfico.
 */
const RADIO_INTERIOR = 54;

/** Un punto del borde a [r] del centro. 0° son las 12 y crece en horario, como todo acá. */
function punto(grados: number, r: number): string {
  const rad = ((grados - 90) * Math.PI) / 180;
  return `${(100 + r * Math.cos(rad)).toFixed(2)},${(100 + r * Math.sin(rad)).toFixed(2)}`;
}

/**
 * El `d` de una casilla: un trozo de anillo. Se GENERA desde [SECTORES] en vez de escribirse a
 * mano en el marcado, que es lo que impide que el dibujo y el aterrizaje se separen.
 */
export function arcoDelSector(sector: { desde: number; hasta: number }): string {
  const grande = sector.hasta - sector.desde > 180 ? 1 : 0;
  return (
    `M${punto(sector.desde, RADIO)} A${RADIO},${RADIO} 0 ${grande},1 ${punto(sector.hasta, RADIO)}` +
    ` L${punto(sector.hasta, RADIO_INTERIOR)}` +
    ` A${RADIO_INTERIOR},${RADIO_INTERIOR} 0 ${grande},0 ${punto(sector.desde, RADIO_INTERIOR)} Z`
  );
}

/** Sólo el arco del borde exterior, sin cerrar: para trazar filos y luces sobre el canto. */
export function arcoDelBorde(desde: number, hasta: number): string {
  const grande = hasta - desde > 180 ? 1 : 0;
  return `M${punto(desde, RADIO)} A${RADIO},${RADIO} 0 ${grande},1 ${punto(hasta, RADIO)}`;
}

/** El punto medio del anillo de casillas, que es donde descansa la bola. */
export function puntoDelAnillo(grados: number): string {
  return punto(grados, (RADIO + RADIO_INTERIOR) / 2);
}

/** La varilla que separa dos casillas: del anillo interior al exterior. */
export function varillaEn(grados: number): { x1: string; y1: string; x2: string; y2: string } {
  const [x1, y1] = punto(grados, RADIO_INTERIOR).split(",");
  const [x2, y2] = punto(grados, RADIO).split(",");
  return { x1, y1, x2, y2 };
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
 * ambiguo. Con casillas, el centro es el único sitio sensato —la bola se queda en la casilla,
 * no encima de la varilla— y la ambigüedad desaparece sin margen que mantener.
 *
 * [azar] entra como parámetro (0 a 1) en vez de llamar a `Math.random()` acá para poder
 * probarlo. No decide nada del resultado: el color ya viene decidido, esto sólo elige EN CUÁL
 * de las 18 casillas de ese color se detiene, para que dos tiradas iguales no se vean iguales.
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
