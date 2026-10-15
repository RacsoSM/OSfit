/**
 * La insignia de cada rango: una figura distinta por rango, con borde de metal y un detalle
 * adentro, más adornada entre más alto (círculo, hexágono, triángulo, estrella, gema, estrella
 * de 8 puntas, gema con alas y corona). Elegidas por el entrenador (2026-10-11).
 *
 * SVG en línea y no imágenes: toman los colores de `COLORES_RANGO` y salen nítidas en
 * cualquier tamaño, de la grande del detalle a la chica de debajo de las barras.
 */

/**
 * El color de cada rango, de Principiante (0) a Élite (7): la paleta "hielo → fuego".
 * GEMELO: `--rango-0` … `--rango-7` en `estilos.css`, que pintan el mapa. Las insignias
 * necesitan el valor aquí para sacar el borde y los brillos.
 */
export const COLORES_RANGO: readonly string[] = [
  "#bfe3ff", "#7cc4ff", "#3b8fff", "#5b5bd6", "#9d4edd", "#e0457b", "#ff6b2c", "#ffb703",
];

/** Mezcla `hex` con `con` en proporción `t` (0 = `hex`, 1 = `con`). */
function mezclar(hex: string, con: string, t: number): string {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = rgb(hex);
  const b = rgb(con);
  return "#" + a.map((x, i) => Math.round(x + (b[i] - x) * t).toString(16).padStart(2, "0")).join("");
}

const f2 = (n: number) => n.toFixed(2);

/** Polígono regular de `n` lados, radio `r`, empezando arriba. */
function poligono(n: number, r: number, rot = -90): string {
  return Array.from({ length: n }, (_, k) => {
    const a = ((rot + (360 * k) / n) * Math.PI) / 180;
    return `${f2(32 + r * Math.cos(a))},${f2(32 + r * Math.sin(a))}`;
  }).join(" ");
}

/** Estrella de `p` puntas, radios exterior e interior. */
function estrella(p: number, ro: number, ri: number): string {
  return Array.from({ length: 2 * p }, (_, k) => {
    const r = k % 2 === 0 ? ro : ri;
    const a = ((-90 + (180 * k) / p) * Math.PI) / 180;
    return `${f2(32 + r * Math.cos(a))},${f2(32 + r * Math.sin(a))}`;
  }).join(" ");
}

/** Los puntos de `puntos` acercados a (cx, cy) en proporción `f`. */
function escalar(puntos: string, f: number, cx = 32, cy = 32): string {
  return puntos.split(" ").map((p) => {
    const [x, y] = p.split(",").map(Number);
    return `${f2(cx + (x - cx) * f)},${f2(cy + (y - cy) * f)}`;
  }).join(" ");
}

/**
 * La insignia del rango `indice` (0 = Principiante … 7 = Élite) a `tam` px. `id` tiene que
 * ser único en la página: los degradados del SVG se nombran con él, y dos insignias con el
 * mismo nombre se pintarían con los colores de la otra.
 */
