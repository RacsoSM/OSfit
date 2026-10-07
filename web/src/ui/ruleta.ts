// web/src/ui/ruleta.ts
import { jugarRuleta } from "../acciones";
import {
  MINIMO_GIRO_LIBRE_MS,
  COLORES,
  SECTORES,
  anguloActual,
  arcoDelSector,
  colorBajoElPuntero,
  frenar,
  girarLibre,
  varillaEn,
} from "./ruletaGiro";
import { celebrar, entrar, pintarGema, vigilar } from "./ruletaEfectos";
import type { Color } from "./ruletaGiro";

/**
 * El modal de la ruleta: la propuesta, la elección de color, el giro y el acuse.
 *
 * Vive en su propio nodo `#ruleta`, fuera de `#contenido`. No es un capricho de orden: la
 * página rehace el `innerHTML` de `#contenido` en CADA snapshot de Firestore, y una ruleta
 * girando ahí dentro se moriría a media tirada en cuanto el entrenador marcara una
 * asistencia. Es el mismo motivo por el que el saludo y los videos ya viven fuera.
 */

/** Reexportado: el tipo vive junto al reparto del dibujo, en `ruletaGiro.ts`. */
export type { Color };

type Fase =
  | { tipo: "propuesta" }
  | { tipo: "girando-real" }
  | { tipo: "girando-prueba" }
  | { tipo: "gano"; color: Color }
  | { tipo: "perdio"; color: Color }
  | { tipo: "prueba"; color: Color }
  | { tipo: "error"; texto: string };

interface Estado {
  abierta: boolean;
  color: Color | null;
  fase: Fase;
}

const estado: Estado = { abierta: false, color: null, fase: { tipo: "propuesta" } };

/**
 * Si el próximo pintado de la rueda tiene que hacer la entrada. Sólo al abrir el modal y al
 * volver de una tirada de prueba: cualquier otro repintado (elegir ficha, por ejemplo) rehace
 * el nodo y no debe volver a presentarla.
 */
let entradaPendiente = false;

/** Espera [ms] milisegundos. */
const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

export function abrirRuleta(): void {
  estado.abierta = true;
  entradaPendiente = true;
  estado.color = null;
  estado.fase = { tipo: "propuesta" };
}

export function cerrarRuleta(): void {
  estado.abierta = false;
  estado.color = null;
  estado.fase = { tipo: "propuesta" };
}

export function ruletaAbierta(): boolean {
  return estado.abierta;
}

/** Exportadas para los tests: son los tres cambios de estado que el HTML refleja. */
export function elegirColor(color: Color): void {
  estado.color = color;
}

export function marcarResultado(fase: Fase): void {
  estado.fase = fase;
}

/**
 * Cómo se nombra cada color. Son dos formas porque las dos frases piden gramática distinta:
 * "Cayó en ___" y "Apostar ___"; unificarlas en una sola cadena deja una de las dos mal
 * escrita, y hay un test que lo dice.
 *
 * **Nombrar el tono sólo es correcto porque los colores son fijos** (2026-09-22). Mientras el
 * sector fue `var(--primario)` esto decía "morado" y mentía con toda clienta que no tuviera la
 * paleta de por defecto — ver la entrada 26 del backlog. Si alguien vuelve a atar la rueda a
 * la paleta, esto vuelve a mentir.
 */
const NOMBRE: Record<Color, { cayo: string; apuesta: string }> = {
  rojo: { cayo: "rojo", apuesta: "al rojo" },
  negro: { cayo: "negro", apuesta: "al negro" },
};

const girando = (fase: Fase) => fase.tipo === "girando-real" || fase.tipo === "girando-prueba";

/** El acuse de cada desenlace. El de perder NOMBRA el costo: "perdiste" a secas no informa. */
function acuse(fase: Fase): string {
  switch (fase.tipo) {
    case "gano":
      return `<p class="aviso-ok">Cayó en ${NOMBRE[fase.color].cayo}. ¡Has revivido tu racha!</p>`;
    case "perdio":
      return `<p class="aviso-error">Cayó en ${NOMBRE[fase.color].cayo}. El próximo mes tendrás
              2 revives en vez de 3.</p>`;
    case "prueba":
      return `<p class="accion-nota">Cayó en ${NOMBRE[fase.color].cayo}. Tirada de prueba — esta no cuenta.</p>`;
    case "error":
      return `<p class="aviso-error">${fase.texto}</p>`;
    default:
      return "";
  }
}

