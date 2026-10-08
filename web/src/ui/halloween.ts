import { capaDeEstrellas, estrellas } from "./fondoPixel";

/**
 * El paisaje del estilo Halloween, en pixel art: un cielo morado con estrellas, una luna llena
 * enorme que cruza una bruja en su escoba, murciélagos aleteando, telarañas en las esquinas
 * con su araña colgando, fantasmas que flotan y, abajo, un cementerio con un árbol seco,
 * lápidas, un fantasma que se asoma y calabazas encendidas que titilan.
 *
 * Todo sale de mapas de texto (una letra por color, el punto es transparente) o de un lienzo de
 * píxeles donde se trazan líneas a la Bresenham: nada se dibuja con curvas suaves, y
 * `crispEdges` hace que cada unidad del dibujo se vea como un píxel cuadrado al escalarse.
 * Lo generado (telarañas, luna, cementerio) usa semilla fija, como `fondoPixel.ts` y
 * `sakura.ts`: es el mismo en cada carga y la prueba puede contar con él.
 *
 * Como los otros fondos con nodos, vive en el bundle y lo inserta `ponerEstilo` solo la primera
 * vez que alguien elige Halloween.
 */

/** Un dibujo a píxeles: cada fila es un renglón, cada letra un color y el punto, transparente. */
export type Mapa = readonly string[];

/** El generador de siempre del repo (ver `estrellas` en `fondoPixel.ts`). */
function generador(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Los `<path>` de un mapa, uno por color. Cada tramo horizontal del mismo color es un solo
 * rectángulo: así un renglón de suelo de 320 píxeles pesa lo mismo que uno de 1. `clases`
 * marca los colores que el CSS anima (los ojos de las calabazas).
 */
export function pixeles(mapa: Mapa, colores: Record<string, string>, clases: Record<string, string> = {}): string {
  const tramos = new Map<string, string>();
  mapa.forEach((fila, y) => {
    let x = 0;
    while (x < fila.length) {
      const letra = fila[x];
      let fin = x + 1;
      while (fin < fila.length && fila[fin] === letra) fin++;
      if (colores[letra]) {
        const n = fin - x;
        tramos.set(letra, (tramos.get(letra) ?? "") + `M${x} ${y}h${n}v1h-${n}z`);
      }
      x = fin;
    }
  });
  return [...tramos].map(([letra, d]) =>
    `<path fill="${colores[letra]}"${clases[letra] ? ` class="${clases[letra]}"` : ""} d="${d}"/>`
  ).join("");
}

/** Un mapa como `<svg>` suelto, para usarlo de imagen de fondo. */
export function svgSuelto(mapa: Mapa, colores: Record<string, string>): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${mapa[0].length}" height="${mapa.length}" ` +
    `viewBox="0 0 ${mapa[0].length} ${mapa.length}" shape-rendering="crispEdges">${pixeles(mapa, colores)}</svg>`;
}

