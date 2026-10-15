/**
 * La franja de "Hay una versión nueva" (`version.ts`). Va en `body`, fija arriba, encima del
 * contenido y de la flecha de atrás pero debajo del menú (z 20). "Actualizar" recarga; la ✕ la
 * quita hasta la próxima vez que abra la página.
 */
export function avisoVersion(): string {
  return `
    <div class="aviso-version" id="aviso-version" role="status">
      <span class="aviso-version-texto">Hay una versión nueva de OSfit</span>
      <button type="button" class="aviso-version-actualizar" data-version="actualizar">Actualizar</button>
      <button type="button" class="aviso-version-cerrar" data-version="cerrar" aria-label="Cerrar el aviso">✕</button>
    </div>`;
}

export function mostrarAvisoVersion(): void {
  if (document.querySelector("#aviso-version")) return;
  document.body.insertAdjacentHTML("beforeend", avisoVersion());
  document.querySelector("#aviso-version")?.addEventListener("click", (ev) => {
    const boton = (ev.target as HTMLElement).closest<HTMLElement>("[data-version]");
    if (boton?.dataset.version === "actualizar") location.reload();
    else if (boton?.dataset.version === "cerrar") document.querySelector("#aviso-version")?.remove();
  });
}