/** Focos del aro. Van en el aro, que NO gira, y parpadean alternos como en el video. */
const FOCOS = 16;

/** Destellos sobre los gajos. Giran con ellos: en el video van pegados a la pintura. */
const DESTELLOS = 18;

/**
 * Posiciones de los destellos. Pseudoazar con semilla fija, no `Math.random()`: `pintarRuleta`
 * compara el HTML contra lo último pintado, y un dibujo distinto en cada llamada repintaría la
 * rueda en cada snapshot de Firestore y la congelaría a media vuelta.
 */
function destellos(): string {
  let semilla = 7;
  const azar = () => {
    semilla = (semilla * 16807) % 2147483647;
    return (semilla - 1) / 2147483646;
  };
  return Array.from({ length: DESTELLOS }, (_, i) => {
    const rad = azar() * 2 * Math.PI;
    const r = 16 + Math.sqrt(azar()) * 62;
    const x = (100 + r * Math.cos(rad)).toFixed(1);
    const y = (100 + r * Math.sin(rad)).toFixed(1);
    const tam = (1.6 + azar() * 3.2).toFixed(1);
    const retraso = ((i * 0.37) % 1.6).toFixed(2);
    return `<circle class="ruleta-destello" cx="${x}" cy="${y}" r="${tam}"
              style="animation-delay:-${retraso}s"></circle>`;
  }).join("");
}

/** El puntero: un pin dorado con la punta hacia abajo, tocando los gajos. */
const PIN =
  "M100,24 L89,9 Q86,5 86,0 L86,-9 Q86,-17 94,-17 L106,-17 Q114,-17 114,-9 " +
  "L114,0 Q114,5 111,9 Z";

/** La gema del pin: un octógono centrado en (100, -4). */
const GEMA = Array.from({ length: 8 }, (_, i) => {
  const rad = ((i * 45 + 22.5) * Math.PI) / 180;
  return `${(100 + 9 * Math.cos(rad)).toFixed(2)},${(-4 + 9 * Math.sin(rad)).toFixed(2)}`;
}).join(" ");

/** El degradado de un gajo: claro hacia el eje y oscuro hacia el aro, como en el video. */
function degradado(color: Color, claro: string, medio: string, oscuro: string): string {
  return `<radialGradient id="ruleta-gajo-${color}" gradientUnits="userSpaceOnUse"
                          cx="100" cy="100" r="84">
            <stop offset="0%" stop-color="${claro}"></stop>
            <stop offset="62%" stop-color="${medio}"></stop>
            <stop offset="100%" stop-color="${oscuro}"></stop>
          </radialGradient>`;
}

/**
 * La rueda de concurso, copiada del video de referencia con nuestros dos colores: aro dorado
 * con focos, halo, gajos con destellos separados por varillas negras, eje dorado y un pin
 * arriba cuya gema toma el color del gajo que tiene debajo.
 *
 * **Qué gira y qué no.** Sólo `#ruleta-rueda` (gajos, tintes, varillas y destellos). El aro, los
 * focos, el eje y el pin se quedan quietos. El grupo que gira necesita `transform-box:
 * fill-box` en el CSS, o `rotate()` pivota sobre el origen del viewBox.
 *
 * Los `ruleta-tinte` son una copia de cada gajo, invisible, que el final (`celebrar`) pinta del
 * color ganador uno a uno. La silueta `ruleta-blanco` es el destello blanco de la entrada, del
 * final y de la salida.
 *
 * `aria-hidden` porque es decoración: quien no lo ve se entera por el acuse, que es texto.
 */
