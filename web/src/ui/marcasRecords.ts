import type { TablaDiscos } from "./juegoDiscos";

/**
 * Las marcas de los records de los demás dentro de los juegos (entrenador, 2026-11-25: "que en
 * todos los minijuegos salgan pequeñas marcas que demuestren dónde quedaron los records de los
 * demás jugadores"): una por puntuación, con quién la tiene. La suya va aparte, como "Tu récord".
 *
 * Solo las más altas (`maximo`), para no llenar la pantalla; si varias empataron, van juntas.
 */
export interface Marca {
  puntos: number;
  texto: string;
  tuya: boolean;
  /** La de hasta arriba de la tabla: lleva corona. */
  campeon: boolean;
}

/** "Brianda Torres" → "Brianda T."; un solo nombre queda igual. */
export function nombreCorto(nombre: string): string {
  const [n, a] = nombre.trim().split(/\s+/);
  return a ? `${n} ${a.charAt(0).toUpperCase()}.` : n ?? "";
}

export function marcasDe(t: TablaDiscos | null, maximo = 8): Marca[] {
  if (!t) return [];
  const mejor = t.filas[0]?.puntos ?? 0;
  const porPuntos = new Map<number, string[]>();
  for (const f of t.filas) {
    if (f.esTuyo || f.puntos <= 0) continue;
    porPuntos.set(f.puntos, [...(porPuntos.get(f.puntos) ?? []), nombreCorto(f.nombre)]);
  }
  const marcas: Marca[] = [...porPuntos.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, maximo)
    .map(([puntos, nombres]) => ({
      puntos,
      texto: nombres.length > 2 ? `${nombres[0]} y ${nombres.length - 1} más` : nombres.join(" y "),
      tuya: false,
      campeon: puntos === mejor,
    }));
  if (t.tuMejor > 0) {
    // Si alguien más tiene tu mismo récord, va en la misma marca (no dos encimadas).
    const igual = marcas.find((m) => m.puntos === t.tuMejor);
    if (igual) { igual.texto = `Tú y ${igual.texto}`; igual.tuya = true; }
    else marcas.push({ puntos: t.tuMejor, texto: "Tu récord", tuya: true, campeon: t.tuMejor === mejor });
  }
  return marcas.sort((a, b) => a.puntos - b.puntos);
}

/** Hasta dónde llega el marcador de arriba: ahí no se ponen etiquetas, para no taparlo. */
export const ALTO_MARCADOR = 118;

/** Una etiqueta de marca: pastilla con borde de neón (rosa las de los demás, dorada la tuya). */
export function pintarEtiqueta(c: CanvasRenderingContext2D, m: Marca, unidad: string, x: number, y: number, alinear: "izq" | "der" | "centro", superada: boolean): void {
  if (y < ALTO_MARCADOR) return;
  const texto = `${superada ? "✓ " : m.campeon ? "👑 " : ""}${m.texto} · ${m.puntos}${unidad}`;
  c.save();
  c.font = "800 11px system-ui, -apple-system, sans-serif";
  const w = c.measureText(texto).width + 14, h = 18;
  const x0 = alinear === "der" ? x - w : alinear === "centro" ? x - w / 2 : x;
  const color = m.tuya ? "#ffd45c" : "#ff4fd8";
  c.globalAlpha = superada ? 0.5 : 0.95;
  c.fillStyle = "rgba(12, 10, 20, 0.78)";
  c.beginPath();
  c.moveTo(x0 + 9, y - h / 2); c.arcTo(x0 + w, y - h / 2, x0 + w, y + h / 2, 9); c.arcTo(x0 + w, y + h / 2, x0, y + h / 2, 9);
  c.arcTo(x0, y + h / 2, x0, y - h / 2, 9); c.arcTo(x0, y - h / 2, x0 + w, y - h / 2, 9); c.closePath();
  c.fill();
  c.strokeStyle = color; c.lineWidth = 1.5; c.shadowColor = color; c.shadowBlur = superada ? 0 : 8;
  c.stroke();
  c.shadowBlur = 0;
  c.fillStyle = m.tuya ? "#ffe9a8" : "#ffd1f4";
  c.textBaseline = "middle"; c.textAlign = "left";
  c.fillText(texto, x0 + 7, y + 0.5);
  c.restore();
}

/** Una línea de marca a lo ancho, punteada y con brillo de neón. */
export function pintarLinea(c: CanvasRenderingContext2D, m: Marca, x0: number, x1: number, y: number, superada: boolean): void {
  const color = m.tuya ? "rgba(255, 212, 92," : "rgba(255, 79, 216,";
  c.save();
  c.strokeStyle = `${color} ${superada ? 0.25 : 0.75})`;
  c.lineWidth = 2;
  c.setLineDash([7, 6]);
  c.shadowColor = m.tuya ? "#ffd45c" : "#ff4fd8"; c.shadowBlur = superada ? 0 : 6;
  c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
  c.restore();
}
