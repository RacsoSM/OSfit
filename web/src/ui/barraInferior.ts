import type { Sexo } from "../datos";
import type { IdVentana, Ventana } from "../ventanas";
import { ICONO_MUSCULOS } from "./iconoMusculos";
import { escapar } from "./tarjetaDia";

/**
 * La barra de abajo, fija, con las ventanas principales: Inicio, Músculos y Registro.
 *
 * Se pinta UNA vez, en `prepararEstructura`, igual que la cabecera: la activa se marca sobre
 * los botones que ya existen (`marcarVentanaActiva` de `menuLateral.ts`), así un snapshot de
 * Firestore no la rehace. Qué ventanas van aquí lo dice `BARRA` en `ventanas.ts`.
 *
 * Cada botón lleva su ícono arriba del nombre; la activa lo pone sobre una pastilla del color
 * de la paleta (diseño elegido por el entrenador el 2026-10-17, opción "B"). Los íconos son
 * de línea, salvo el de Músculos, que es el busto del mapa muscular de la pestaña.
 */
export function barraInferior(ventanas: readonly Ventana[]): string {
  const botones = ventanas
    .map(
      (v) => `
      <button type="button" class="barra-opcion" data-ventana="${v.id}">
        <span class="barra-icono" aria-hidden="true">${ICONOS[v.id] ?? ""}</span>
        <span class="barra-texto">${escapar(v.titulo)}</span>
      </button>`
    )
    .join("");
  return `<nav class="barra" aria-label="Secciones">${botones}</nav>`;
}

export function conectarBarra(abrirVentana: (id: IdVentana) => void): void {
  document.querySelectorAll<HTMLElement>("#barra [data-ventana]").forEach((b) =>
    b.addEventListener("click", () => abrirVentana(b.dataset.ventana as IdVentana))
  );
}

/**
 * Qué busto muestra Músculos: el del sexo de la clienta, como el mapa de la pestaña (sin
 * sexo, el de hombre, que es el mapa por defecto). La barra trae los dos y el CSS esconde
 * uno; se marca en cada repintado porque el entrenador puede poner el sexo con la página
 * abierta.
 */
export function marcarSexoBarra(sexo: Sexo | null | undefined): void {
  document.querySelector("#barra .barra")?.setAttribute("data-sexo", sexo === "M" ? "M" : "H");
}

const LINEA = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

function busto(sexo: Sexo): string {
  const { base, partes, separacion } = ICONO_MUSCULOS[sexo];
  const id = `barra-mascara-${sexo}`;
  // Máscara: lo blanco se ve, lo negro es hueco. El trazo negro de cada músculo abre las
  // separaciones, así se ven sobre la pastilla o sobre la barra sin saber su color.
  return `<svg class="barra-busto barra-busto-${sexo}" viewBox="0 0 24 24" width="24" height="24">
          <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            ${base ? `<path d="${base}" fill="#fff"/>` : ""}
            <path d="${partes}" fill="#fff" stroke="#000" stroke-width="${separacion}" paint-order="stroke"/>
          </mask>
          <rect width="24" height="24" fill="currentColor" mask="url(#${id})"/>
        </svg>`;
}

const ICONOS: Partial<Record<IdVentana, string>> = {
  inicio: `<svg viewBox="0 0 24 24" width="24" height="24" ${LINEA}><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v10.5a1 1 0 0 0 1 1H10v-5.5h4v5.5h3.5a1 1 0 0 0 1-1V9"/></svg>`,
  musculos: busto("H") + busto("M"),
  registro: `<svg viewBox="0 0 24 24" width="24" height="24" ${LINEA}><rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3.5h6v1"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/></svg>`,
};
