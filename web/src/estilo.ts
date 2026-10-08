/**
 * El estilo visual de la página, que elige la clienta desde Ajustes.
 *
 * A diferencia de la paleta, esto NO viaja a Firestore: es puro front, una preferencia de este
 * navegador. La página no escribe en Firestore (ver `acciones.ts`), y un estilo no justifica
 * una Cloud Function nueva ni un campo que el entrenador tendría que entender. El costo,
 * aceptado: en otro teléfono la clienta vuelve a ver el clásico hasta que lo cambie ahí.
 *
 * El estilo vive como atributo `data-estilo` en `<html>` y el CSS de cada uno cuelga de ese
 * atributo. El clásico NO pone atributo: así su CSS es exactamente el de siempre, sin una sola
 * regla nueva en el camino, y nadie que no toque el combo ve un píxel distinto.
 */

export type IdEstilo = "clasico" | "pixel" | "neon" | "comic" | "minimalista" | "sakura" | "halloween";

export interface Estilo {
  id: IdEstilo;
  nombre: string;
  descripcion: string;
}

export const ESTILOS: readonly Estilo[] = [
  {
    id: "clasico",
    nombre: "Clásico",
    descripcion: "El de siempre: tarjetas suaves, degradados y bordes redondos.",
  },
  {
    id: "pixel",
    nombre: "Pixel art",
    descripcion: "Como un videojuego de 8 bits: bloques, letras pixeladas y un paisaje nocturno.",
  },
  {
    id: "neon",
    nombre: "Neón",
    descripcion: "Gimnasio de noche: tubos de neón, una cuadrícula que corre al horizonte y un sol retro.",
  },
  {
    id: "comic",
    nombre: "Cómic",
    descripcion: "Como una historieta: viñetas con tinta, tramas de puntos y onomatopeyas.",
  },
  {
    id: "minimalista",
    nombre: "Minimalista",
    descripcion: "Claro y limpio: fondo blanco, mucho aire y un solo acento de color. Se lee bien a pleno sol.",
  },
  {
    id: "sakura",
    nombre: "Sakura",
    descripcion: "Primavera en Japón: un cerezo en flor y pétalos que caen mientras navegas. Toca la pantalla y sóplalos.",
  },
  {
    id: "halloween",
    nombre: "Halloween",
    descripcion: "Noche de terror: luna de sangre, calabazas malvadas, fantasmas, ojos que te miran desde la oscuridad y telarañas. Toca la pantalla y suelta un fantasma.",
  },
];

/**
 * Las fuentes de cada estilo, de Google Fonts. Se piden solo al elegir ese estilo: quien se
 * queda en el clásico no descarga ninguna. Gemelas del script en línea de `index.html`, que
 * las pide antes de que llegue el bundle; `estilo.test.ts` revisa que coincidan.
 */
export const FUENTES: Record<Exclude<IdEstilo, "clasico">, string> = {
  // Press Start 2P es la de arcade, pero en párrafos se vuelve ilegible en un teléfono: va solo
  // en títulos y números, y el texto corrido usa Pixelify Sans.
  pixel: "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Pixelify+Sans:wght@400..700&display=swap",
  // Monoton dibuja los tubos, pero solo se lee en grande; Tilt Neon es neón legible a 16 px.
  neon: "https://fonts.googleapis.com/css2?family=Monoton&family=Tilt+Neon&display=swap",
  // Bangers es la rotulación de las viñetas; Comic Neue, la letra de los globos.
  comic: "https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&display=swap",
  minimalista: "https://fonts.googleapis.com/css2?family=Inter:wght@300..700&display=swap",
  // Shippori Mincho es la letra de pincel de los títulos (y la del sello 桜); Zen Maru Gothic,
  // redondeada y suave, la del texto. Las dos traen latín: Google parte las japonesas por
  // `unicode-range`, así que solo se baja el trozo de los caracteres que se usan.
  sakura: "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;800&family=Zen+Maru+Gothic:wght@400;500;700&display=swap",
  // Creepster, la letra que chorrea de los carteles de terror, solo en títulos grandes; el texto
  // va en Grandstander, redondeada y juguetona, que se lee bien a 16 px.
  halloween: "https://fonts.googleapis.com/css2?family=Creepster&family=Grandstander:wght@400;600;800&display=swap",
};

export const ESTILO_POR_DEFECTO: IdEstilo = "clasico";

/**
 * Gemela del script en línea de `index.html`, que la lee antes de que llegue el bundle para
 * que la página no se pinte primero en clásico y después salte a pixel. Si cambia acá, cambia
 * allá.
 */
export const CLAVE_ESTILO = "osfit.estilo";

/** Lo que se usa de `localStorage`; entra como parámetro para probarlo en Node. */
export interface AlmacenEstilo {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

export function esEstilo(valor: unknown): valor is IdEstilo {
  return ESTILOS.some((e) => e.id === valor);
}

/**
 * Lo guardado, o el clásico. Un valor desconocido (un estilo que existió y se quitó) o un
 * almacén que tira al leerlo —`localStorage` bloqueado, ver `almacenesDelNavegador`— caen en
 * el clásico en vez de dejar la página sin estilo.
 */
export function estiloGuardado(almacen: AlmacenEstilo | null): IdEstilo {
  try {
    const valor = almacen?.getItem(CLAVE_ESTILO);
    return esEstilo(valor) ? valor : ESTILO_POR_DEFECTO;
  } catch {
    return ESTILO_POR_DEFECTO;
  }
}

/** Si no se puede guardar, el estilo igual se aplica: solo no sobrevive a la recarga. */
export function guardarEstilo(id: IdEstilo, almacen: AlmacenEstilo | null): void {
  try {
    almacen?.setItem(CLAVE_ESTILO, id);
  } catch {
    // Modo privado de Safari o cuota llena: no hay nada útil que hacer.
  }
}

/** Lo que `aplicarEstilo` toca de `<html>`. */
interface RaizEstilo {
  setAttribute(nombre: string, valor: string): void;
  removeAttribute(nombre: string): void;
}

export function aplicarEstilo(id: IdEstilo, raiz: RaizEstilo): void {
  if (id === ESTILO_POR_DEFECTO) raiz.removeAttribute("data-estilo");
  else raiz.setAttribute("data-estilo", id);
}

/**
 * La rejilla de la transición: un retraso por celda, en milisegundos, fila por fila.
 *
 * La cortina barre en diagonal desde la esquina de arriba a la izquierda, como el cambio de
 * escena de un juego viejo, con un poco de ruido para que el frente se vea pixelado y no como
 * una línea recta. `azar` entra como parámetro para que la prueba sea determinista.
 */
export function retrasosDeCortina(
  columnas: number,
  filas: number,
  barridoMs: number,
  azar: () => number = Math.random
): number[] {
  const diagonales = columnas + filas - 2 || 1;
  const ruido = barridoMs * 0.25;
  const retrasos: number[] = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const base = ((c + f) / diagonales) * (barridoMs - ruido);
      retrasos.push(Math.round(base + azar() * ruido));
    }
  }
  return retrasos;
}

export const ONOMATOPEYAS = ["¡ZAS!", "¡POW!", "¡BAM!", "¡BOOM!", "¡KAPOW!"] as const;

/** La que grita la transición del cómic. `azar` entra para que la prueba sea determinista. */
export function onomatopeya(azar: () => number = Math.random): string {
  return ONOMATOPEYAS[Math.min(ONOMATOPEYAS.length - 1, Math.floor(azar() * ONOMATOPEYAS.length))];
}
