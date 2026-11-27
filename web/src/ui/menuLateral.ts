import type { IdVentana, Ventana } from "../ventanas";
import { escapar } from "./tarjetaDia";
import { terminarSaludo } from "./saludo";

/**
 * La cabecera con el ☰ y el panel lateral que se abre con él.
 *
 * El panel se genera de `VENTANAS`: no hay una lista de opciones escrita acá que se pueda
 * desincronizar del registro. Qué ventana está activa y si el menú está abierto lo decide
 * `navegacion.ts`; este módulo solo lo dibuja.
 */

/**
 * Se pinta UNA vez, en `prepararEstructura`, por lo mismo que el saludo: el nodo del saludo
 * tiene que sobrevivir a los repintados para que la máquina de escribir llegue al final.
 */
export function cabecera(saludoHtml: string): string {
  return `
    <header class="cabecera">
      <div class="cabecera-texto">
        ${saludoHtml}
        <h1 class="titulo-ventana" id="titulo-ventana" hidden></h1>
        <p class="detalle-ventana" id="detalle-ventana" hidden></p>
      </div>
      <button type="button" class="pastilla-sin-datos" id="pastilla-sin-datos" hidden
              aria-label="Modo sin datos puesto. Abrir Ajustes">✈️ Sin datos</button>
      <button type="button" class="cabecera-menu cabecera-campana" id="abrir-avisos" hidden
              aria-label="Notificaciones">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor"
             stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9a6 6 0 0 1 12 0c0 6.2 2.5 8 2.5 8h-17S6 15.2 6 9"/>
          <path d="M10.3 20.5a1.9 1.9 0 0 0 3.4 0"/>
        </svg>
        <span class="campana-numero" id="campana-numero" hidden></span>
      </button>
      <button type="button" class="cabecera-menu" id="abrir-menu"
              aria-label="Abrir menú" aria-controls="menu-panel" aria-expanded="false">☰</button>
    </header>`;
}

export function conectarCabecera(abrirMenu: () => void, abrirAjustes: () => void, abrirAvisos: () => void): void {
  document.querySelector("#abrir-menu")?.addEventListener("click", abrirMenu);
  document.querySelector("#abrir-avisos")?.addEventListener("click", abrirAvisos);
  document.querySelector("#pastilla-sin-datos")?.addEventListener("click", abrirAjustes);
}

/** El texto del numerito rojo: nada con 0, y "9+" de ahí para arriba. */
export function numeroCampana(n: number): string {
  return n <= 0 ? "" : n > 9 ? "9+" : String(n);
}

/**
 * La campana de Notificaciones junto al ☰, solo en Inicio, con el numerito rojo de las que no ha
 * visto. Se pinta una vez con la cabecera; aquí solo se muestra, se oculta y se cambia el número.
 */
export function marcarCampana(visible: boolean, noLeidas: number): void {
  const boton = document.querySelector<HTMLElement>("#abrir-avisos");
  const numero = document.querySelector<HTMLElement>("#campana-numero");
  if (!boton || !numero) return;
  boton.hidden = !visible;
  // El cómic y sakura ponen su adorno junto al ☰: con la campana, se corre un botón a la izquierda.
  document.body.classList.toggle("con-campana", visible);
  const texto = numeroCampana(noLeidas);
  numero.hidden = texto === "";
  if (numero.textContent !== texto) numero.textContent = texto;
  boton.setAttribute("aria-label", noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : "Notificaciones");
}

/**
 * La pastilla de la cabecera que recuerda que el modo sin datos está puesto: con él, nada se
 * actualiza, y sin el recordatorio parecería que la página se trabó. Tocarla abre Ajustes.
 */
export function marcarSinDatos(activo: boolean): void {
  const p = document.querySelector<HTMLElement>("#pastilla-sin-datos");
  if (p) p.hidden = !activo;
}

/**
 * `null`: el saludo (Inicio). `""`: nada (Músculos y Registro). Un texto: el nombre de la
 * ventana. Ver `tituloCabecera` en `ventanas.ts`. El saludo se oculta y no se destruye:
 * rehacerlo lo volvería a escribir letra por letra al regresar.
 *
 * Con `detalle`, el título va más chico y con un segundo renglón debajo (el entrenamiento en
 * curso de Registro: ver `cabeceraRegistro`).
 */
