import { FUENTES, aplicarEstilo, hojaDeEstilo, onomatopeya, retrasosDeCortina, type IdEstilo } from "../estilo";

/** Los fondos con dibujo, que se cargan aparte (`fondosDeEstilo.ts`): null hasta que llegan. */
type Fondos = typeof import("./fondosDeEstilo");
let fondos: Fondos | null = null;
let pidiendoFondos: Promise<Fondos> | null = null;
const CON_FONDO: ReadonlySet<IdEstilo> = new Set<IdEstilo>(["pixel", "sakura", "halloween"]);
function pedirFondos(): Promise<Fondos> {
  pidiendoFondos ??= import("./fondosDeEstilo").then(
    (m) => (fondos = m),
    (e: unknown) => { pidiendoFondos = null; throw e; }
  );
  return pidiendoFondos;
}

/**
 * Lo que pasa en el DOM al cambiar de estilo: el atributo, las fuentes, el paisaje del pixel y
 * la transición. Separado de `tarjetaAjustes.ts` porque esto toca `document` y no se prueba en
 * Node; lo que sí se puede probar (retrasos, onomatopeyas, el catálogo) vive en `estilo.ts`.
 */

/**
 * `localStorage` y no `sessionStorage`: el estilo tiene que sobrevivir a cerrar la pestaña.
 * El `try` es por lo mismo que en `almacenesDelNavegador`: nombrarlo puede tirar.
 */
export function almacenDeEstilo(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** El color de la barra del navegador en Android, a juego con el fondo de cada estilo. */
const COLOR_BARRA: Record<IdEstilo, string> = {
  clasico: "#121212",
  pixel: "#0E0B1F",
  neon: "#07030F",
  comic: "#FFF4D6",
  minimalista: "#F5F5F3",
  sakura: "#FFF0F4",
  halloween: "#1A0B2E",
};

/**
 * Deja la página en el estilo `id`: el atributo en `<html>` y lo que su CSS necesita que
 * exista. Las fuentes de cada estilo se piden la primera vez que alguien lo elige, con un id
 * por estilo para no pedirlas dos veces; el script de `index.html` usa los mismos ids.
 */
export function ponerEstilo(id: IdEstilo): void {
  void pedirHoja(id);
  aplicarEstilo(id, document.documentElement);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLOR_BARRA[id]);
  pedirFuentes(id);
  if (!fondos) {
    // Sin la parte de los fondos no hay nada que detener; si este estilo la necesita, se pide y
    // el fondo se pone al llegar (si para entonces sigue siendo el estilo puesto).
    if (CON_FONDO.has(id)) {
      void pedirFondos().then(() => {
        if ((document.documentElement.getAttribute("data-estilo") ?? "clasico") === id) ponerFondo(id);
      }).catch(() => {});
    }
    return;
  }
  ponerFondo(id);
}

/**
 * Con un juego abierto, el fondo animado del estilo (los pétalos del sakura, los sustos de
 * halloween) se detiene: queda tapado por el juego y seguía gastando cuadros (2026-11-27). Al
 * cerrar el juego se vuelve a poner el del estilo actual. El CSS los esconde con `con-juego`.
 */
let fondoPausado = false;
export function pausarFondoAnimado(pausar: boolean): void {
  if (pausar === fondoPausado) return;
  fondoPausado = pausar;
  if (!fondos) return;
  if (pausar) {
    fondos.detenerPetalos();
    fondos.detenerSustos();
    return;
  }
  ponerFondo((document.documentElement.getAttribute("data-estilo") ?? "clasico") as IdEstilo);
}

/** Lo que el CSS del estilo necesita que exista, con la parte de los fondos ya cargada. */
function ponerFondo(id: IdEstilo): void {
  if (!fondos) return;
  const { detenerPetalos, detenerSustos, fondoHalloween, fondoPixel, fondoSakura, iniciarPetalos, iniciarSustos } = fondos;
  // Pixel, sakura y halloween son los únicos fondos que necesitan nodos: los demás son CSS puro.
  if (id === "pixel" && !document.getElementById("fondo-pixel")) {
    document.body.insertAdjacentHTML("afterbegin", fondoPixel());
  }
  if (id === "halloween") {
    if (!document.getElementById("fondo-halloween")) {
      document.body.insertAdjacentHTML("afterbegin", fondoHalloween());
    }
    iniciarSustos();
  } else {
    detenerSustos();
  }
  if (id !== "sakura") {
    // Fuera del sakura los pétalos se detienen de verdad, no solo se esconden: una animación
    // escondida seguiría gastando batería en cada cuadro.
    detenerPetalos();
    return;
  }
  if (!document.getElementById("fondo-sakura")) {
    document.body.insertAdjacentHTML("afterbegin", fondoSakura());
    // La capa de adelante va al FINAL de <body>, fuera del fondo: el fondo es su propio
    // contexto de apilado con `z-index: -1`, y nada de adentro puede pasar delante del contenido.
    document.body.insertAdjacentHTML("beforeend", `<canvas class="petalos-frente" id="petalos-frente" aria-hidden="true"></canvas>`);
  }
  iniciarPetalos(
    document.querySelector<HTMLCanvasElement>("#petalos-fondo"),
    document.querySelector<HTMLCanvasElement>("#petalos-frente")
  );
}

