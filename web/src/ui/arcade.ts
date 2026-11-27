import { escapar } from "./tarjetaDia";
import type { TablaDiscos } from "./juegoDiscos";

/**
 * El Arcade (entrenador, 2026-11-24, diseño "B · Arcade neón"): la ventana del menú que reúne los
 * minijuegos, a toda la pantalla. Cada juego es una pantalla de maquinita con su imagen y su
 * "CAMPEÓN" (el #1 de sus Records) en grande, con su puntuación, y tu propio récord. Tocarla abre el juego,
 * que es una subventana del Arcade ("atrás" regresa aquí).
 *
 * Las tablas se piden al entrar (`cargarArcade`) y se recuerdan en el teléfono, en las mismas
 * llaves que usan los juegos: así el Arcade y cada juego se ven al día sin esperar.
 */

export interface JuegoArcade {
  /** La ventana del juego. */
  ventana: "juego" | "kettlebell" | "boxjump" | "pesarun";
  nombre: string;
  imagen: string;
  /** Dónde guarda el teléfono su tabla. */
  llave: string;
  /** El color del neón de su marco. */
  neon: "cian" | "rosa" | "lima" | "naranja";
  nuevo?: boolean;
}

export const JUEGOS_ARCADE: readonly JuegoArcade[] = [
  { ventana: "juego", nombre: "Torre de discos", imagen: "/arcade/torre.webp", llave: "osfit:torre-tabla", neon: "cian" },
  { ventana: "kettlebell", nombre: "Fit Bird", imagen: "/arcade/kettlebell.webp?v=3", llave: "osfit:kettlebell-tabla", neon: "rosa" },
  { ventana: "boxjump", nombre: "Jumper", imagen: "/arcade/boxjump.webp?v=3", llave: "osfit:boxjump-tabla", neon: "lima" },
  { ventana: "pesarun", nombre: "Correle pa", imagen: "/arcade/pesarun.webp", llave: "osfit:pesarun-tabla", neon: "naranja", nuevo: true },
];

function tablaDe(llave: string): TablaDiscos | null {
  try {
    const t = JSON.parse(globalThis.localStorage?.getItem(llave) ?? "null") as TablaDiscos | null;
    return t && Array.isArray(t.filas) && typeof t.tuMejor === "number" ? t : null;
  } catch { return null; }
}

/** Cuántas letras del nombre del campeón caben en la tarjeta. */
export const MAX_NOMBRE = 18;

/** Hasta 18 letras del nombre completo (entrenador, 2026-11-25); antes era "Jose J.". */
function nombreCorto(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").slice(0, MAX_NOMBRE).trimEnd();
}

/**
 * Los renglones del campeón ("👑 Jessica Morales Ib") y su puntuación, o la invitación a
 * estrenarlo. Con empate en el primer lugar (entrenador, 2026-11-27) salen los dos, cada uno en
 * su renglón con su nombre hasta 18 letras; si empatan más de dos, el segundo lleva "+1", "+2".
 */
export function hiScore(t: TablaDiscos | null): { quien: string[]; puntos: string } {
  const campeon = t?.filas[0];
  if (!campeon) return { quien: [t ? "¡Sé el primer campeón!" : "Cargando…"], puntos: "" };
  const primeros = t!.filas.filter((f) => f.puesto === 1);
  const quien = primeros.slice(0, 2).map((f) => `👑 ${nombreCorto(f.nombre)}`);
  if (primeros.length > 2) quien[1] += ` +${primeros.length - 2}`;
  return { quien, puntos: String(campeon.puntos) };
}

export function ventanaArcade(tablas: Readonly<Record<string, TablaDiscos | null>> = {}): string {
  const tarjetas = JUEGOS_ARCADE.map((j) => {
    const t = tablas[j.llave] ?? tablaDe(j.llave);
    const hi = hiScore(t);
    const tuyo = t && t.tuMejor > 0
      ? `Tu récord ${t.tuMejor}${t.filas.find((f) => f.esTuyo) ? ` · #${t.filas.find((f) => f.esTuyo)!.puesto}` : ""}`
      : "Todavía no juegas";
    return `
      <button type="button" class="ar-maquina ${j.neon}" data-arcade="${j.ventana}" aria-label="Jugar ${escapar(j.nombre)}">
        ${j.nuevo ? `<span class="ar-nuevo">¡NUEVO!</span>` : ""}
        <span class="ar-pantalla"><img src="${j.imagen}" alt="" loading="lazy" decoding="async"></span>
        <span class="ar-nombre">${escapar(j.nombre)}</span>
        <span class="ar-titulo-campeon">CAMPEÓN</span>
        <span class="ar-hi"><span class="ar-campeones">${hi.quien.map((q) => `<span>${escapar(q)}</span>`).join("")}</span><b>${hi.puntos}</b></span>
        <span class="ar-tuyo"><span>${escapar(tuyo)}</span><span class="ar-jugar">JUGAR ▶</span></span>
      </button>`;
  }).join("");
  return `
    <div class="arcade">
      <div class="ar-marquesina"><b>ARCADE</b><span>OSFIT · INSERT COIN</span></div>
      ${tarjetas}
    </div>`;
}

export function conectarArcade(abrir: (ventana: JuegoArcade["ventana"]) => void): void {
  document.querySelectorAll<HTMLElement>("#contenido [data-arcade]").forEach((b) =>
    b.addEventListener("click", () => abrir(b.dataset.arcade as JuegoArcade["ventana"])));
}

/** Pide las tablas de todos los juegos, las recuerda en el teléfono y repinta. */
export async function cargarArcade(pedir: Readonly<Record<string, () => Promise<TablaDiscos>>>, repintar: () => void): Promise<void> {
  await Promise.all(JUEGOS_ARCADE.map(async (j) => {
    const f = pedir[j.llave];
    if (!f) return;
    try {
      const t = await f();
      globalThis.localStorage?.setItem(j.llave, JSON.stringify(t));
    } catch { /* se queda la que ya tenía el teléfono */ }
  }));
  repintar();
}
