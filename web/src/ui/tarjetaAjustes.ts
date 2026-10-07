import {
  ESTILOS, aplicarEstilo, esEstilo, guardarEstilo, retrasosDeCortina, type IdEstilo,
} from "../estilo";
import { fondoPixel } from "./fondoPixel";

/**
 * La ventana Ajustes. Por ahora trae una sola cosa: el combo del estilo de la página.
 *
 * El combo es un `<select>` nativo a propósito, no una lista dibujada a mano: en el teléfono
 * abre la rueda o la hoja del sistema, que es lo que la clienta ya sabe usar con una mano, y
 * el lector de pantalla lo anuncia sin que haya que reinventarle los roles ARIA. Lo único que
 * se le cambia es la cara de la caja cerrada.
 */
export function tarjetaAjustes(estilo: IdEstilo): string {
  const elegido = ESTILOS.find((e) => e.id === estilo) ?? ESTILOS[0];
  const opciones = ESTILOS.map(
    (e) => `<option value="${e.id}"${e.id === elegido.id ? " selected" : ""}>${e.nombre}</option>`
  ).join("");
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Apariencia</p>
      <label class="ajuste-etiqueta" for="selector-estilo">Estilo de la página</label>
      <div class="selector">
        <select id="selector-estilo" class="selector-campo" aria-describedby="estilo-descripcion">
          ${opciones}
        </select>
        <span class="selector-flecha" aria-hidden="true">▾</span>
      </div>
      <p class="ajuste-nota" id="estilo-descripcion">${elegido.descripcion}</p>
      <p class="ajuste-nota ajuste-tenue">Se guarda en este teléfono.</p>
    </div>`;
}

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

const ID_FUENTES = "fuentes-pixel";
/**
 * Dos fuentes y no una: Press Start 2P es la letra de arcade por excelencia, pero en párrafos
 * se vuelve ilegible en un teléfono, así que va solo en títulos y números. El texto corrido
 * usa Pixelify Sans, que sigue siendo de píxeles y se lee a 16 px. Gemela de la del script de
 * `index.html`.
 */
const URL_FUENTES =
  "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Pixelify+Sans:wght@400..700&display=swap";

/** El color de la barra del navegador en Android, a juego con el fondo de cada estilo. */
const COLOR_BARRA: Record<IdEstilo, string> = { clasico: "#121212", pixel: "#0E0B1F" };

/**
 * Deja la página en el estilo `id`: el atributo en `<html>` y, para el pixel, lo que su CSS
 * necesita que exista (las fuentes y el paisaje). Las fuentes se piden solo la primera vez que
 * alguien elige pixel: la clienta del clásico nunca las descarga.
 */
export function ponerEstilo(id: IdEstilo): void {
  aplicarEstilo(id, document.documentElement);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLOR_BARRA[id]);
  if (id !== "pixel") return;
  if (!document.getElementById(ID_FUENTES)) {
    const enlace = document.createElement("link");
    enlace.id = ID_FUENTES;
    enlace.rel = "stylesheet";
    enlace.href = URL_FUENTES;
    document.head.append(enlace);
  }
  if (!document.getElementById("fondo-pixel")) {
    document.body.insertAdjacentHTML("afterbegin", fondoPixel());
  }
}

/** Cuadros por renglón de la cortina. Pocos y grandes: con muchos se ve como ruido, no píxeles. */
const COLUMNAS_CORTINA = 8;
/** Lo que tarda el frente en cruzar la pantalla. */
const BARRIDO_MS = 420;
/** Lo que tarda cada cuadro en crecer; gemelo de `--celda-cortina` en el CSS. */
const CELDA_MS = 180;

/**
 * El cambio de estilo pasa detrás de una cortina de cuadros que cubre la pantalla y se
 * retira, como el cambio de escena de un juego viejo. No es solo adorno: sin ella el cambio
 * se ve a medias —las fuentes nuevas llegan unos milisegundos después que los colores— y la
 * cortina tapa justo ese hueco.
 */
function cambiarConCortina(cambiar: () => void): void {
  const sinMovimiento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (sinMovimiento || document.querySelector(".cortina")) {
    cambiar();
    return;
  }
  const lado = window.innerWidth / COLUMNAS_CORTINA;
  const filas = Math.ceil(window.innerHeight / lado);
  const retrasos = retrasosDeCortina(COLUMNAS_CORTINA, filas, BARRIDO_MS);
  const cortina = document.createElement("div");
  cortina.className = "cortina";
  cortina.setAttribute("aria-hidden", "true");
  cortina.style.setProperty("--columnas", String(COLUMNAS_CORTINA));
  cortina.innerHTML = retrasos
    .map((r, i) => {
      // Tablero de ajedrez con los dos tonos de la paleta: se lee como píxeles y no como un
      // telón liso.
      const oscuro = (i % COLUMNAS_CORTINA + Math.floor(i / COLUMNAS_CORTINA)) % 2 === 1;
      return `<i${oscuro ? ` class="oscuro"` : ""} style="--retraso:${r}ms"></i>`;
    })
    .join("");
  document.body.append(cortina);
  const cubierta = BARRIDO_MS + CELDA_MS;
  setTimeout(() => {
    cambiar();
    cortina.classList.add("abriendo");
    setTimeout(() => cortina.remove(), cubierta + 60);
  }, cubierta);
}

/**
 * Cuelga el combo. Se vuelve a llamar en cada repintado, como el resto de `conectar*`:
 * `innerHTML` tira el listener junto con el elemento.
 *
 * El estilo cambia SOLO al elegir otra opción (`change`), nunca al abrir el combo ni al pasar
 * por encima de las opciones: lo que la clienta ve es lo que eligió.
 */
export function conectarAjustes(actual: IdEstilo, alCambiar: (id: IdEstilo) => void): void {
  const combo = document.querySelector<HTMLSelectElement>("#selector-estilo");
  combo?.addEventListener("change", () => {
    const id = combo.value;
    if (!esEstilo(id) || id === actual) return;
    guardarEstilo(id, almacenDeEstilo());
    cambiarConCortina(() => {
      ponerEstilo(id);
      alCambiar(id);
    });
  });
}
