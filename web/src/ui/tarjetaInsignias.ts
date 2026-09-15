import type { LogroPersonalOtorgado, MedallaOtorgada } from "../datos";
import { escapar } from "./tarjetaDia";

/**
 * Más reciente primero. `rangoInicio` es una fecha ISO, así que comparar los textos alcanza.
 * Dentro de la misma quincena manda `orden`, que es el que eligió el entrenador.
 */
function porRangoDescendente<T extends { rangoInicio: string; orden?: number }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.rangoInicio !== b.rangoInicio) return a.rangoInicio < b.rangoInicio ? 1 : -1;
    return (a.orden ?? 0) - (b.orden ?? 0);
  });
}

/**
 * Imagen por defecto de los logros personales, la misma que empaqueta la app para cuando el
 * logro no tiene una propia. Vive en `public/`, así que Vite la copia a `dist` tal cual y
 * queda servida desde la raíz, sin hash ni import.
 */
const IMAGEN_LOGRO_POR_DEFECTO = "/logroPersonalDefault.png";

/**
 * Sin `imagenUrl` se dibuja una insignia genérica en vez de un hueco: todo lo otorgado antes
 * de que existiera Storage llegó sin imagen, y esas medallas se ganaron igual. Las medallas
 * no tienen imagen por defecto que poner ahí, así que su respaldo sigue siendo el emoji.
 */
function insignia(imagenUrl: string | null | undefined, respaldo: string): string {
  return imagenUrl
    ? `<img class="insignia-img" src="${escapar(imagenUrl)}" alt="" loading="lazy">`
    : `<div class="insignia-img generica">${respaldo}</div>`;
}

export function seccionVacia(titulo: string, emoji: string, que: string, quien: string): string {
  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">${titulo}</p>
      <div class="vacio" style="padding: 14px 8px">
        <div class="vacio-emoji">${emoji}</div>
        <p><strong>${que}</strong></p>
        <p style="color: var(--texto-tenue); font-size: 14px">${quien}</p>
      </div>
    </div>`;
}

export function tarjetaMedallas(medallas: MedallaOtorgada[]): string {
  if (medallas.length === 0) {
    return seccionVacia(
      "Tus medallas",
      "🏅",
      "Todavía no tienes medallas",
      "Tu entrenador las entrega al cerrar cada quincena."
    );
  }

  const piezas = porRangoDescendente(medallas).map(
    (m) => `
      <div class="insignia">
        ${insignia(m.imagenUrl, "🏅")}
        <p class="insignia-nombre">${escapar(m.nombreMedalla)}</p>
      </div>`
  );

  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Tus medallas</p>
      <div class="insignias">${piezas.join("")}</div>
    </div>`;
}

export function tarjetaLogrosPersonales(logros: LogroPersonalOtorgado[]): string {
  if (logros.length === 0) {
    return seccionVacia(
      "Tus logros personales",
      "⭐",
      "Todavía no tienes logros personales",
      "Tu entrenador te los escribe cuando te los ganas."
    );
  }

  const piezas = porRangoDescendente(logros).map(
    (l) => `
      <div class="insignia">
        ${insignia(l.imagenUrl ?? IMAGEN_LOGRO_POR_DEFECTO, "⭐")}
        <p class="insignia-nombre">${escapar(l.nombreLogro)}</p>
        <p class="insignia-rango">${escapar(l.encabezadoRango)}</p>
      </div>`
  );

  return `
    <div class="tarjeta">
      <p class="tarjeta-titulo">Tus logros personales</p>
      <div class="insignias">${piezas.join("")}</div>
    </div>`;
}
