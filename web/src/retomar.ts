/**
 * Volver a donde se quedó (2026-11-26). Con la página en segundo plano, el teléfono (sobre todo
 * iOS) la cierra para liberar memoria, y al volver a abrirla arrancaba de cero en Inicio. Ahora,
 * cada vez que la página se va al fondo se anota la ventana y el scroll, y si se vuelve a abrir
 * poco después (`VIGENCIA_MS`) se retoma ahí, como una app normal. Más tarde ya no: abrir al día
 * siguiente en Estadísticas sería raro, y para eso se abre en Inicio.
 *
 * Lo que vive dentro de cada ventana ya se guarda por su lado: el entrenamiento en curso sigue
 * en el teléfono y Registro abre directo en él. Los juegos no se retoman a media partida: se
 * vuelve al Arcade. Un aviso tocado (`abrirDesdeAviso.ts`) manda sobre esto.
 */

/** Cuánto vale lo anotado: lo normal de ir a otra app un momento y regresar. */
export const VIGENCIA_MS = 30 * 60_000;
export const LLAVE_RETOMAR = "osfit:retomar";

export interface Lugar {
  ventana: string;
  scroll: number;
  cuando: number;
}

export interface AlmacenRetomar {
  getItem(llave: string): string | null;
  setItem(llave: string, valor: string): void;
}

/** Las ventanas que no se retoman tal cual, y a cuál se vuelve en su lugar. */
const EN_SU_LUGAR: Record<string, string> = {
  juego: "arcade",
  kettlebell: "arcade",
  boxjump: "arcade",
};

export function anotarLugar(almacen: AlmacenRetomar | null, ventana: string, scroll: number, ahora: number): void {
  try {
    almacen?.setItem(LLAVE_RETOMAR, JSON.stringify({ ventana, scroll: Math.max(0, Math.round(scroll)), cuando: ahora }));
  } catch {
    // Modo privado o cuota llena: se abre en Inicio, como siempre.
  }
}

/**
 * Dónde retomar, o null para abrir en Inicio: sin nada anotado, anotado hace más de
 * `VIGENCIA_MS`, en Inicio, o en una ventana que ya no existe.
 */
export function lugarARetomar(almacen: AlmacenRetomar | null, ahora: number, ventanas: readonly string[]): Lugar | null {
  let crudo: string | null = null;
  try {
    crudo = almacen?.getItem(LLAVE_RETOMAR) ?? null;
  } catch {
    return null;
  }
  if (!crudo) return null;
  let l: Partial<Lugar>;
  try {
    l = JSON.parse(crudo) as Partial<Lugar>;
  } catch {
    return null;
  }
  if (typeof l.ventana !== "string" || typeof l.cuando !== "number") return null;
  const edad = ahora - l.cuando;
  if (edad < 0 || edad > VIGENCIA_MS) return null;
  const enSuLugar = EN_SU_LUGAR[l.ventana];
  const ventana = enSuLugar ?? l.ventana;
  if (ventana === "inicio" || !ventanas.includes(ventana)) return null;
  return { ventana, scroll: enSuLugar ? 0 : (typeof l.scroll === "number" && l.scroll > 0 ? l.scroll : 0), cuando: l.cuando };
}