/** Un `<svg>` como valor de `background-image` (sin escapar: para `element.style`). */
export function comoImagen(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Lo mismo, pero listo para ir dentro de un atributo `style="…"` del HTML. */
function comoImagenEnAtributo(svg: string): string {
  return comoImagen(svg).replace(/"/g, "&quot;");
}

/** Dos cuadros de un sprite, uno al lado del otro: la tira que recorre `steps(2)` en el CSS. */
export function tira(...cuadros: Mapa[]): Mapa {
  return cuadros[0].map((_, y) => cuadros.map((c) => c[y]).join(""));
}

// ---------- Los sprites, dibujados a mano ----------

/** La calabaza con cara: la `y` es la luz de la vela que se ve por los cortes. */
export const CALABAZA: Mapa = [
  "........gg......",
  ".......gg.......",
  "...kkkkggkkkk...",
  "..kohooddoooek..",
  ".kohoooddooooek.",
  "kohoyooddooyooek",
  "kohyyyoddoyyyoek",
  "koyyyyyddyyyyyek",
  "kohooooyyoooooek",
  "kooyyoyyyyoyyoek",
  "koooyyyooyyyooek",
  ".koooooddooooek.",
  "..kddooddooddk..",
  "...kkkkkkkkkk...",
];
export const COLORES_CALABAZA = {
  k: "#2b1608", o: "#f77622", d: "#c75a12", h: "#ffb04a", e: "#a8450c", y: "#ffe14d", g: "#3e8948",
};

/** El fantasma: una sábana con ojos, cachetes y la boca en "¡oh!". */
export const FANTASMA: Mapa = [
  "....kkkk....",
  "..kkwwwwkk..",
  ".kwwwwwwwwk.",
  ".kwwwwwwwwk.",
  "kwwkkwwkkwwk",
  "kwwkkwwkkwwk",
  "kwbwwwwwwbwk",
  "kwwwwkkwwwwk",
  "kwwwwkkwwwwk",
  "kswwwwwwwwsk",
  "kswwwwwwwwsk",
  "kwk.kwwk.kwk",
  ".k...kk...k.",
];
export const COLORES_FANTASMA = { k: "#1d1735", w: "#f4f1ff", s: "#b9b3e0", b: "#ff8fb1" };

/** El murciélago, en dos cuadros: alas arriba y alas abajo. */
const MURCIELAGO_ARRIBA: Mapa = [
  "k...........k",
  "kk...k.k...kk",
  "kkk..kkk..kkk",
  "kkkkkrkrkkkkk",
  ".kkkkkkkkkkk.",
  "..kk.kkk.kk..",
];
const MURCIELAGO_ABAJO: Mapa = [
  ".....k.k.....",
  ".....kkk.....",
  "..kkkrkrkkk..",
  ".kkkkkkkkkkk.",
  "kkk..kkk..kkk",
  "k.....k.....k",
];
export const MURCIELAGO = tira(MURCIELAGO_ARRIBA, MURCIELAGO_ABAJO);
const COLORES_MURCIELAGO = { k: "#120818", r: "#ff4d4d" };

/** La araña que cuelga de la telaraña, con sus ocho patas y dos ojos rojos. */
export const ARANA: Mapa = [
  "k...kkk...k",
  ".k.kkkkk.k.",
  "..kkpppkk..",
  "kkkkrkrkkkk",
  "..kkkkkkk..",
  ".k.kkkkk.k.",
  "k...kkk...k",
];
const COLORES_ARANA = { k: "#0b0612", p: "#4b2a6b", r: "#ff3b3b" };

/** La bruja en su escoba, a contraluz: se ve recortada contra la luna. */
export const BRUJA: Mapa = [
  "..........k...........",
  ".........kk...........",
  "........kkk...........",
  ".......kkkk...........",
  ".....kkkkkkkk.........",
  ".......kkk............",
  "......kkkkk...........",
  ".....kkkkkkk..........",
  "kkkkkkkkkkkkkkkkkkkkkk",
  "kkkk...kk.............",
  "kkk.....kk............",
  "kk....................",
];

// ---------- Lo generado: lienzo de píxeles ----------

/** Una cuadrícula de letras donde se traza; al final se lee como `Mapa`. */
class Lienzo {
  private celdas: string[][];

  constructor(readonly ancho: number, readonly alto: number) {
    this.celdas = Array.from({ length: alto }, () => Array<string>(ancho).fill("."));
  }

  punto(x: number, y: number, letra: string): void {
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (cx >= 0 && cy >= 0 && cx < this.ancho && cy < this.alto) this.celdas[cy][cx] = letra;
  }

  rect(x: number, y: number, ancho: number, alto: number, letra: string): void {
    for (let j = 0; j < alto; j++) for (let i = 0; i < ancho; i++) this.punto(x + i, y + j, letra);
  }

  /** Bresenham: la línea de a un píxel, escalonada, como la dibujaría una consola. */
  linea(x0: number, y0: number, x1: number, y1: number, letra: string, grosor = 1): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xf = Math.round(x1);
    const yf = Math.round(y1);
    const dx = Math.abs(xf - x);
    const dy = -Math.abs(yf - y);
    const sx = x < xf ? 1 : -1;
    const sy = y < yf ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      this.rect(x, y, grosor, 1, letra);
      if (x === xf && y === yf) return;
      const e2 = 2 * error;
      if (e2 >= dy) { error += dy; x += sx; }
      if (e2 <= dx) { error += dx; y += sy; }
    }
  }

  mapa(): Mapa {
    return this.celdas.map((fila) => fila.join(""));
  }
}

