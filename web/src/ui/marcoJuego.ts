/**
 * El marco de los juegos del Arcade: la pantalla del juego va fija desde arriba de la pantalla
 * hasta la barra de abajo (sin el título, que se esconde en los juegos). Compartido por los tres juegos.
 *
 * Bug (2026-11-25, "quise jugar mientras estaba con un entrenamiento abierto y desapareció la
 * kettlebell y la barra inferior"): en el iPhone, con la app instalada, si el teclado estaba
 * abierto (anotando reps) y la clienta se va a otra ventana, el input enfocado se destruye con
 * el teclado arriba y iOS puede dejar la vista corrida: lo que se ve ya no coincide con
 * `window.innerHeight`. La barra fija de abajo queda fuera de la pantalla y el juego, medido
 * contra esa altura falsa, crece de más: la kettlebell y las barras de abajo quedan debajo de lo
 * visible. Y como en el juego la página no se mueve, ya no había cómo arreglarlo con el dedo.
 *
 * Por eso aquí se mide contra `visualViewport` (lo que de verdad se ve), la barra se vuelve a
 * subir a la vista si quedó abajo, y se vuelve a medir cuando el teclado termina de cerrarse.
 */

/** Lo que se ve de la página, en coordenadas de la vista de `position: fixed`. */
function visible(): { arriba: number; abajo: number } {
  const vv = window.visualViewport;
  if (!vv) return { arriba: 0, abajo: window.innerHeight };
  return { arriba: Math.max(0, vv.offsetTop), abajo: Math.min(window.innerHeight, vv.offsetTop + vv.height) };
}

function barraFija(): HTMLElement | null {
  return document.querySelector<HTMLElement>("#barra .barra");
}

/** Pone `pantalla` desde arriba hasta la barra, dentro de lo que se ve. */
export function ajustarMarcoJuego(pantalla: HTMLElement | null): void {
  if (!pantalla) return;
  const v = visible();
  const barra = barraFija();
  if (barra) {
    // Si la vista quedó más corta que el alto de la página, la barra (fija al fondo) quedó
    // abajo de lo visible: se sube lo que haga falta.
    const sobra = Math.round(window.innerHeight - v.abajo);
    barra.style.bottom = sobra > 1 ? `${sobra}px` : "";
  }
  // Sin el título de arriba (va escondido en los juegos): el juego empieza hasta arriba, solo
  // respetando la muesca o la barra de estado del teléfono.
  const visibleBarra = barra && barra.offsetHeight > 0 ? barra : null;
  const abajo = visibleBarra ? Math.min(v.abajo, visibleBarra.getBoundingClientRect().top) : v.abajo;
  pantalla.style.top = `calc(env(safe-area-inset-top) + ${Math.max(0, Math.round(v.arriba))}px)`;
  pantalla.style.bottom = `${Math.max(0, Math.round(window.innerHeight - abajo))}px`;
}

/** Al salir de los juegos, la barra vuelve a su lugar de siempre. */
export function soltarMarcoJuego(): void {
  const barra = barraFija();
  if (barra) barra.style.bottom = "";
}

/**
 * Al abrir un juego: cierra el teclado si quedó abierto, regresa la página arriba y mide ahora y
 * otra vez cuando el teclado termina de bajar (en iOS tarda ~300 ms en acomodar la vista).
 */
export function prepararMarcoJuego(medir: () => void): void {
  const enfocado = document.activeElement;
  if (enfocado instanceof HTMLElement && enfocado !== document.body) enfocado.blur();
  window.scrollTo(0, 0);
  medir();
  requestAnimationFrame(medir);
  setTimeout(medir, 350);
  setTimeout(medir, 900);
}

/** Vuelve a medir cada vez que cambia lo que se ve (teclado, rotación, barra de Safari). */
export function vigilarMarcoJuego(medir: () => void): void {
  window.addEventListener("resize", medir);
  window.visualViewport?.addEventListener("resize", medir);
  window.visualViewport?.addEventListener("scroll", medir);
}

let avisado = false;

/**
 * Pinta un cuadro sin que un error lo congele todo: si un cuadro falla, el juego sigue con el
 * siguiente (antes, un error dejaba el canvas detenido a medio pintar).
 */
export function pintarSeguro(pintar: () => void): void {
  try {
    pintar();
  } catch (e) {
    if (!avisado) { avisado = true; console.error("Error al pintar el juego", e); }
  }
}