function rueda(): string {
  const casillas = SECTORES.map(
    (s) => `<path class="ruleta-sector ${s.color}" d="${arcoDelSector(s)}"></path>`
  ).join("");

  const tintes = SECTORES.map(
    (s) => `<path class="ruleta-tinte" d="${arcoDelSector(s)}"></path>`
  ).join("");

  const varillas = SECTORES.map((s) => {
    const v = varillaEn(s.desde);
    return `<line class="ruleta-varilla" x1="${v.x1}" y1="${v.y1}" x2="${v.x2}" y2="${v.y2}"></line>`;
  }).join("");

  const focos = Array.from({ length: FOCOS }, (_, i) => {
    const rad = ((i * 360) / FOCOS + 360 / FOCOS / 2) * (Math.PI / 180);
    const x = (100 + 91 * Math.sin(rad)).toFixed(2);
    const y = (100 - 91 * Math.cos(rad)).toFixed(2);
    return `<circle class="ruleta-foco ${i % 2 ? "impar" : "par"}" cx="${x}" cy="${y}" r="2.7"></circle>`;
  }).join("");

  // El halo: arcos alternos rojo y dorado, desenfocados, dando vueltas despacio alrededor del
  // aro. Es el arcoíris del video traído a nuestros colores.
  const halo = Array.from({ length: 12 }, (_, i) => {
    const desde = ((i * 30 - 90) * Math.PI) / 180;
    const hasta = (((i + 1) * 30 - 90) * Math.PI) / 180;
    const p = (a: number) => `${(100 + 100 * Math.cos(a)).toFixed(2)},${(100 + 100 * Math.sin(a)).toFixed(2)}`;
    return `<path class="ruleta-halo-arco ${i % 2 ? "oro" : "rojo"}"
                  d="M${p(desde)} A100,100 0 0,1 ${p(hasta)}"></path>`;
  }).join("");

  return `
    <svg class="ruleta-svg" viewBox="-14 -24 228 238" aria-hidden="true" focusable="false">
      <defs>
        ${degradado("rojo", "#e0434d", "#b81f2c", "#7a1018")}
        ${degradado("negro", "#4d4d57", "#25252b", "#09090b")}
        <linearGradient id="ruleta-oro" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stop-color="#fff2a8"></stop>
          <stop offset="30%" stop-color="#f6c534"></stop>
          <stop offset="55%" stop-color="#d99a12"></stop>
          <stop offset="80%" stop-color="#f7cf45"></stop>
          <stop offset="100%" stop-color="#b9780a"></stop>
        </linearGradient>
        <radialGradient id="ruleta-eje" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stop-color="#fff8cf"></stop>
          <stop offset="50%" stop-color="#f1bf35"></stop>
          <stop offset="100%" stop-color="#a86d08"></stop>
        </radialGradient>
        <radialGradient id="ruleta-foco-luz" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff"></stop>
          <stop offset="45%" stop-color="#fff6c4"></stop>
          <stop offset="100%" stop-color="#ffd23f"></stop>
        </radialGradient>
        <radialGradient id="ruleta-chispa" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"></stop>
          <stop offset="35%" stop-color="#ffffff" stop-opacity="0.45"></stop>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"></stop>
        </radialGradient>
        <filter id="ruleta-desenfoque-halo" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3"></feGaussianBlur>
        </filter>
        <filter id="ruleta-estela" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur id="ruleta-estela-desenfoque" stdDeviation="0"></feGaussianBlur>
        </filter>
        <filter id="ruleta-resplandor" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="halo"></feGaussianBlur>
          <feMerge><feMergeNode in="halo"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
        </filter>
        <filter id="ruleta-sombra" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.5">
          </feDropShadow>
        </filter>
      </defs>

      <g class="ruleta-halo" filter="url(#ruleta-desenfoque-halo)">${halo}</g>

      <g filter="url(#ruleta-sombra)">
        <circle class="ruleta-aro" cx="100" cy="100" r="91"></circle>
      </g>
      <circle class="ruleta-aro-filo" cx="100" cy="100" r="98"></circle>
      ${focos}

      <g filter="url(#ruleta-estela)">
        <g class="ruleta-rueda" id="ruleta-rueda">
          ${casillas}
          ${tintes}
          ${destellos()}
          ${varillas}
        </g>
      </g>
      <circle class="ruleta-borde" cx="100" cy="100" r="84"></circle>

      <circle class="ruleta-eje" cx="100" cy="100" r="11"></circle>
      <ellipse class="ruleta-eje-brillo" cx="97" cy="96.5" rx="5" ry="3"
               transform="rotate(-25 97 96.5)"></ellipse>

      <g class="ruleta-pin" filter="url(#ruleta-sombra)">
        <path class="ruleta-pin-cuerpo" d="${PIN}"></path>
        <polygon id="ruleta-gema" class="ruleta-gema ${colorBajoElPuntero(0)}"
                 points="${GEMA}"></polygon>
        <ellipse class="ruleta-gema-brillo" cx="97" cy="-7.5" rx="3.6" ry="2.2"></ellipse>
      </g>

      <!-- La silueta blanca: el destello de la entrada, del final y de la salida. -->
      <g class="ruleta-blanco" filter="url(#ruleta-resplandor)">
        <circle cx="100" cy="100" r="99"></circle>
        <path d="${PIN}"></path>
      </g>
    </svg>`;
}

