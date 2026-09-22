// web/src/ui/ruleta.ts
import { jugarRuleta } from "../acciones";
import {
  MINIMO_GIRO_LIBRE_MS,
  COLORES,
  SECTORES,
  arcoDelBorde,
  arcoDelSector,
  frenar,
  girarLibre,
  puntoDelAnillo,
  varillaEn,
} from "./ruletaGiro";
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

export function abrirRuleta(): void {
  estado.abierta = true;
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

/** Tachuelas del aro. Van en el aro, que NO gira: en una ruleta de verdad tampoco. */
const TACHUELAS = 16;

/**
 * El disco. Las casillas salen de [SECTORES] y no de un `d` escrito a mano: así el dibujo no
 * puede discrepar del aterrizaje que calcula `rotacionDestino` (entrada 28 del backlog).
 *
 * **Qué gira y qué no, que es de lo que depende que parezca metal.** Sólo el `<g>` de las
 * casillas y sus varillas da vueltas. El aro, las tachuelas, el cono, el sombreado de domo, el
 * reflejo y el eje se quedan quietos, porque describen de dónde viene la luz — y una luz que
 * gira con la pieza deja de leerse como luz y pasa a leerse como calcomanía.
 *
 * El cono podría ir dentro del grupo, porque en una ruleta gira con ella, pero se deja fuera:
 * es simétrico, nadie puede notar que no rota, y fuera recibe la luz fija sin tener que
 * compensarla.
 *
 * El `<g>` necesita `transform-box: fill-box` en el CSS, o `rotate()` pivota sobre el origen
 * del viewBox en vez de sobre el centro del disco.
 *
 * `aria-hidden` porque es decoración: quien no lo ve se entera por el acuse, que es texto.
 */
function rueda(parada: boolean): string {
  const casillas = SECTORES.map(
    (s) => `<path class="ruleta-sector ${s.color}" d="${arcoDelSector(s)}"></path>`
  ).join("");

  const varillas = SECTORES.map((s) => {
    const v = varillaEn(s.desde);
    return `<line class="ruleta-varilla" x1="${v.x1}" y1="${v.y1}" x2="${v.x2}" y2="${v.y2}"></line>`;
  }).join("");

  const tachuelas = Array.from({ length: TACHUELAS }, (_, i) => {
    const rad = (i * 2 * Math.PI) / TACHUELAS;
    const x = (100 + 94.5 * Math.sin(rad)).toFixed(2);
    const y = (100 - 94.5 * Math.cos(rad)).toFixed(2);
    return `<circle class="ruleta-tachuela" cx="${x}" cy="${y}" r="2.1"></circle>`;
  }).join("");

  /**
   * La bola sólo se dibuja con la rueda quieta, y SIEMPRE a las 12. No hace falta calcular
   * dónde: el frenado deja la casilla ganadora bajo el puntero, así que las 12 ES la casilla
   * ganadora. Es lo que quita toda duda sobre dónde cayó, y lo hace siendo más realista y no
   * menos — en una ruleta lo que dice el resultado es la bola, no una flecha.
   */
  const bola = parada
    ? `<circle class="ruleta-bola" cx="${puntoDelAnillo(0).split(",")[0]}"
               cy="${puntoDelAnillo(0).split(",")[1]}" r="6.4"></circle>`
    : "";

  return `
    <div class="ruleta-mesa">
    <svg class="ruleta-svg" viewBox="-26 -26 252 252" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ruleta-metal" x1="0.12" y1="0" x2="0.88" y2="1">
          <stop offset="0%" stop-color="#f8efcb"></stop>
          <stop offset="22%" stop-color="#cba750"></stop>
          <stop offset="48%" stop-color="#7f6124"></stop>
          <stop offset="70%" stop-color="#e7d294"></stop>
          <stop offset="88%" stop-color="#9b7a2e"></stop>
          <stop offset="100%" stop-color="#6d551d"></stop>
        </linearGradient>
        <!-- El domo: luz arriba a la izquierda y el borde de abajo apagándose. Es lo que hace
             que un dibujo plano pase a parecer una pieza curva. -->
        <radialGradient id="ruleta-domo" cx="34%" cy="26%" r="80%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.30"></stop>
          <stop offset="40%" stop-color="#ffffff" stop-opacity="0.04"></stop>
          <stop offset="70%" stop-color="#000000" stop-opacity="0.14"></stop>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.52"></stop>
        </radialGradient>
        <radialGradient id="ruleta-reflejo" cx="50%" cy="38%" r="62%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42"></stop>
          <stop offset="52%" stop-color="#ffffff" stop-opacity="0.16"></stop>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"></stop>
        </radialGradient>
        <!-- El cono. Radial CENTRADO a propósito: así es invariante al giro y da igual que la
             pieza rote o no, que es lo que permite sacarlo del grupo. -->
        <!-- El cono. Radial CENTRADO a propósito: así es invariante al giro, da igual que la
             pieza rote o no, y eso es lo que permite sacarlo del grupo que gira. -->
        <radialGradient id="ruleta-cono" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#5b5f68"></stop>
          <stop offset="55%" stop-color="#3a3d44"></stop>
          <stop offset="88%" stop-color="#23252a"></stop>
          <stop offset="100%" stop-color="#4c505a"></stop>
        </radialGradient>
        <radialGradient id="ruleta-eje" cx="36%" cy="30%" r="75%">
          <stop offset="0%" stop-color="#fdf6d8"></stop>
          <stop offset="55%" stop-color="#c2a049"></stop>
          <stop offset="100%" stop-color="#6d551d"></stop>
        </radialGradient>
        <filter id="ruleta-sombra" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.55">
          </feDropShadow>
        </filter>
        <filter id="ruleta-suavizar" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2"></feGaussianBlur>
        </filter>
        <!-- La madera del cubilete. Es el objeto que faltaba: una ruleta de verdad va
             encastrada en un cuenco pulido, y sin él la rueda flotaba sobre un rectángulo de
             color por muy bien iluminada que estuviera. -->
        <linearGradient id="ruleta-madera" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stop-color="#7d4a28"></stop>
          <stop offset="26%" stop-color="#4e2b16"></stop>
          <stop offset="52%" stop-color="#2f180c"></stop>
          <stop offset="74%" stop-color="#5d3419"></stop>
          <stop offset="100%" stop-color="#25120a"></stop>
        </linearGradient>
        <clipPath id="ruleta-recorte"><circle cx="100" cy="100" r="92"></circle></clipPath>
      </defs>

      <g filter="url(#ruleta-sombra)">
        <circle class="ruleta-madera" cx="100" cy="100" r="122"></circle>
        <circle class="ruleta-madera-luz" cx="100" cy="100" r="118"></circle>
        <circle class="ruleta-madera-hueco" cx="100" cy="100" r="99.5"></circle>
        <circle class="ruleta-aro" cx="100" cy="100" r="97"></circle>
        <circle class="ruleta-ranura" cx="100" cy="100" r="92.6"></circle>
      </g>
      ${tachuelas}

      <g class="ruleta-rueda" id="ruleta-rueda">
        ${casillas}
        ${varillas}
      </g>

      <!-- Encima del material y fuera del grupo: no giran. -->
      <circle class="ruleta-cono" cx="100" cy="100" r="54.4"></circle>
      <circle class="ruleta-cono-filo" cx="100" cy="100" r="54.4"></circle>
      <circle class="ruleta-domo" cx="100" cy="100" r="92"></circle>
      <g clip-path="url(#ruleta-recorte)" filter="url(#ruleta-suavizar)">
        <ellipse class="ruleta-reflejo" cx="98" cy="56" rx="54" ry="27"
                 transform="rotate(-16 98 56)"></ellipse>
      </g>
      <path class="ruleta-rebote" d="${arcoDelBorde(118, 242)}"
            clip-path="url(#ruleta-recorte)"></path>
      ${bola}
      <circle class="ruleta-eje-sombra" cx="100" cy="101.5" r="14"></circle>
      <circle class="ruleta-eje" cx="100" cy="100" r="13"></circle>
      <ellipse class="ruleta-eje-brillo" cx="96" cy="95.5" rx="5.2" ry="3.4"
               transform="rotate(-20 96 95.5)"></ellipse>
    </svg>
    </div>`;
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

  return `
    <div class="ruleta-fondo">
      <div class="ruleta-caja" role="dialog" aria-modal="true" aria-label="Te propongo un juego">
        ${salida}
        ${propuesta}
        <div class="ruleta-fichas">${eleccion}</div>
        <div class="ruleta-marco">
          <div class="ruleta-puntero"></div>
          ${rueda(!enJuego)}
        </div>
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

  const disco = () => document.querySelector<SVGGElement>("#ruleta-rueda");

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

  document.querySelector("#ruleta-prueba")?.addEventListener("click", () => {
    const color: Color = COLORES[Math.random() < 0.5 ? 0 : 1];
    marcarResultado({ tipo: "girando-prueba" });
    repintar();
    const r = disco();
    if (!r) return;
    girarLibre(r);
    // La prueba no toca el servidor: el color lo decide el navegador y no tiene ninguna
    // relación con el sorteo real, que vive entero en la función.
    const ms = frenar(r, color, Math.random());
    setTimeout(() => {
      marcarResultado({ tipo: "prueba", color });
      repintar();
    }, ms);
  });

  document.querySelector("#ruleta-jugar")?.addEventListener("click", async () => {
    const apostado = estado.color;
    if (apostado === null || girando(estado.fase)) return;

    marcarResultado({ tipo: "girando-real" });
    repintar();
    const r = disco();
    if (r) girarLibre(r);

    // El giro libre dura un mínimo fijo aunque el servidor responda antes: así el frenado
    // siempre tiene la misma forma y la duración de la espera no delata el resultado.
    const espera = new Promise((listo) => setTimeout(listo, MINIMO_GIRO_LIBRE_MS));

    try {
      const [respuesta] = await Promise.all([jugarRuleta({ color: apostado }), espera]);
      const { gano, color } = respuesta.data;
      const ms = r ? frenar(r, color as Color, Math.random()) : 0;
      setTimeout(() => {
        marcarResultado({ tipo: gano ? "gano" : "perdio", color: color as Color });
        repintar();
      }, ms);
    } catch (error) {
      marcarResultado({
        tipo: "error",
        texto: textoDeError((error as { code?: string }).code),
      });
      repintar();
    }
  });
}