/**
 * La hoja del estilo, que es su propio archivo (`hojasDeEstilo.mjs`): se pide la primera vez que
 * hace falta, con el mismo id que usa el script del `<head>`, y queda puesta. Se cumple cuando
 * está lista (o si falla, para no trabar el cambio).
 */
function pedirHoja(id: IdEstilo): Promise<void> {
  const ruta = hojaDeEstilo(id);
  if (!ruta) return Promise.resolve();
  const idHoja = `hoja-${id}`;
  const existente = document.getElementById(idHoja) as HTMLLinkElement | null;
  if (existente) {
    return existente.sheet ? Promise.resolve() : new Promise((listo) => {
      existente.addEventListener("load", () => listo(), { once: true });
      existente.addEventListener("error", () => listo(), { once: true });
    });
  }
  const enlace = document.createElement("link");
  enlace.id = idHoja;
  enlace.rel = "stylesheet";
  enlace.href = ruta;
  const lista = new Promise<void>((listo) => {
    enlace.addEventListener("load", () => listo(), { once: true });
    enlace.addEventListener("error", () => listo(), { once: true });
  });
  // Al final del <head>: después del CSS de la página, para ganarle a igual especificidad.
  document.head.append(enlace);
  return lista;
}

function pedirFuentes(id: IdEstilo): void {
  if (id === "clasico") return;
  const idFuentes = `fuentes-${id}`;
  if (document.getElementById(idFuentes)) return;
  const enlace = document.createElement("link");
  enlace.id = idFuentes;
  enlace.rel = "stylesheet";
  enlace.href = FUENTES[id];
  document.head.append(enlace);
}

/**
 * Una transición: `cubrir` pinta la pantalla tapada (y dice cuánto tarda en taparla), y
 * `destapar` la retira (y dice cuánto tarda). El cambio de estilo pasa justo en medio, con la
 * pantalla tapada, que además esconde el instante en que llegan las fuentes nuevas: sin
 * transición se vería la página un momento con la letra vieja y los colores nuevos.
 */
interface Transicion {
  cubrir: (velo: HTMLElement) => number;
  destapar: (velo: HTMLElement) => number;
}

/** Un fundido al color de fondo del estilo al que se llega. Lo usan clásico y minimalista. */
function fundido(color: string): Transicion {
  return {
    cubrir: (velo) => {
      velo.classList.add("fundido");
      velo.style.background = color;
      return 260;
    },
    destapar: (velo) => {
      velo.classList.add("abriendo");
      return 380;
    },
  };
}

/** Cuadros por renglón de la cortina del pixel. Pocos y grandes: muchos se ven como ruido. */
const COLUMNAS_CORTINA = 8;
/** Lo que tarda el frente de la cortina en cruzar la pantalla. */
const BARRIDO_MS = 420;
/** Lo que tarda cada cuadro en crecer; gemelo de `--celda-cortina` en el CSS. */
const CELDA_MS = 180;

/** Una cortina de cuadros que barre en diagonal, como el cambio de escena de un juego viejo. */
const cortinaPixel: Transicion = {
  cubrir: (velo) => {
    const lado = window.innerWidth / COLUMNAS_CORTINA;
    const filas = Math.ceil(window.innerHeight / lado);
    velo.classList.add("cortina");
    velo.style.setProperty("--columnas", String(COLUMNAS_CORTINA));
    velo.innerHTML = retrasosDeCortina(COLUMNAS_CORTINA, filas, BARRIDO_MS)
      .map((r, i) => {
        // Tablero de ajedrez con los dos tonos de la paleta: se lee como píxeles, no como telón.
        const oscuro = (i % COLUMNAS_CORTINA + Math.floor(i / COLUMNAS_CORTINA)) % 2 === 1;
        return `<i${oscuro ? ` class="oscuro"` : ""} style="--retraso:${r}ms"></i>`;
      })
      .join("");
    return BARRIDO_MS + CELDA_MS;
  },
  destapar: (velo) => {
    velo.classList.add("abriendo");
    return BARRIDO_MS + CELDA_MS;
  },
};

