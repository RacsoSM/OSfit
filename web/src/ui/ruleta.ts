// web/src/ui/ruleta.ts
import { jugarRuleta } from "../acciones";
import { MINIMO_GIRO_LIBRE_MS, frenar, girarLibre } from "./ruletaGiro";

/**
 * El modal de la ruleta: la propuesta, la elección de color, el giro y el acuse.
 *
 * Vive en su propio nodo `#ruleta`, fuera de `#contenido`. No es un capricho de orden: la
 * página rehace el `innerHTML` de `#contenido` en CADA snapshot de Firestore, y una ruleta
 * girando ahí dentro se moriría a media tirada en cuanto el entrenador marcara una
 * asistencia. Es el mismo motivo por el que el saludo y los videos ya viven fuera.
 */

export type Color = "primario" | "ambar";

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
 * Cómo se nombra cada color. **El primario no se nombra por su tono**: la ficha y el sector
 * son `var(--primario)`, o sea la paleta que el entrenador le asigna a cada clienta, así que
 * escribir "morado" miente con cualquier paleta que no sea la de por defecto — y la clienta
 * lee un color que no tiene delante justo cuando le estamos diciendo si ganó. El ámbar sí es
 * fijo, y ése se nombra.
 *
 * Son dos formas porque las dos frases piden gramática distinta: "Cayó en ___" y
 * "Apostar ___".
 */
const NOMBRE: Record<Color, { cayo: string; apuesta: string }> = {
  primario: { cayo: "tu color", apuesta: "a tu color" },
  ambar: { cayo: "el ámbar", apuesta: "al ámbar" },
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

export function modalRuleta(): string {
  if (!estado.abierta) return "";

  const terminada = estado.fase.tipo === "gano" || estado.fase.tipo === "perdio";
  const enJuego = girando(estado.fase);
  const jugarBloqueado = estado.color === null || enJuego || terminada;

  const eleccion = (["primario", "ambar"] as Color[])
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
  const propuesta =
    estado.fase.tipo === "propuesta" || estado.fase.tipo === "error"
      ? `<p class="confirmar-titulo">Te propongo un juego.</p>
         <p class="accion-nota">
           Si adivinas en qué color caerá la ruleta, te revivo tu racha. Si no le atinas, el
           próximo mes tendrás solo 2 oportunidades para revivir en vez de 3.
         </p>
         <p class="ruleta-pregunta">¿Quieres jugar?</p>`
      : "";

  return `
    <div class="ruleta-fondo">
      <div class="ruleta-caja" role="dialog" aria-modal="true" aria-label="Te propongo un juego">
        ${salida}
        ${propuesta}
        <div class="ruleta-fichas">${eleccion}</div>
        <div class="ruleta-marco">
          <div class="ruleta-puntero"></div>
          <div class="ruleta-rueda" id="ruleta-rueda"></div>
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

  const rueda = () => document.querySelector<HTMLElement>("#ruleta-rueda");

  for (const c of ["primario", "ambar"] as Color[]) {
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
    const color: Color = Math.random() < 0.5 ? "primario" : "ambar";
    marcarResultado({ tipo: "girando-prueba" });
    repintar();
    const r = rueda();
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
    const r = rueda();
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
