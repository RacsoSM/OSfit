import { escapar } from "./tarjetaDia";

/**
 * La franja que ofrece apagar el modo sin datos: al entrar a un Wi-Fi, o al tocar algo que
 * necesita internet con el modo puesto. Usa la misma franja que "Hay una versión nueva"
 * (`avisoVersion.ts`) para verse bien en todos los estilos sin CSS propio; va en su propio
 * nodo, así que pueden salir las dos.
 */
export function avisoSinDatos(texto: string): string {
  return `
    <div class="aviso-version aviso-sin-datos" id="aviso-sin-datos" role="status">
      <span class="aviso-version-texto">${escapar(texto)}</span>
      <button type="button" class="aviso-version-actualizar" data-sin-datos="apagar">Desactivar</button>
      <button type="button" class="aviso-version-cerrar" data-sin-datos="cerrar" aria-label="Ahora no">✕</button>
    </div>`;
}

/** La muestra, o le cambia el texto si ya estaba. */
export function mostrarAvisoSinDatos(texto: string, alApagar: () => void, alCerrar: () => void): void {
  const viejo = document.querySelector("#aviso-sin-datos");
  if (viejo) {
    const span = viejo.querySelector(".aviso-version-texto");
    if (span) span.textContent = texto;
    return;
  }
  document.body.insertAdjacentHTML("beforeend", avisoSinDatos(texto));
  document.querySelector("#aviso-sin-datos")?.addEventListener("click", (ev) => {
    const boton = (ev.target as HTMLElement).closest<HTMLElement>("[data-sin-datos]");
    if (!boton) return;
    quitarAvisoSinDatos();
    if (boton.dataset.sinDatos === "apagar") alApagar();
    else alCerrar();
  });
}

export function quitarAvisoSinDatos(): void {
  document.querySelector("#aviso-sin-datos")?.remove();
}
