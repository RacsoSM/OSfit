/**
 * El paisaje del estilo Halloween, ilustrado como un cuento de terror: una noche casi negra con
 * el horizonte rojo sangre y relámpagos lejanos, una luna de sangre con nubes que pasan y una
 * bruja que la cruza en su escoba, ojos rojos que miran desde la oscuridad,
 * murciélagos, telarañas con su araña colgando, fantasmas que flotan y, abajo, un cementerio
 * con una casa embrujada en la colina, árboles secos, lápidas, un fantasma que se asoma y
 * calabazas con la cara encendida.
 *
 * Todo es vector con curvas, como `sakura.ts`: nada de píxeles. Lo generado (estrellas,
 * árboles, telarañas, colinas) usa semilla fija: es igual en cada carga y la prueba puede
 * contar con él.
 *
 * Como los otros fondos con nodos, vive en el bundle y lo inserta `ponerEstilo` solo la primera
 * vez que alguien elige Halloween.
 */

/** El generador de siempre del repo (ver `estrellas` en `fondoPixel.ts`). */
function generador(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------- Las figuras ----------

/**
 * Una calabaza tallada con cara de malas intenciones (cejas fruncidas y una sonrisa de colmillos),
 * en una caja de 100×90. La cara (`hw-cara`) es la luz de la vela: el CSS
 * la hace titilar. `p` es el prefijo de los ids de sus degradados, para que dos calabazas en
 * documentos distintos (el fondo y la imagen de la transición) no se pisen.
 */
export function calabaza(p: string): string {
  return `
    <defs>
      <radialGradient id="${p}-piel" cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stop-color="#f08a35"/><stop offset="0.6" stop-color="#c9520f"/><stop offset="1" stop-color="#6e2306"/>
      </radialGradient>
      <radialGradient id="${p}-luz" cx="0.5" cy="0.5" r="0.6">
        <stop offset="0" stop-color="#fff1a0"/><stop offset="0.5" stop-color="#ffa21f"/><stop offset="1" stop-color="#d9360f"/>
      </radialGradient>
    </defs>
    <path d="M47 24C46 15 50 8 58 4L61 8C55 11 54 17 55 25Z" fill="#33361a"/>
    <path d="M56 9C64 6 70 9 72 14" fill="none" stroke="#3f4520" stroke-width="2" stroke-linecap="round"/>
    <g fill="url(#${p}-piel)" stroke="#5a1d05" stroke-width="1.6">
      <ellipse cx="28" cy="56" rx="24" ry="31"/>
      <ellipse cx="72" cy="56" rx="24" ry="31"/>
      <ellipse cx="50" cy="56" rx="20" ry="33"/>
    </g>
    <g class="hw-cara" fill="url(#${p}-luz)">
      <path d="M23 43L43 35L41 50Q31 51 23 43Z"/>
      <path d="M77 43L57 35L59 50Q69 51 77 43Z"/>
      <path d="M50 50L45 59L50 56L55 59Z"/>
      <path d="M17 57Q50 94 83 57L77 61L73 69L68 62L62 73L57 64L50 77L43 64L38 73L32 62L27 69L23 61Z"/>
    </g>`;
}

/**
 * La sábana del fantasma, en una caja de 60×74: cúpula arriba y el ruedo ondulado que se
 * deshace en el aire. Ojos huecos y la boca abierta en un lamento.
 */
export function fantasma(p: string): string {
  const ondas = 5;
  let ruedo = "";
  for (let i = 0; i < ondas; i++) {
    const x0 = 54 - (i * 48) / ondas;
    const x1 = 54 - ((i + 1) * 48) / ondas;
    ruedo += `Q${r1((x0 + x1) / 2)} ${i % 2 ? 74 : 62} ${r1(x1)} 68`;
  }
  return `
    <defs>
      <linearGradient id="${p}-sabana" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f2f4ff" stop-opacity="0.95"/>
        <stop offset="0.6" stop-color="#c9d4f0" stop-opacity="0.75"/>
        <stop offset="1" stop-color="#9fb0d8" stop-opacity="0.1"/>
      </linearGradient>
    </defs>
    <path d="M6 68V30C6 13 17 3 30 3C43 3 54 13 54 30V68${ruedo}Z" fill="url(#${p}-sabana)"/>
    <ellipse cx="21" cy="28" rx="4.4" ry="7.5" fill="#07040c" transform="rotate(-8 21 28)"/>
    <ellipse cx="39" cy="28" rx="4.4" ry="7.5" fill="#07040c" transform="rotate(8 39 28)"/>
    <ellipse cx="30" cy="48" rx="4.6" ry="9.5" fill="#07040c"/>`;
}

/** Un murciélago de alas festoneadas, en una caja de 100×44. */
export const MURCIELAGO = `
  <g fill="#140a1f">
    <path d="M47 20C40 8 24 4 3 12C10 14 13 19 13 24C17 20 22 21 24 26C28 21 34 22 36 28C40 23 44 24 47 27Z"/>
    <path d="M53 20C60 8 76 4 97 12C90 14 87 19 87 24C83 20 78 21 76 26C72 21 66 22 64 28C60 23 56 24 53 27Z"/>
    <ellipse cx="50" cy="23" rx="7" ry="10"/>
    <path d="M44 16L45 7L49 14ZM56 16L55 7L51 14Z"/>
  </g>
  <circle cx="47.5" cy="19" r="1.4" fill="#ff5a5a"/><circle cx="52.5" cy="19" r="1.4" fill="#ff5a5a"/>`;

/** La bruja en su escoba, a contraluz, en una caja de 120×70. */
const BRUJA = `
  <g fill="#120818">
    <path d="M24 47C14 44 6 40 0 35C3 43 2 50 0 58C7 54 15 52 24 51Z"/>
    <path d="M22 48L118 39L118 42L22 51Z"/>
    <path d="M60 22C50 26 40 34 30 40C42 39 50 41 56 45Z"/>
    <path d="M56 45C51 32 53 23 61 19C68 23 72 33 73 43Z"/>
    <circle cx="63" cy="15" r="5.5"/>
    <path d="M51 12L76 9L67 7C64 -1 59 -8 51 -12C56 -4 58 1 58 7Z" transform="translate(0 4)"/>
    <path d="M67 42C70 46 72 50 76 51L80 50L78 53C73 54 69 51 65 45Z"/>
  </g>`;

/** Una araña colgando, en una caja de 40×36. */
const ARANA = `
  <g fill="none" stroke="#0b0612" stroke-width="1.8" stroke-linecap="round">
    <path d="M16 16Q8 8 3 12M16 19Q7 16 2 22M16 21Q8 25 4 32M17 23Q12 30 10 35"/>
    <path d="M24 16Q32 8 37 12M24 19Q33 16 38 22M24 21Q32 25 36 32M23 23Q28 30 30 35"/>
  </g>
  <ellipse cx="20" cy="22" rx="7" ry="8" fill="#1a0e26"/>
  <circle cx="20" cy="13" r="4.5" fill="#1a0e26"/>
  <circle cx="18.3" cy="12.5" r="1.1" fill="#ff3b3b"/><circle cx="21.7" cy="12.5" r="1.1" fill="#ff3b3b"/>`;

/**
 * Una telaraña de esquina, con el centro en (0, 0) y abierta hacia abajo a la derecha: rayos
 * en abanico y anillos que se vencen hacia el centro entre rayo y rayo, como una de verdad.
 */
export function telarana(radio: number, semilla: number): string {
  const azar = generador(semilla);
  const RAYOS = 7;
  const angulos = Array.from({ length: RAYOS }, (_, i) => (i / (RAYOS - 1)) * (Math.PI / 2));
  let d = angulos.map((a) => `M0 0L${r1(Math.cos(a) * radio * 1.45)} ${r1(Math.sin(a) * radio * 1.45)}`).join("");
  for (let r = radio * 0.12; r < radio * 1.4; r *= 1.32 + azar() * 0.1) {
    const radios = angulos.map(() => r * (0.9 + azar() * 0.2));
    d += `M${r1(radios[0])} 0`;
    for (let i = 0; i < RAYOS - 1; i++) {
      const medio = (angulos[i] + angulos[i + 1]) / 2;
      const hundido = ((radios[i] + radios[i + 1]) / 2) * 0.78;
      const fin = angulos[i + 1];
      d += `Q${r1(Math.cos(medio) * hundido)} ${r1(Math.sin(medio) * hundido)} ` +
        `${r1(Math.cos(fin) * radios[i + 1])} ${r1(Math.sin(fin) * radios[i + 1])}`;
    }
  }
  return d;
}

// ---------- El cementerio ----------

/** Ancho y alto del cementerio en unidades del dibujo. */
const ANCHO = 1200;
const ALTO = 300;

/** Dónde está el suelo de adelante en cada x. Ondula: es tierra, no una mesa. */
export function suelo(x: number): number {
  return 252 + 8 * Math.sin(x / 90) + 5 * Math.sin(x / 37 + 2);
}

/** Una colina suave que sigue a `altura`, cerrada por abajo. */
function colina(altura: (x: number) => number): string {
  let d = `M0 ${ALTO}L0 ${r1(altura(0))}`;
  for (let x = 0; x < ANCHO; x += 40) {
    d += `Q${x + 20} ${r1(altura(x + 20))} ${x + 40} ${r1(altura(x + 40))}`;
  }
  return `${d}L${ANCHO} ${ALTO}Z`;
}

/** Una rama seca y torcida que se parte en dos, cada vez más fina. Sin una hoja. */
function ramaSeca(
  azar: () => number, ramas: string[], x: number, y: number, angulo: number, largo: number, grosor: number, nivel: number
): void {
  const x2 = x + Math.cos(angulo) * largo;
  const y2 = y + Math.sin(angulo) * largo;
  const torcido = (azar() - 0.5) * 0.7;
  const cx = (x + x2) / 2 + Math.cos(angulo + Math.PI / 2) * largo * torcido;
  const cy = (y + y2) / 2 + Math.sin(angulo + Math.PI / 2) * largo * torcido;
  ramas.push(`<path d="M${r1(x)} ${r1(y)}Q${r1(cx)} ${r1(cy)} ${r1(x2)} ${r1(y2)}" stroke-width="${r1(grosor)}"/>`);
  if (nivel === 0) return;
  const hijos = azar() < 0.35 ? 3 : 2;
  for (let i = 0; i < hijos; i++) {
    const abertura = (i - (hijos - 1) / 2) * (0.55 + azar() * 0.4);
    ramaSeca(azar, ramas, x2, y2, angulo + abertura + (azar() - 0.5) * 0.4,
      largo * (0.66 + azar() * 0.16), grosor * 0.62, nivel - 1);
  }
}

/** Las ramas de un árbol seco que nace del suelo en `x`. */
export function arbolSeco(semilla: number, x: number, largo: number, grosor: number, niveles: number): string[] {
  const ramas: string[] = [];
  ramaSeca(generador(semilla), ramas, x, suelo(x) + 6, -Math.PI / 2 + 0.08, largo, grosor, niveles);
  return ramas;
}

/** Una lápida de punta redonda, un poco ladeada, con una cruz grabada. */
function lapida(x: number, ancho: number, alto: number, giro: number): string {
  const b = suelo(x + ancho / 2) + 4;
  const r = ancho / 2;
  const c = x + r;
  return `<g transform="rotate(${giro} ${r1(c)} ${r1(b)})">
      <path class="hw-piedra" d="M${r1(x)} ${r1(b)}V${r1(b - alto + r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + ancho)} ${r1(b - alto + r)}V${r1(b)}Z"/>
      <path class="hw-grabado" d="M${r1(c)} ${r1(b - alto + r * 0.6)}v${r1(alto * 0.36)}M${r1(c - r * 0.35)} ${r1(b - alto + r * 0.95)}h${r1(r * 0.7)}"/>
    </g>`;
}

/** Una cruz de piedra. */
function cruz(x: number, alto: number, giro: number): string {
  const b = suelo(x) + 4;
  return `<path class="hw-piedra" transform="rotate(${giro} ${x} ${r1(b)})"
      d="M${x - 5} ${r1(b)}V${r1(b - alto + 30)}H${x - 18}V${r1(b - alto + 18)}H${x - 5}V${r1(b - alto)}H${x + 5}V${r1(b - alto + 18)}H${x + 18}V${r1(b - alto + 30)}H${x + 5}V${r1(b)}Z"/>`;
}

/** Un tramo de reja de hierro: barrotes con punta de lanza y dos travesaños. */
function reja(desde: number, hasta: number): string {
  let d = "";
  for (let x = desde; x <= hasta; x += 12) {
    const b = suelo(x) + 4;
    d += `M${x - 1.5} ${r1(b)}V${r1(b - 40)}L${x} ${r1(b - 47)}L${x + 1.5} ${r1(b - 40)}V${r1(b)}Z`;
  }
  const y = (x: number) => suelo(x) + 4;
  d += `M${desde} ${r1(y(desde) - 33)}L${hasta} ${r1(y(hasta) - 33)}v2.5L${desde} ${r1(y(desde) - 30.5)}Z`;
  d += `M${desde} ${r1(y(desde) - 12)}L${hasta} ${r1(y(hasta) - 12)}v2.5L${desde} ${r1(y(desde) - 9.5)}Z`;
  return `<path class="hw-hierro" d="${d}"/>`;
}

/** La casa embrujada en lo alto de la colina de atrás, con dos ventanas encendidas. */
const CASA = `
  <g transform="translate(700 150)">
    <path class="hw-lejos" d="M0 70V30L30 8L60 30V70ZM40 22V-4H52V30ZM-26 70V42L-10 30L6 42V70ZM44 -4L46 -26L58 -4Z"/>
    <path class="hw-ventana" d="M18 38h9v12h-9zM34 38h9v12h-9zM-14 48h7v9h-7z"/>
    <path class="hw-ventana tenue" d="M43 4h6v8h-6z"/>
  </g>`;

/**
 * Ojos rojos que miran desde la oscuridad del cementerio y parpadean de vez en cuando: la x
 * del ojo izquierdo, cuánto por encima del suelo y la separación (más chica = más lejos).
 */
export const OJOS_EN_LA_OSCURIDAD: readonly [number, number, number][] = [
  [356, 10, 9], [548, 6, 7], [742, 30, 6], [884, 8, 8], [1148, 12, 9], [196, 9, 8],
];

function ojos([x, alto, separacion]: readonly [number, number, number], i: number): string {
  const y = r1(suelo(x) - alto);
  const r = separacion / 3;
  return `<g class="hw-ojos o${i % 4}" transform="translate(${x} ${y})">
      <circle cx="${r1(separacion / 2)}" cy="0" r="${r1(separacion * 1.4)}" fill="url(#hw-fulgor-ojo)"/>
      <ellipse class="hw-pupila" cx="0" cy="0" rx="${r1(r)}" ry="${r1(r * 0.6)}"/>
      <ellipse class="hw-pupila" cx="${separacion}" cy="0" rx="${r1(r)}" ry="${r1(r * 0.6)}"/>
    </g>`;
}

/** Dónde van las calabazas del cementerio: la x de su centro y su escala. */
export const CALABAZAS_DEL_SUELO: readonly [number, number][] = [
  [470, 0.9], [690, 0.55], [860, 0.75], [240, 0.7], [1010, 0.8],
];

function calabazaEnElSuelo(x: number, escala: number, i: number): string {
  const y = suelo(x) + 6 - 88 * escala;
  return `<g transform="translate(${r1(x - 50 * escala)} ${r1(y)}) scale(${escala})">
      <ellipse class="hw-resplandor r${i % 3}" cx="50" cy="58" rx="80" ry="60" fill="url(#hw-brillo)"/>
      <g class="hw-vela v${i % 3}">${calabaza(`hw-c${i}`)}</g>
    </g>`;
}

/** Las estrellas: tres grupos que titilan por turnos, más apretadas arriba. */
export function estrellas(cantidad: number, semilla: number): string[] {
  const azar = generador(semilla);
  const grupos = ["", "", ""];
  for (let i = 0; i < cantidad; i++) {
    const x = r1(azar() * 400);
    const y = r1(azar() ** 1.5 * 800);
    const radio = r1(0.5 + azar() * 1.1);
    grupos[i % 3] += `<circle cx="${x}" cy="${y}" r="${radio}"/>`;
  }
  return grupos;
}

export function fondoHalloween(): string {
  const [e1, e2, e3] = estrellas(110, 31102026);
  const arboles = [
    arbolSeco(1031, 420, 70, 16, 5),
    arbolSeco(2026, 1060, 60, 13, 5),
    arbolSeco(1310, 130, 55, 12, 4),
  ].flat();
  const fantasmas = [1, 2, 3].map((n) =>
    `<svg class="hw-fantasma f${n}" viewBox="0 0 60 74">${fantasma(`hw-f${n}`)}</svg>`
  ).join("");
  const murcielagos = [1, 2, 3, 4].map((n) =>
    `<svg class="hw-murcielago m${n}" viewBox="0 0 100 44"><g class="hw-alas">${MURCIELAGO}</g></svg>`
  ).join("");
  return `
    <div class="fondo-halloween" id="fondo-halloween" aria-hidden="true">
      <svg class="hw-estrellas" viewBox="0 0 400 800" preserveAspectRatio="xMidYMin slice">
        <g class="uno">${e1}</g><g class="dos">${e2}</g><g class="tres">${e3}</g>
      </svg>
      <div class="hw-cielo-luna">
        <div class="hw-halo"></div>
        <div class="hw-luna"></div>
        <svg class="hw-bruja" viewBox="0 -12 120 82">${BRUJA}</svg>
        <i class="hw-nube uno"></i><i class="hw-nube dos"></i>
      </div>
      ${murcielagos}
      <svg class="hw-telarana izquierda" viewBox="0 0 160 160">
        <path d="${telarana(150, 1031)}"/>
      </svg>
      <svg class="hw-telarana derecha" viewBox="0 0 160 160">
        <path d="${telarana(150, 2026)}"/>
      </svg>
      <div class="hw-arana"><svg viewBox="0 0 40 36">${ARANA}</svg></div>
      ${fantasmas}
      <svg class="hw-paisaje" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id="hw-brillo">
            <stop offset="0" stop-color="#ff8a2e" stop-opacity="0.6"/>
            <stop offset="0.5" stop-color="#c2260f" stop-opacity="0.2"/>
            <stop offset="1" stop-color="#c2260f" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="hw-fulgor-ojo">
            <stop offset="0" stop-color="#ff2a2a" stop-opacity="0.7"/>
            <stop offset="1" stop-color="#ff2a2a" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <path class="hw-lejos" d="${colina((x) => 200 + 18 * Math.sin(x / 160 + 1) + 8 * Math.sin(x / 61))}"/>
        ${CASA}
        <g transform="translate(604 ${r1(suelo(634) - 66)})"><g class="hw-asomado">${fantasma("hw-fa")}</g></g>
        <g class="hw-tronco" fill="none" stroke-linecap="round">${arboles.join("")}</g>
        <path class="hw-cerca" d="${colina(suelo)}"/>
        ${lapida(520, 34, 50, -4)}${cruz(580, 64, 3)}${lapida(612, 44, 62, 2)}
        ${lapida(760, 32, 46, 5)}${cruz(812, 58, -4)}${lapida(310, 30, 44, -3)}
        ${lapida(905, 36, 52, 3)}${cruz(965, 60, 2)}${lapida(60, 34, 48, -2)}
        ${reja(140, 210)}${reja(1100, 1180)}
        ${OJOS_EN_LA_OSCURIDAD.map(ojos).join("")}
        ${CALABAZAS_DEL_SUELO.map(([x, escala], i) => calabazaEnElSuelo(x, escala, i)).join("")}
      </svg>
      <i class="hw-niebla uno"></i>
      <i class="hw-niebla dos"></i>
      <i class="hw-vineta"></i>
      <i class="hw-relampago"></i>
    </div>`;
}

// ---------- Lo que se mueve con el dedo y en la transición ----------

/** Una figura como `<svg>` suelto, para usarla de imagen de fondo. */
function svgSuelto(viewBox: string, contenido: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${contenido}</svg>`;
}

/** Un `<svg>` como valor de `background-image`, para `element.style`. */
export function comoImagen(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const IMAGEN_MURCIELAGO = (): string => comoImagen(svgSuelto("0 0 100 44", MURCIELAGO));
export const IMAGEN_CALABAZA = (): string => comoImagen(svgSuelto("0 0 100 90", calabaza("t")));
const IMAGEN_FANTASMA = (): string => comoImagen(svgSuelto("0 0 60 74", fantasma("s")));

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
  const imagen = IMAGEN_FANTASMA();
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