/**
 * Una telaraña de esquina, con el centro arriba a la izquierda: rayos que se abren en abanico
 * y anillos que cuelgan entre rayo y rayo (la hebra se vence hacia el centro, como una de
 * verdad). Unas gotas de rocío (`g`) brillan sobre los anillos.
 */
export function telarana(lado: number, semilla: number): Mapa {
  const azar = generador(semilla);
  const l = new Lienzo(lado, lado);
  const RAYOS = 6;
  const angulos = Array.from({ length: RAYOS }, (_, i) => (i / (RAYOS - 1)) * (Math.PI / 2));
  for (const a of angulos) l.linea(0, 0, Math.cos(a) * lado * 1.5, Math.sin(a) * lado * 1.5, "h");
  // Los anillos se separan más hacia afuera; llegan hasta la diagonal del cuadrado.
  for (let r = 6; r < lado * 1.4; r += 5 + Math.round(azar() * 2) + Math.floor(r / 14)) {
    const radios = angulos.map(() => r * (0.9 + azar() * 0.2));
    for (let i = 0; i < RAYOS - 1; i++) {
      let anterior: [number, number] | null = null;
      for (let t = 0; t <= 1.0001; t += 1 / 18) {
        const a = angulos[i] + (angulos[i + 1] - angulos[i]) * t;
        const rr = (radios[i] + (radios[i + 1] - radios[i]) * t) * (1 - 0.14 * Math.sin(Math.PI * t));
        const p: [number, number] = [Math.cos(a) * rr, Math.sin(a) * rr];
        if (anterior) l.linea(anterior[0], anterior[1], p[0], p[1], "h");
        anterior = p;
      }
      if (azar() < 0.18) {
        const a = angulos[i] + (angulos[i + 1] - angulos[i]) * 0.5;
        const rr = (radios[i] + radios[i + 1]) / 2 * 0.86;
        l.punto(Math.cos(a) * rr, Math.sin(a) * rr, "g");
      }
    }
  }
  return l.mapa();
}

/** La luna llena, redonda a escalones, con cráteres y el borde de abajo en sombra. */
export function luna(radio: number): Mapa {
  const l = new Lienzo(radio * 2, radio * 2);
  const crateres = [
    [-0.35, -0.2, 0.22], [0.28, 0.3, 0.18], [0.32, -0.38, 0.1], [-0.12, 0.45, 0.12], [-0.5, 0.25, 0.08],
  ];
  for (let y = 0; y < radio * 2; y++) {
    for (let x = 0; x < radio * 2; x++) {
      const dx = x + 0.5 - radio;
      const dy = y + 0.5 - radio;
      const d = Math.hypot(dx, dy);
      if (d > radio) continue;
      let letra = d > radio - 1.8 && dx + dy > radio * 0.4 ? "s" : "l";
      for (const [cx, cy, cr] of crateres) {
        if (Math.hypot(dx / radio - cx, dy / radio - cy) < cr) letra = "c";
      }
      l.punto(x, y, letra);
    }
  }
  return l.mapa();
}
const COLORES_LUNA = { l: "#ffdf8e", s: "#f2b450", c: "#e9a743" };

/** Ancho y alto del cementerio en píxeles del dibujo: ancho como el paisaje del pixel. */
const ANCHO_PAISAJE = 320;
const ALTO_PAISAJE = 64;

/** Dónde está el suelo de adelante en cada columna. Ondula un poco: es tierra, no una mesa. */
export function suelo(x: number): number {
  return Math.round(53 + 2 * Math.sin(x / 11) + 1.4 * Math.sin(x / 4.3 + 2));
}