/**
 * Un apagón con parpadeo, y el encendido de un monitor viejo: una raya de luz en el centro que
 * se abre hasta llenar la pantalla. Los tiempos son gemelos de `.transicion-neon` en el CSS.
 */
const encendidoNeon: Transicion = {
  cubrir: (velo) => {
    velo.classList.add("transicion-neon");
    return 420;
  },
  destapar: (velo) => {
    velo.classList.add("abriendo");
    return 620;
  },
};

/**
 * La onomatopeya en una explosión amarilla sobre trama de puntos, y la viñeta que sale como
 * una página que se pasa. Gemela de `.transicion-comic` en el CSS.
 */
const vinetaComic: Transicion = {
  cubrir: (velo) => {
    velo.classList.add("transicion-comic");
    velo.innerHTML = `<span class="comic-estallido"><b>${onomatopeya()}</b></span>`;
    return 560;
  },
  destapar: (velo) => {
    velo.classList.add("abriendo");
    return 460;
  },
};

/**
 * Una ráfaga de pétalos que cruza la pantalla mientras todo se tiñe de rosa, y se aclara con
 * los pétalos todavía volando. Gemela de `.transicion-sakura` en el CSS.
 */
const rafagaSakura: Transicion = {
  cubrir: (velo) => {
    velo.classList.add("transicion-sakura");
    velo.innerHTML = (fondos?.rafagaDePetalos(46) ?? []).map((estilo) => `<i style="${estilo}"></i>`).join("");
    return 520;
  },
  destapar: (velo) => {
    velo.classList.add("abriendo");
    return 900;
  },
};

/**
 * Una bandada de murciélagos cruza la pantalla mientras cae la noche, y en el centro se
 * enciende una calabaza enorme, a saltos, como un sprite. Gemela de `.transicion-halloween`.
 */
const nocheDeBrujas: Transicion = {
  cubrir: (velo) => {
    velo.classList.add("transicion-halloween");
    if (fondos) {
      velo.style.setProperty("--murcielago", fondos.IMAGEN_MURCIELAGO());
      velo.style.setProperty("--calabaza", fondos.IMAGEN_CALABAZA());
    }
    velo.innerHTML = `<span class="hw-calabaza-grande"></span>` +
      (fondos?.bandadaDeMurcielagos(22) ?? []).map((estilo) => `<i style="${estilo}"></i>`).join("");
    return 560;
  },
  destapar: (velo) => {
    velo.classList.add("abriendo");
    return 700;
  },
};

/** La transición la decide el estilo al que se LLEGA: es el que se está presentando. */
const TRANSICIONES: Record<IdEstilo, Transicion> = {
  clasico: fundido("#121212"),
  pixel: cortinaPixel,
  neon: encendidoNeon,
  comic: vinetaComic,
  minimalista: fundido("#F5F5F3"),
  sakura: rafagaSakura,
  halloween: nocheDeBrujas,
};

/**
 * Cambia al estilo `id` detrás de su transición, y llama a `cambiar` con la pantalla tapada.
 * Quien pidió menos movimiento, o un segundo cambio con uno todavía en curso, cambia directo.
 */
export function cambiarConTransicion(id: IdEstilo, cambiar: () => void): void {
  const sinMovimiento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (sinMovimiento || document.querySelector(".velo-estilo")) {
    cambiar();
    return;
  }
  // Las transiciones del sakura y de halloween usan la parte de los fondos: primero se pide.
  if (CON_FONDO.has(id) && !fondos) {
    pedirFondos().then(() => cambiarConTransicion(id, cambiar), () => cambiar());
    return;
  }
  // Las fuentes se piden YA, no al poner el estilo: así llegan mientras la pantalla se tapa, y
  // la propia transición (el "¡POW!" del cómic va en Bangers) sale con su letra.
  pedirFuentes(id);
  // La hoja del estilo también: el cambio espera, con la pantalla ya tapada, a que llegue (hasta
  // 4 s, por si la red no contesta), o se vería un momento la página sin su estilo.
  const hoja = Promise.race([pedirHoja(id), new Promise<void>((r) => setTimeout(r, 4000))]);
  const transicion = TRANSICIONES[id];
  const velo = document.createElement("div");
  velo.className = "velo-estilo";
  velo.setAttribute("aria-hidden", "true");
  const cubrir = transicion.cubrir(velo);
  document.body.append(velo);
  const tapada = new Promise<void>((r) => setTimeout(r, cubrir));
  void Promise.all([tapada, hoja]).then(() => {
    cambiar();
    const destapar = transicion.destapar(velo);
    setTimeout(() => velo.remove(), destapar + 60);
  });
}
