/**
 * Los colores de marca de la página vienen de la app: el entrenador elige una paleta por
 * clienta y ahí quedan guardados los hex ya resueltos. Este módulo sólo los vuelca como
 * variables CSS; el catálogo de paletas no existe aquí, vive únicamente en Kotlin.
 */
export interface PaletaWeb {
  id: string;
  primario: string;
  primarioOscuro: string;
  primarioClaro: string;
  sobrePrimario: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

const VARIABLES: ReadonlyArray<[keyof PaletaWeb, string]> = [
  ["primario", "--primario"],
  ["primarioOscuro", "--primario-oscuro"],
  ["primarioClaro", "--primario-claro"],
  ["sobrePrimario", "--sobre-primario"],
];

/**
 * Aplica la paleta sobre `raiz`, normalmente `document.documentElement`.
 *
 * La raíz entra como parámetro en vez de tomarse del global para que esto se pueda probar:
 * las pruebas corren en Node y ahí no hay `document`.
 *
 * Cada color se valida por separado y los que no pasan se dejan sin escribir, conservando el
 * valor de `:root`. Un documento a medio escribir degrada a morado en ese color concreto,
 * nunca a una página en blanco.
 */
export function aplicarPaleta(paleta: PaletaWeb | null | undefined, raiz: HTMLElement): void {
  if (!paleta) return;
  for (const [campo, variable] of VARIABLES) {
    const valor = paleta[campo];
    if (typeof valor === "string" && HEX.test(valor)) {
      raiz.style.setProperty(variable, valor);
    }
  }
}