/** Una rama seca: se tuerce y se parte en dos, cada vez más fina, sin una sola hoja. */
function ramaSeca(
  l: Lienzo, azar: () => number, x: number, y: number, angulo: number, largo: number, grosor: number, nivel: number
): void {
  const x2 = x + Math.cos(angulo) * largo;
  const y2 = y + Math.sin(angulo) * largo;
  l.linea(x, y, x2, y2, "a", grosor);
  if (nivel === 0) return;
  for (const lado of [-1, 1]) {
    ramaSeca(l, azar, x2, y2, angulo + lado * (0.35 + azar() * 0.45) + (azar() - 0.5) * 0.3,
      largo * (0.62 + azar() * 0.18), Math.max(1, grosor - 1), nivel - 1);
  }
}

/** Una lápida de punta redonda, con una cruz grabada. */
function lapida(l: Lienzo, x: number, ancho: number, alto: number): void {
  const base = suelo(x + Math.floor(ancho / 2)) + 1;
  const arriba = base - alto;
  l.rect(x + 2, arriba, ancho - 4, 1, "c");
  l.rect(x + 1, arriba + 1, ancho - 2, 1, "c");
  l.rect(x, arriba + 2, ancho, alto - 2, "c");
  // La sombra del costado derecho: le da volumen sin salir del pixel art.
  l.rect(x + ancho - 1, arriba + 2, 1, alto - 2, "e");
  const centro = x + Math.floor(ancho / 2);
  l.rect(centro, arriba + 2, 1, 4, "e");
  l.rect(centro - 1, arriba + 3, 3, 1, "e");
}

/** Una cruz de piedra. */
function cruz(l: Lienzo, x: number, alto: number): void {
  const base = suelo(x + 1) + 1;
  l.rect(x, base - alto, 2, alto, "c");
  l.rect(x - 2, base - alto + 3, 6, 2, "c");
  l.rect(x + 1, base - alto, 1, alto, "e");
}

/** Un tramo de reja de cementerio: barrotes con punta de lanza y dos travesaños. */
function reja(l: Lienzo, desde: number, hasta: number): void {
  for (let x = desde; x <= hasta; x += 3) {
    const base = suelo(x) + 1;
    l.rect(x, base - 10, 1, 10, "a");
    l.punto(x, base - 11, "a");
  }
  for (let x = desde; x <= hasta; x++) {
    const base = suelo(x) + 1;
    l.punto(x, base - 8, "a");
    l.punto(x, base - 3, "a");
  }
}

/**
 * El cementerio en dos capas: la colina de atrás y, por separado, el frente (suelo, lápidas,
 * reja y árboles secos). Van aparte para que el fantasma que se asoma quede ENTRE las dos: se
 * esconde detrás de una lápida pero delante de la colina.
 *
 * En un teléfono se ve solo el centro (el SVG recorta los lados), así que lo importante va
 * entre x = 100 y x = 220; los costados son para pantallas anchas.
 */
export function cementerio(semilla: number): { lejos: Mapa; frente: Mapa } {
  const azar = generador(semilla);
  const lejos = new Lienzo(ANCHO_PAISAJE, ALTO_PAISAJE);
  for (let x = 0; x < ANCHO_PAISAJE; x++) {
    const arriba = Math.round(41 + 4 * Math.sin(x / 17 + 1) + 2 * Math.sin(x / 7));
    lejos.rect(x, arriba, 1, ALTO_PAISAJE - arriba, "b");
  }
  const frente = new Lienzo(ANCHO_PAISAJE, ALTO_PAISAJE);
  // Los árboles van primero: el suelo tapa la base del tronco.
  ramaSeca(frente, azar, 104, suelo(104) + 2, -Math.PI / 2 + 0.12, 15, 4, 4);
  ramaSeca(frente, azar, 290, suelo(290) + 2, -Math.PI / 2 - 0.15, 13, 3, 4);
  ramaSeca(frente, azar, 18, suelo(18) + 2, -Math.PI / 2 + 0.2, 11, 3, 3);
  for (let x = 0; x < ANCHO_PAISAJE; x++) frente.rect(x, suelo(x), 1, ALTO_PAISAJE - suelo(x), "a");
  lapida(frente, 140, 7, 9);
  cruz(frente, 156, 12);
  lapida(frente, 170, 9, 11);
  cruz(frente, 205, 10);
  lapida(frente, 214, 7, 8);
  lapida(frente, 32, 7, 9);
  cruz(frente, 58, 11);
  lapida(frente, 250, 8, 10);
  cruz(frente, 276, 12);
  reja(frente, 66, 94);
  reja(frente, 226, 244);
  return { lejos: lejos.mapa(), frente: frente.mapa() };
}
const COLORES_CEMENTERIO = { a: "#0b0612", b: "#24123a", c: "#3d2f57", e: "#2a2040" };

