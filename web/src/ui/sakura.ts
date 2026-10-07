/**
 * El paisaje del estilo sakura, como una estampa japonesa: un sol rosado, el Fuji a lo lejos,
 * un cerezo de tinta en flor que sube desde la esquina de abajo y una rama que entra por
 * arriba. Los pétalos que caen no van acá: son de `petalos.ts`, en un `<canvas>`.
 *
 * El árbol no está dibujado a mano: crece. Cada rama se parte en dos o tres más cortas y más
 * finas, y en las puntas brotan racimos de flores. La semilla es fija, así que el árbol es el
 * mismo en cada carga (no "cambia de forma" al recargar) y la prueba puede contar con él.
 *
 * Como `fondoPixel.ts`, vive en el bundle y lo inserta `ponerEstilo` solo la primera vez que
 * alguien elige sakura: quien no lo usa no carga ni un nodo.
 */

/** Los rosas de las flores, del más pálido al más hondo. Fijos: el sakura es este rosa. */
const ROSAS = ["#fff0f4", "#ffd6e2", "#ffc1d3", "#fbaac2", "#f590b0"];

/** El generador de siempre del repo (ver `estrellas` en `fondoPixel.ts`). */
function generador(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

interface Crecimiento {
  azar: () => number;
  ramas: string[];
  flores: string[];
  /** Entre qué ángulos puede apuntar una rama: así el árbol se abre hacia la pantalla. */
  minimo: number;
  maximo: number;
}

/** Un racimo: unas manchas de flor apiñadas y, encima, un par de flores enteras. */
function racimo(c: Crecimiento, x: number, y: number, tam: number): void {
  const manchas = 4 + Math.floor(c.azar() * 4);
  for (let i = 0; i < manchas; i++) {
    const a = c.azar() * Math.PI * 2;
    const d = c.azar() * tam;
    const radio = tam * (0.45 + c.azar() * 0.5);
    const color = ROSAS[1 + Math.floor(c.azar() * (ROSAS.length - 1))];
    c.flores.push(
      `<circle cx="${r1(x + Math.cos(a) * d)}" cy="${r1(y + Math.sin(a) * d)}" r="${r1(radio)}" ` +
      `fill="${color}" opacity="${r1(0.65 + c.azar() * 0.3)}"/>`
    );
  }
  const enteras = 1 + Math.floor(c.azar() * 2);
  for (let i = 0; i < enteras; i++) {
    const a = c.azar() * Math.PI * 2;
    const d = c.azar() * tam * 0.8;
    c.flores.push(
      `<use href="#sk-flor" transform="translate(${r1(x + Math.cos(a) * d)} ${r1(y + Math.sin(a) * d)}) ` +
      `rotate(${Math.round(c.azar() * 72)}) scale(${r1(tam / 14 + c.azar() * 0.3)})"/>`
    );
  }
}

function crecer(
  c: Crecimiento, x: number, y: number, angulo: number, largo: number, grosor: number, nivel: number
): void {
  const ang = Math.min(c.maximo, Math.max(c.minimo, angulo));
  const x2 = x + Math.cos(ang) * largo;
  const y2 = y + Math.sin(ang) * largo;
  // La curva: el punto de control se corre hacia un costado. Las ramas de cerezo nunca son
  // rectas, y un trazo recto es lo primero que delata un árbol hecho por código.
  const torcido = (c.azar() - 0.5) * 0.55;
  const cx = (x + x2) / 2 + Math.cos(ang + Math.PI / 2) * largo * torcido;
  const cy = (y + y2) / 2 + Math.sin(ang + Math.PI / 2) * largo * torcido;
  c.ramas.push(
    `<path d="M${r1(x)} ${r1(y)}Q${r1(cx)} ${r1(cy)} ${r1(x2)} ${r1(y2)}" stroke-width="${r1(grosor)}"/>`
  );
  if (nivel === 0) {
    racimo(c, x2, y2, 15 + c.azar() * 9);
    return;
  }
  // Las ramas finas también florecen a lo largo, no solo en la punta: así se ve cargado.
  if (nivel <= 3) racimo(c, cx, cy, 9 + c.azar() * 7);
  const hijos = c.azar() < 0.3 ? 3 : 2;
  for (let i = 0; i < hijos; i++) {
    const abertura = (i - (hijos - 1) / 2) * (0.5 + c.azar() * 0.35);
    crecer(c, x2, y2, ang + abertura + (c.azar() - 0.5) * 0.25,
      largo * (0.68 + c.azar() * 0.14), grosor * 0.64, nivel - 1);
  }
}

export interface Arbol {
  ramas: string[];
  flores: string[];
}

/**
 * Un árbol desde (x, y), con su primer tronco apuntando a `angulo` (radianes, 0 = derecha,
 * -π/2 = arriba). `minimo` y `maximo` acotan hacia dónde pueden ir las ramas.
 */
export function arbol(
  semilla: number, x: number, y: number, angulo: number, largo: number, grosor: number,
  niveles: number, minimo: number, maximo: number
): Arbol {
  const c: Crecimiento = { azar: generador(semilla), ramas: [], flores: [], minimo, maximo };
  crecer(c, x, y, angulo, largo, grosor, niveles);
  return { ramas: c.ramas, flores: c.flores };
}

/**
 * La flor de cinco pétalos con su muesca en la punta, que es lo que la hace sakura. Un `<g>` y
 * no un `<symbol>`: un `<symbol>` con `viewBox` usado sin ancho ni alto se estira a todo el
 * SVG, y cada flor salía del tamaño de la pantalla. El `<g>` mide sus 28 unidades y la escala
 * la pone cada `<use>`.
 */
const FLOR = `
  <g id="sk-flor">
    <g fill="#ffdbe5" stroke="#f093ae" stroke-width="0.6">
      ${[0, 72, 144, 216, 288].map((g) =>
        `<path transform="rotate(${g})" d="M0 0C5 -2 6 -8 2 -12L0 -10L-2 -12C-6 -8 -5 -2 0 0Z"/>`
      ).join("")}
    </g>
    <circle r="2.2" fill="#e0607e"/>
    <g fill="#c2456a">
      <circle cx="0" cy="-4.5" r="0.7"/><circle cx="4.2" cy="-1.4" r="0.7"/>
      <circle cx="2.6" cy="3.6" r="0.7"/><circle cx="-2.6" cy="3.6" r="0.7"/>
      <circle cx="-4.2" cy="-1.4" r="0.7"/>
    </g>
  </g>`;

function svgArbol(clase: string, viewBox: string, ajuste: string, a: Arbol, conFlor: boolean): string {
  return `
      <svg class="${clase}" viewBox="${viewBox}" preserveAspectRatio="${ajuste}" overflow="visible">
        ${conFlor ? `<defs>${FLOR}</defs>` : ""}
        <g class="sk-tronco" fill="none" stroke-linecap="round">${a.ramas.join("")}</g>
        <g class="sk-flores">${a.flores.join("")}</g>
      </svg>`;
}

export function fondoSakura(): string {
  // El cerezo: sube desde la esquina de abajo a la izquierda, inclinado hacia la pantalla.
  const cerezo = arbol(20261007, 50, 830, -Math.PI / 2 + 0.3, 175, 30, 6, -Math.PI * 0.97, 0.12);
  // La rama de arriba: entra por el borde derecho y cae hacia la izquierda.
  const rama = arbol(7031, 320, 20, Math.PI - 0.32, 120, 13, 5, Math.PI * 0.55, Math.PI * 1.2);
  return `
    <div class="fondo-sakura" id="fondo-sakura" aria-hidden="true">
      <div class="sk-sol"></div>
      <svg class="sk-fuji" viewBox="0 0 400 140" preserveAspectRatio="xMaxYMax meet">
        <path class="sk-monte" d="M0 140L150 34C168 22 182 18 200 18C218 18 232 22 250 34L400 140Z"/>
        <path class="sk-nieve" d="M150 34C168 22 182 18 200 18C218 18 232 22 250 34L236 46L222 38L208 50L194 40L180 50L166 41Z"/>
      </svg>
      <div class="sk-bruma"></div>
      ${svgArbol("sk-arbol", "0 0 420 820", "xMinYMax meet", cerezo, true)}
      ${svgArbol("sk-rama", "0 0 330 300", "xMaxYMin meet", rama, false)}
      <canvas class="petalos-fondo" id="petalos-fondo"></canvas>
    </div>`;
}