export function insigniaRango(indice: number, tam: number, id: string): string {
  const i = Math.min(7, Math.max(0, Math.floor(indice)));
  const c = COLORES_RANGO[i];
  const borde = mezclar(c, "#000000", 0.45);
  const linea = mezclar(c, "#000000", 0.35);
  const def = `
    <defs>
      <linearGradient id="${id}-f" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${mezclar(c, "#ffffff", 0.45)}"/><stop offset=".5" stop-color="${c}"/>
        <stop offset="1" stop-color="${mezclar(c, "#000000", 0.25)}"/>
      </linearGradient>
      <linearGradient id="${id}-m" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${mezclar(c, "#ffffff", 0.55)}"/><stop offset=".45" stop-color="${borde}"/>
        <stop offset=".7" stop-color="${mezclar(c, "#ffffff", 0.55)}"/><stop offset="1" stop-color="${borde}"/>
      </linearGradient>
      <linearGradient id="${id}-h" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>`;
  const M = `url(#${id}-m)`;
  const F = `url(#${id}-f)`;
  const H = `url(#${id}-h)`;
  /** El borde de metal (`afuera`) y el cuerpo de color (`adentro`). */
  const capas = (afuera: string, adentro: string) =>
    `<polygon points="${afuera}" fill="${M}" stroke="${borde}" stroke-width="1.2" stroke-linejoin="round"/>`
    + `<polygon points="${adentro}" fill="${F}" stroke="${linea}" stroke-width="1" stroke-linejoin="round"/>`;

  const figuras: (() => string)[] = [
    // Principiante: círculo con un anillo adentro.
    () => `<circle cx="32" cy="32" r="25" fill="${M}" stroke="${borde}" stroke-width="1.2"/>`
      + `<circle cx="32" cy="32" r="19" fill="${F}" stroke="${linea}"/>`
      + `<circle cx="32" cy="32" r="9" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.5"/>`
      + `<ellipse cx="32" cy="22" rx="12" ry="6" fill="${H}"/>`,
    // Ascenso: hexágono con otro adentro.
    () => capas(poligono(6, 27), poligono(6, 20))
      + `<polygon points="${poligono(6, 10)}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.5" stroke-linejoin="round"/>`
      + `<polygon points="${poligono(6, 18)}" fill="${H}" opacity=".6"/>`,
    // En forma: triángulo con uno blanco al centro.
    () => capas("32,3 61,54 3,54", "32,14 51,48 13,48")
      + `<polygon points="32,27 40,41 24,41" fill="#fff" fill-opacity=".8"/>`
      + `<polygon points="32,14 41,30 23,30" fill="${H}"/>`,
    // Intermedio: estrella de 5 puntas con un punto al centro.
    () => capas(estrella(5, 30, 14), estrella(5, 22, 10))
      + `<circle cx="32" cy="33" r="5" fill="#fff" fill-opacity=".85"/>`,
    // Atlético: gema con sus facetas.
    () => capas("32,2 60,24 32,62 4,24", "32,11 51,25 32,52 13,25")
      + `<path d="M13 25 H51 M24 25 L32 11 L40 25 L32 52 L24 25" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`
      + `<polygon points="32,11 40,25 24,25" fill="#fff" fill-opacity=".45"/>`,
    // Fuerte: estrella de 8 puntas con una joya al centro.
    () => capas(estrella(8, 31, 22), estrella(8, 24, 17))
      + `<polygon points="${poligono(8, 11, -67.5)}" fill="${mezclar(c, "#ffffff", 0.35)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`
      + `<polygon points="${poligono(8, 5, -67.5)}" fill="#fff" fill-opacity=".8"/>`,
    // Avanzado: gema con alas.
    () => {
      const izq = "20,18 2,26 8,32 2,38 20,46 15,32";
      const der = "44,18 62,26 56,32 62,38 44,46 49,32";
      const ala = (p: string, cx: number) =>
        `<polygon points="${p}" fill="${M}" stroke="${borde}" stroke-width="1.2" stroke-linejoin="round"/>`
        + `<polygon points="${escalar(p, 0.7, cx, 32)}" fill="${F}"/>`;
      return ala(izq, 14) + ala(der, 50)
        + capas("32,4 50,28 32,60 14,28", "32,12 43,28 32,51 21,28")
        + `<path d="M21 28 H43 M32 12 V51" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/>`
        + `<polygon points="32,12 43,28 32,28" fill="#fff" fill-opacity=".4"/>`;
    },
    // Élite: corona con joyas.
    () => {
      const corona = "9,46 6,20 20,31 32,11 44,31 58,20 55,46";
      return `<polygon points="${corona}" fill="${M}" stroke="${borde}" stroke-width="1.2" stroke-linejoin="round"/>`
        + `<polygon points="${escalar(corona, 0.78, 32, 36)}" fill="${F}" stroke="${linea}" stroke-linejoin="round"/>`
        + `<rect x="8" y="46" width="48" height="9" rx="3" fill="${M}" stroke="${borde}" stroke-width="1.2"/>`
        + `<circle cx="32" cy="35" r="5.5" fill="#fff" stroke="${borde}"/>`
        + `<circle cx="20" cy="38" r="3.2" fill="#fff" fill-opacity=".85"/><circle cx="44" cy="38" r="3.2" fill="#fff" fill-opacity=".85"/>`
        + `<circle cx="6" cy="20" r="3" fill="#fff" stroke="${borde}"/><circle cx="32" cy="11" r="3.4" fill="#fff" stroke="${borde}"/>`
        + `<circle cx="58" cy="20" r="3" fill="#fff" stroke="${borde}"/>`;
    },
  ];
  return `<svg class="insignia-rango" viewBox="0 0 64 64" width="${tam}" height="${tam}" aria-hidden="true" focusable="false">${def}${figuras[i]()}</svg>`;
}
