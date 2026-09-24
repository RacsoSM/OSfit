import type { IdVentana, Ventana } from "../ventanas";
import { escapar } from "./tarjetaDia";

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
      </div>
      <button type="button" class="cabecera-menu" id="abrir-menu"
              aria-label="Abrir menú" aria-controls="menu-panel" aria-expanded="false">☰</button>
    </header>`;
}

export function conectarCabecera(abrirMenu: () => void): void {
  document.querySelector("#abrir-menu")?.addEventListener("click", abrirMenu);
}

/**
 * En Inicio va el saludo; en las demás, el nombre de la ventana. El saludo se oculta y no se
 * destruye: rehacerlo lo volvería a escribir letra por letra al regresar.
 */
export function actualizarCabecera(titulo: string | null): void {
  const saludo = document.querySelector<HTMLElement>("#saludo");
  const el = document.querySelector<HTMLElement>("#titulo-ventana");
  if (saludo) saludo.hidden = titulo !== null;
  if (el) {
    el.hidden = titulo === null;
    if (el.textContent !== (titulo ?? "")) el.textContent = titulo ?? "";
  }
}

function opcion(v: Ventana, activa: IdVentana): string {
  const esActiva = v.id === activa;
  return `
        <button type="button" class="menu-opcion${esActiva ? " activa" : ""}" data-ventana="${v.id}"${esActiva ? ` aria-current="page"` : ""}>
          <span class="menu-icono" aria-hidden="true">${v.icono}</span>
          <span class="menu-texto">${escapar(v.titulo)}</span>
          ${v.proximamente ? `<span class="menu-pronto">Pronto</span>` : ""}
        </button>`;
}

export function panelMenu(ventanas: readonly Ventana[], activa: IdVentana, nombre: string): string {
  const de = (grupo: Ventana["grupo"]) =>
    ventanas.filter((v) => v.grupo === grupo).map((v) => opcion(v, activa)).join("");
  return `
    <div class="menu-velo" data-cerrar-menu></div>
    <nav class="menu-panel" id="menu-panel" aria-label="Menú">
      <div class="menu-encabezado">
        <p class="menu-nombre">${escapar(nombre)}</p>
        <button type="button" class="menu-cerrar" data-cerrar-menu aria-label="Cerrar menú">✕</button>
      </div>
      <div class="menu-lista">${de("principal")}</div>
      <div class="menu-pie">${de("pie")}</div>
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
