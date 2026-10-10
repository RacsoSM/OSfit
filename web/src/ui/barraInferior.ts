import type { IdVentana, Ventana } from "../ventanas";
import { escapar } from "./tarjetaDia";

/**
 * La barra de abajo, fija, con las ventanas principales: Inicio, Músculos y Registro.
 *
 * Se pinta UNA vez, en `prepararEstructura`, igual que la cabecera: la activa se marca sobre
 * los botones que ya existen (`marcarVentanaActiva` de `menuLateral.ts`), así un snapshot de
 * Firestore no la rehace. Qué ventanas van aquí lo dice `BARRA` en `ventanas.ts`.
 */
export function barraInferior(ventanas: readonly Ventana[]): string {
  const botones = ventanas
    .map(
      (v) => `
      <button type="button" class="barra-opcion" data-ventana="${v.id}">${escapar(v.titulo)}</button>`
    )
    .join("");
  return `<nav class="barra" aria-label="Secciones">${botones}</nav>`;
}

export function conectarBarra(abrirVentana: (id: IdVentana) => void): void {
  document.querySelectorAll<HTMLElement>("#barra [data-ventana]").forEach((b) =>
    b.addEventListener("click", () => abrirVentana(b.dataset.ventana as IdVentana))
  );
}