export function modalRuleta(): string {
  if (!estado.abierta) return "";

  const terminada = estado.fase.tipo === "gano" || estado.fase.tipo === "perdio";
  const enJuego = girando(estado.fase);
  const jugarBloqueado = estado.color === null || enJuego || terminada;

  const eleccion = COLORES
    .map(
      (c) => `<button class="ruleta-ficha ${c} ${estado.color === c ? "elegida" : ""}"
                       id="ruleta-color-${c}" ${enJuego || terminada ? "disabled" : ""}
                       aria-label="Apostar ${NOMBRE[c].apuesta}"></button>`
    )
    .join("");

  // La ✕ no se dibuja mientras gira: cerrar a media tirada dejaría al cliente sin saber qué
  // pasó con una apuesta que el servidor ya cobró.
  const salida = enJuego
    ? ""
    : `<button id="ruleta-cerrar" class="ruleta-x" aria-label="Cerrar">✕</button>`;

  const botones = terminada
    ? `<button id="ruleta-listo" class="boton">Listo</button>`
    : `<div class="fila-botones">
         <button id="ruleta-prueba" class="boton secundario" ${enJuego ? "disabled" : ""}>
           Tirada de prueba
         </button>
         <button id="ruleta-jugar" class="boton" ${jugarBloqueado ? "disabled" : ""}>
           ${estado.fase.tipo === "girando-real" ? "Girando…" : "Jugar"}
         </button>
       </div>`;

  // La propuesta con su costo solo se pinta mientras nadie ha jugado: repetirla junto al
  // acuse de "ganaste" mezclaría el premio con un castigo que ya no aplica a esta tirada.
  //
  // El error entra acá porque desde ahí se vuelve a apostar: es el único estado en el que la
  // clienta puede tocar "Jugar", y hacerlo sin las condiciones delante sería pedirle que
  // reapueste a ciegas.
  // Mientras gira se OCULTA pero se queda ocupando su sitio (`invisible`, que es
  // `visibility: hidden`). Quitarla del todo encoge el modal cuatro líneas justo en el
  // instante en que la clienta está mirando la rueda, y el salto se ve como un fallo.
  const propuesta =
    estado.fase.tipo === "propuesta" || estado.fase.tipo === "error" || enJuego
      ? `<div class="${enJuego ? "invisible" : ""}">
         <p class="confirmar-titulo">Te propongo un juego.</p>
         <p class="accion-nota">
           Si adivinas en qué color caerá la ruleta, te revivo tu racha. Si no le atinas, el
           próximo mes tendrás solo 2 oportunidades para revivir en vez de 3.
         </p>
         <p class="ruleta-pregunta">¿Quieres jugar?</p>
         </div>`
      : "";

  // La rueda se queda siempre, también tras la tirada real: después de su salida (`celebrar`)
  // vuelve con su entrada, quieta en el gajo donde cayó, junto al acuse.
  const marco = `<div class="ruleta-marco">${rueda()}</div>`;

  return `
    <div class="ruleta-fondo">
      <div class="ruleta-caja" role="dialog" aria-modal="true" aria-label="Te propongo un juego">
        ${salida}
        ${propuesta}
        <div class="ruleta-fichas">${eleccion}</div>
        ${marco}
        ${acuse(estado.fase)}
        ${botones}
      </div>
    </div>`;
}