export function actualizarCabecera(titulo: string | null, detalle: string | null = null): void {
  const saludo = document.querySelector<HTMLElement>("#saludo");
  const el = document.querySelector<HTMLElement>("#titulo-ventana");
  if (saludo) {
    // Oculto a media escritura, `display: none` cancela la animación y `animationend` nunca
    // llega: sin esto, el saludo se escribiría otra vez al volver a Inicio.
    if (titulo !== null) terminarSaludo(saludo);
    saludo.hidden = titulo !== null;
  }
  if (el) {
    // `""` (ventanas de la barra) esconde las dos cosas: ni saludo ni título.
    el.hidden = !titulo;
    if (el.textContent !== (titulo ?? "")) el.textContent = titulo ?? "";
    el.classList.toggle("con-detalle", !!titulo && !!detalle);
  }
  const det = document.querySelector<HTMLElement>("#detalle-ventana");
  if (det) {
    det.hidden = !titulo || !detalle;
    if (det.textContent !== (detalle ?? "")) det.textContent = detalle ?? "";
  }
}

/** Un marcianito de 8 bits, cuadrito por cuadrito. */
const INVASOR = (() => {
  const filas = ["00100000100", "00010001000", "00111111100", "01101110110", "11111111111", "10111111101", "10100000101", "00011011000"];
  const rects = filas.flatMap((f, y) => [...f].map((b, x) => (b === "1" ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ""))).join("");
  return `<svg class="ma-invasor" viewBox="0 0 11 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
})();

/**
 * El renglón de Arcade: neón de videojuego, distinto del resto del menú (entrenador, 2026-11-25:
 * "algo que diferencie que es de gamer"; eligió la propuesta A, igual en todos los estilos).
 */
function opcionArcade(v: Ventana): string {
  return `
        <button type="button" class="menu-opcion menu-arcade" data-ventana="${v.id}">
          <span class="ma-icono" aria-hidden="true">${INVASOR}</span>
          <span class="menu-texto">${escapar(v.titulo)}</span>
          <span class="ma-extra" aria-hidden="true">INSERT COIN</span>
        </button>`;
}

/** Los íconos de línea de cada ventana (diseño C del entrenador, 2026-11-27). */
const TRAZOS: Partial<Record<IdVentana, string>> = {
  inicio: `<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>`,
  estadisticas: `<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>`,
  resumenMensual: `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  ranking: `<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 6h3a3 3 0 0 1-3 4M7 6H4a3 3 0 0 0 3 4"/>`,
  facturacion: `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>`,
  sugerencias: `<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>`,
  espacio: `<path d="M12 3l2.3 5.4L20 9l-4.3 3.9L17 19l-5-3-5 3 1.3-6.1L4 9l5.7-.6z"/>`,
  // El engranaje clásico, con sus dientes.
  ajustes: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
};

function icono(id: IdVentana): string {
  const trazo = TRAZOS[id];
  return trazo
    ? `<svg class="menu-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${trazo}</svg>`
    : "";
}

/**
 * Los grupos del menú, con su encabezado (diseño C): Inicio arriba solo, y luego "Tu progreso",
 * "Tu cuenta" y "Diversión". Una ventana que no esté en ningún grupo va después de Inicio.
 */
const GRUPOS_MENU: readonly { titulo: string | null; ids: readonly IdVentana[] }[] = [
  { titulo: null, ids: ["inicio"] },
  { titulo: "Tu progreso", ids: ["estadisticas", "resumenMensual", "ranking"] },
  { titulo: "Tu cuenta", ids: ["facturacion", "sugerencias"] },
  { titulo: "Diversión", ids: ["arcade", "espacio"] },
];

function opcion(v: Ventana): string {
  if (v.id === "arcade") return opcionArcade(v);
  return `
        <button type="button" class="menu-opcion" data-ventana="${v.id}">
          ${icono(v.id)}
          <span class="menu-texto">${escapar(v.titulo)}</span>
          ${v.proximamente ? `<span class="menu-pronto">Pronto</span>` : ""}
        </button>`;
}

/**
 * La ventana activa NO va en este HTML: la marca `marcarVentanaActiva` sobre los botones que
 * ya existen. Si fuera parte del HTML, elegir otra ventana cambiaría el panel y `main.ts` lo
 * repintaría justo mientras se cierra, y el panel desaparecería de golpe en vez de deslizarse.
 */
export function panelMenu(ventanas: readonly Ventana[], _nombre?: string): string {
  const principales = ventanas.filter((v) => v.grupo === "principal" && !v.oculta);
  const porId = new Map(principales.map((v) => [v.id, v]));
  const agrupadas = new Set(GRUPOS_MENU.flatMap((g) => g.ids));
  // Las que no están en ningún grupo, después de Inicio (una ventana nueva aparece sin más).
  const sueltas = principales.filter((v) => !agrupadas.has(v.id));
  const grupos = GRUPOS_MENU.map((g, i) => {
    const vs = g.ids.map((id) => porId.get(id)).filter((v): v is Ventana => v !== undefined);
    const todas = i === 0 ? [...vs, ...sueltas] : vs;
    if (todas.length === 0) return "";
    return `${g.titulo ? `<p class="menu-grupo">${g.titulo}</p>` : ""}${todas.map(opcion).join("")}`;
  }).join("");
  const pie = ventanas.filter((v) => v.grupo === "pie" && !v.oculta).map(opcion).join("");
  // Sin el nombre arriba (entrenador, 2026-11-27): solo la ✕. La versión va a la derecha de
  // Ajustes, en su mismo renglón.
  return `
    <div class="menu-velo" data-cerrar-menu></div>
    <nav class="menu-panel" id="menu-panel" aria-label="Menú">
      <div class="menu-encabezado">
        <button type="button" class="menu-cerrar" data-cerrar-menu aria-label="Cerrar menú">✕</button>
      </div>
      <div class="menu-lista">${grupos}</div>
      <div class="menu-pie">
        ${pie}
        <p class="version-app" aria-label="Versión de la app">v${__VERSION__}</p>
      </div>
    </nav>`;
}

/** Se vuelve a llamar cada vez que el panel se repinta: `innerHTML` tira los listeners. */
export function conectarMenu(acciones: {
  abrirVentana: (id: IdVentana) => void;
  cerrarMenu: () => void;
}): void {
  document.querySelectorAll<HTMLElement>("#menu [data-ventana]").forEach((b) =>
    b.addEventListener("click", () => acciones.abrirVentana(b.dataset.ventana as IdVentana))
  );
  document.querySelectorAll("#menu [data-cerrar-menu]").forEach((b) =>
    b.addEventListener("click", acciones.cerrarMenu)
  );
}

/** Lo que `marcarVentanaActiva` toca de cada botón; así se prueba sin DOM. */
interface BotonOpcion {
  dataset: { ventana?: string };
  classList: { toggle(clase: string, forzar?: boolean): boolean };
  setAttribute(nombre: string, valor: string): void;
  removeAttribute(nombre: string): void;
}

/** Resalta la ventana activa sobre los botones ya pintados, sin rehacer el panel. */
export function marcarVentanaActiva(botones: ArrayLike<BotonOpcion>, activa: IdVentana): void {
  for (let i = 0; i < botones.length; i++) {
    const b = botones[i];
    const esActiva = b.dataset.ventana === activa;
    b.classList.toggle("activa", esActiva);
    if (esActiva) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
}

let estabaAbierto = false;

/**
 * Abre o cierra con una clase en `body` y no repintando: así la transición del panel corre,
 * y la misma clase bloquea el scroll de la página de abajo. Cerrado, el panel queda `inert`
 * para que el tabulador y el lector de pantalla no entren en él.
 */
export function aplicarMenuAbierto(abierto: boolean): void {
  document.body.classList.toggle("menu-abierto", abierto);
  const panel = document.querySelector<HTMLElement>("#menu-panel");
  panel?.toggleAttribute("inert", !abierto);
  panel?.setAttribute("aria-hidden", String(!abierto));
  const boton = document.querySelector<HTMLElement>("#abrir-menu");
  boton?.setAttribute("aria-expanded", String(abierto));
  if (abierto && !estabaAbierto) panel?.querySelector<HTMLElement>("[data-ventana]")?.focus();
  if (!abierto && estabaAbierto) boton?.focus({ preventScroll: true });
  estabaAbierto = abierto;
}