/** Dónde van las calabazas del cementerio: la x de su esquina izquierda y su escala. */
export const CALABAZAS_DEL_SUELO: readonly [number, number][] = [[116, 1], [186, 0.75], [44, 0.75], [262, 1]];

/** Una franja de niebla de 64 de ancho que se repite sin costura (sus ondas cierran en 64). */
export function niebla(): Mapa {
  const l = new Lienzo(64, 8);
  for (let x = 0; x < 64; x++) {
    const alto = Math.round(3 + 2 * Math.sin((2 * Math.PI * x * 2) / 64) + Math.sin((2 * Math.PI * x * 5) / 64));
    l.rect(x, 8 - alto, 1, alto, "n");
  }
  return l.mapa();
}

function svgEnLinea(clase: string, mapa: Mapa, colores: Record<string, string>, extra = ""): string {
  return `<svg class="${clase}" viewBox="0 0 ${mapa[0].length} ${mapa.length}" shape-rendering="crispEdges">` +
    `${pixeles(mapa, colores)}${extra}</svg>`;
}

/** Una calabaza encendida en el suelo, con su resplandor detrás. */
function calabazaEnElSuelo(x: number, escala: number, i: number): string {
  const alto = CALABAZA.length * escala;
  const y = suelo(Math.round(x + 8 * escala)) + 1 - alto;
  return `<g transform="translate(${x} ${Math.round(y * 10) / 10}) scale(${escala})">
      <circle class="hw-resplandor r${i % 3}" cx="8" cy="8" r="15" fill="url(#hw-brillo)"/>
      ${pixeles(CALABAZA, COLORES_CALABAZA, { y: `hw-vela v${i % 3}` })}
    </g>`;
}

export function fondoHalloween(): string {
  const [a, b, c] = estrellas(70, 31102026);
  const { lejos, frente } = cementerio(31102026);
  const variables = [
    `--hw-murcielago: ${comoImagenEnAtributo(svgSuelto(MURCIELAGO, COLORES_MURCIELAGO))}`,
    `--hw-niebla: ${comoImagenEnAtributo(svgSuelto(niebla(), { n: "#d9cff5" }))}`,
  ].join(";");
  const murcielagos = [1, 2, 3, 4].map((n) => `<i class="hw-murcielago m${n}"></i>`).join("");
  const fantasmas = [1, 2, 3].map((n) => svgEnLinea(`hw-fantasma f${n}`, FANTASMA, COLORES_FANTASMA)).join("");
  return `
    <div class="fondo-halloween" id="fondo-halloween" aria-hidden="true" style="${variables}">
      ${capaDeEstrellas(a, "uno")}
      ${capaDeEstrellas(b, "dos")}
      ${capaDeEstrellas(c, "tres")}
      <div class="hw-cielo-luna">
        <div class="hw-halo"></div>
        ${svgEnLinea("hw-luna", luna(16), COLORES_LUNA)}
        ${svgEnLinea("hw-bruja", BRUJA, { k: "#120818" })}
      </div>
      ${murcielagos}
      ${svgEnLinea("hw-telarana izquierda", telarana(48, 1031), { h: "#d8d0f0", g: "#ffffff" })}
      ${svgEnLinea("hw-telarana derecha", telarana(36, 2026), { h: "#d8d0f0", g: "#ffffff" })}
      <div class="hw-arana">${svgEnLinea("hw-arana-cuerpo", ARANA, COLORES_ARANA)}</div>
      ${fantasmas}
      <svg class="hw-paisaje" viewBox="0 0 ${ANCHO_PAISAJE} ${ALTO_PAISAJE}"
           preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges">
        <defs>
          <radialGradient id="hw-brillo">
            <stop offset="0" stop-color="#ffb347" stop-opacity="0.75"/>
            <stop offset="0.45" stop-color="#ff7a1a" stop-opacity="0.3"/>
            <stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/>
          </radialGradient>
        </defs>
        ${pixeles(lejos, COLORES_CEMENTERIO)}
        <g transform="translate(168 ${suelo(174) - 13})"><g class="hw-asomado">${pixeles(FANTASMA, COLORES_FANTASMA)}</g></g>
        ${pixeles(frente, COLORES_CEMENTERIO)}
        ${CALABAZAS_DEL_SUELO.map(([x, escala], i) => calabazaEnElSuelo(x, escala, i)).join("")}
      </svg>
      <i class="hw-niebla uno"></i>
      <i class="hw-niebla dos"></i>
    </div>`;
}