/** Traduce el código de la `HttpsError` a algo que el cliente pueda hacer algo con ello. */
function textoDeError(codigo: string | undefined): string {
  if (codigo === "functions/already-exists") return "Ya jugaste tu tirada de este mes.";
  if (codigo === "functions/permission-denied")
    return "Tu cuenta está pausada. Habla con tu entrenador.";
  if (codigo === "functions/failed-precondition") return "Ya no hay nada que revivir.";
  return "No pudimos girar la ruleta. Inténtalo otra vez en un momento.";
}

/**
 * Se vuelve a llamar en cada repintado del nodo `#ruleta`, porque `innerHTML` tira los
 * listeners anteriores — igual que en `accionFalta.ts`.
 */
export function conectarRuleta(repintar: () => void): void {
  if (!estado.abierta) return;

  const lienzo = () => document.querySelector<SVGSVGElement>("#ruleta .ruleta-svg");
  const disco = () => document.querySelector<SVGGElement>("#ruleta-rueda");

  // La gema se pinta con el ángulo REAL: `pintarRuleta` le rescata a la rueda nueva el ángulo
  // de la vieja, y el HTML sale con la gema de la rueda sin girar.
  const svg = lienzo();
  const r0 = disco();
  if (svg && r0 && !girando(estado.fase)) pintarGema(svg, colorBajoElPuntero(anguloActual(r0)));
  if (svg && entradaPendiente) {
    entradaPendiente = false;
    entrar(svg);
  }

  for (const c of COLORES) {
    document.querySelector(`#ruleta-color-${c}`)?.addEventListener("click", () => {
      elegirColor(c);
      repintar();
    });
  }

  document.querySelector("#ruleta-cerrar")?.addEventListener("click", () => {
    cerrarRuleta();
    repintar();
  });

  document.querySelector("#ruleta-listo")?.addEventListener("click", () => {
    cerrarRuleta();
    repintar();
  });

  /**
   * La tirada entera, la real y la de prueba por igual: arranque y giro libre, frenado hasta
   * [resultado] y el final del video. La fase se queda en "girando" hasta que termina el final,
   * así no hay repintado que corte la animación a la mitad.
   */
  async function tirar(resultado: Promise<Color>): Promise<Color> {
    const svg = lienzo();
    const r = disco();
    if (r) girarLibre(r);
    const parar = svg ? vigilar(svg) : () => {};
    try {
      const [color] = await Promise.all([resultado, esperar(MINIMO_GIRO_LIBRE_MS)]);
      if (r) await esperar(frenar(r, color, Math.random()));
      parar();
      if (svg) await esperar(celebrar(svg, color));
      return color;
    } finally {
      parar();
    }
  }

  document.querySelector("#ruleta-prueba")?.addEventListener("click", async () => {
    // La prueba no toca el servidor: el color lo decide el navegador y no tiene ninguna
    // relación con el sorteo real, que vive entero en la función.
    const color: Color = COLORES[Math.random() < 0.5 ? 0 : 1];
    marcarResultado({ tipo: "girando-prueba" });
    repintar();
    await tirar(Promise.resolve(color));
    entradaPendiente = true;
    marcarResultado({ tipo: "prueba", color });
    repintar();
  });

  document.querySelector("#ruleta-jugar")?.addEventListener("click", async () => {
    const apostado = estado.color;
    if (apostado === null || girando(estado.fase)) return;

    marcarResultado({ tipo: "girando-real" });
    repintar();

    let gano = false;
    try {
      const color = await tirar(
        jugarRuleta({ color: apostado }).then((respuesta) => {
          gano = respuesta.data.gano;
          return respuesta.data.color as Color;
        })
      );
      entradaPendiente = true;
      marcarResultado({ tipo: gano ? "gano" : "perdio", color });
    } catch (error) {
      marcarResultado({
        tipo: "error",
        texto: textoDeError((error as { code?: string }).code),
      });
    }
    repintar();
  });
}
