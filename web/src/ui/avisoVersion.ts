/**
 * La franja de "Hay una versión nueva" (`version.ts`). Va en `body`, fija arriba, encima del
 * contenido y de la flecha de atrás pero debajo del menú (z 20). "Actualizar" recarga; la ✕ la
 * quita hasta la próxima vez que abra la página.
 *
 * Sale por dos caminos: `version.ts` (la página que se quedó abierta desde antes de un deploy) y
 * el service worker, que abre la página de lo guardado y avisa con `version-lista` cuando ya
 * guardó una nueva (`public/sw.js`).
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
    if (boton?.dataset.version === "actualizar") void actualizar(boton);
    else if (boton?.dataset.version === "cerrar") document.querySelector("#aviso-version")?.remove();
  });
}

/** Cuánto se espera a que el service worker guarde la versión nueva antes de recargar igual. */
export const ESPERA_ACTUALIZAR_MS = 8000;

/**
 * La página abre de lo guardado (`public/sw.js`): recargar sin más podría salir otra vez con la
 * versión vieja. Primero se le pide al service worker que guarde la nueva, y se recarga cuando
 * contesta (o a los `ESPERA_ACTUALIZAR_MS`, por si no contesta).
 */
async function actualizar(boton: HTMLElement): Promise<void> {
  const sw = navigator.serviceWorker?.controller;
  if (sw) {
    boton.textContent = "Actualizando…";
    boton.setAttribute("disabled", "");
    await new Promise<void>((listo) => {
      const reloj = setTimeout(listo, ESPERA_ACTUALIZAR_MS);
      navigator.serviceWorker.addEventListener("message", (e) => {
        if ((e.data as { tipo?: string } | null)?.tipo === "version-revisada") { clearTimeout(reloj); listo(); }
      });
      sw.postMessage({ tipo: "actualizar" });
    });
  }
  location.reload();
}
