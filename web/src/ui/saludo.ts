import { escapar } from "./tarjetaDia";

/**
 * El saludo de la página, con efecto de máquina de escribir.
 *
 * El nombre va en su propio degradado morado, a juego con la tarjeta del día, para que lo
 * primero que vea el cliente sea su nombre y no el "Hola".
 */

/** Lo que tarda la animación completa, de la primera letra a la última. */
const DURACION_MS = 1500;

/**
 * La animación corre UNA vez por carga, no una por repintado.
 *
 * `pintar()` reconstruye la página entera con cada snapshot de Firestore, así que sin esta
 * bandera el saludo volvería a escribirse solo cada vez que llega un dato — al abrir, y otra
 * vez al marcar el entrenador una asistencia. Se vería como un parpadeo sin motivo.
 */
let yaSeEscribio = false;

export function saludo(nombre: string): string {
  const escrito = yaSeEscribio ? " escrito" : "";
  return `
    <h1 class="saludo${escrito}" id="saludo">
      <span class="saludo-hola">Hola, </span><span class="saludo-nombre">${escapar(nombre)}</span>
    </h1>`;
}

/** Se llama tras cada repintado; solo hace algo la primera vez. */
export function conectarSaludo(): void {
  const el = document.querySelector<HTMLElement>("#saludo");
  if (!el || yaSeEscribio) return;
  yaSeEscribio = true;

  // Quien pidió menos movimiento no recibe la animación: se queda el texto, que es lo que
  // importa.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    el.classList.add("escrito");
    return;
  }

  // El ancho final se mide en vez de usar 100%: la línea es más corta que su contenedor, así
  // que animar hasta 100% gastaría el último tramo revelando espacio vacío y el efecto
  // terminaría antes de tiempo, con el cursor lejos de la última letra.
  const ancho = el.scrollWidth;
  const letras = el.textContent?.length ?? 1;
  el.style.setProperty("--ancho-saludo", `${ancho}px`);
  el.style.setProperty("--letras-saludo", `${letras}`);
  el.style.setProperty("--duracion-saludo", `${DURACION_MS}ms`);
  el.classList.add("escribiendo");
  // Al terminar se quita el recorte: si la ventana cambia de ancho después, el texto no debe
  // quedarse cortado al ancho que se midió al abrir.
  el.addEventListener("animationend", () => {
    el.classList.remove("escribiendo");
    el.classList.add("escrito");
  });
}