// ---------- Lo que se mueve con el dedo y en la transición ----------

/** Cuántos fantasmas de toque puede haber a la vez: más que eso ya tapa la página. */
const MAX_SUSTOS = 6;
let quitarSustos: (() => void) | null = null;

/**
 * Al tocar la pantalla sale un fantasmita del dedo que sube, se mece y dice "¡Bu!". No atrapa
 * toques (`pointer-events: none` en el CSS) y la escucha es `passive`: nunca le roba el clic a
 * un botón. Quien pidió menos movimiento no ve fantasmas.
 */
export function iniciarSustos(): void {
  if (quitarSustos) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const imagen = comoImagen(svgSuelto(FANTASMA, COLORES_FANTASMA));
  const alTocar = (e: PointerEvent) => {
    if (document.querySelectorAll(".hw-susto").length >= MAX_SUSTOS) return;
    const susto = document.createElement("i");
    susto.className = "hw-susto";
    susto.setAttribute("aria-hidden", "true");
    susto.style.left = `${e.clientX}px`;
    susto.style.top = `${e.clientY}px`;
    susto.style.backgroundImage = imagen;
    susto.style.setProperty("--deriva", `${Math.round((Math.random() - 0.5) * 90)}px`);
    document.body.append(susto);
    // Gemelo de la duración de `hw-susto` en el CSS.
    setTimeout(() => susto.remove(), 1700);
  };
  window.addEventListener("pointerdown", alTocar, { passive: true });
  quitarSustos = () => {
    window.removeEventListener("pointerdown", alTocar);
    document.querySelectorAll(".hw-susto").forEach((n) => n.remove());
  };
}

export function detenerSustos(): void {
  quitarSustos?.();
  quitarSustos = null;
}

/** La imagen de la tira del murciélago y de la calabaza, para la transición. */
export const IMAGEN_MURCIELAGO = (): string => comoImagen(svgSuelto(MURCIELAGO, COLORES_MURCIELAGO));
export const IMAGEN_CALABAZA = (): string => comoImagen(svgSuelto(CALABAZA, COLORES_CALABAZA));

/**
 * La bandada de la transición: murciélagos que cruzan la pantalla de derecha a izquierda.
 * Devuelve el estilo en línea de cada uno; `azar` entra para probarla.
 */
export function bandadaDeMurcielagos(n: number, azar: () => number = Math.random): string[] {
  return Array.from({ length: n }, () => {
    const y = Math.round(azar() * 100 - 5);
    const subida = Math.round(-10 - azar() * 25);
    const retraso = Math.round(azar() * 380);
    const escala = Math.round((0.7 + azar() * 1.1) * 10) / 10;
    return `--y:${y}vh;--subida:${subida}vh;--retraso:${retraso}ms;--escala:${escala}`;
  });
}
