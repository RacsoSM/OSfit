import { nombreMes } from "../resumenMensual";

/**
 * El póster del mes (la historia final del resumen, diseño "A1 · S1" del entrenador, 2026-11-24)
 * como imagen para compartir o guardar: "Compartir" la manda por el menú de compartir del
 * teléfono (WhatsApp, Instagram, guardar en la galería…) y, si el navegador no comparte
 * archivos, la descarga.
 *
 * Se dibuja aparte, en un `<canvas>` de 1080 × 1920 (el tamaño de una historia), y no copiando la
 * pantalla: así sale nítida y igual en cualquier teléfono, sin las luces ni el confeti a medias.
 * Los mismos datos (`DatosPoster`) arman el póster de la pantalla, para que digan lo mismo.
 */

/** "+4 % vs septiembre": cuánto cambió y contra qué mes; null sin anterior. */
export interface Cambio { n: number; mes: string }

export interface DatosPoster {
  mes: string;
  nombre: string;
  /** Su rango general, con su color y contra quiénes entrenan; null sin datos de fuerza. */
  rango: { nombre: string; color: string; percentil: number; cambio: Cambio | null } | null;
  /** Los 4 números: asistencia, kilos, tiempo en el gym y racha más larga. */
  numeros: { valor: string; etiqueta: string; color: string; cambio: Cambio | null }[];
  ejercicios: string[];
  musculos: { nombre: string; color: string }[];
}

const ANCHO = 1080;
const ALTO = 1920;
const LETRA = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const C = {
  fondo: "#121214", texto: "#f0efec", texto2: "#c3c2b7", texto3: "#8f8e87",
  acento: "#86b6ef", sube: "#0ca30c", baja: "#e66767", caja: "rgba(255, 255, 255, 0.06)",
};
const MARCO = ["#ffb703", "#e0457b", "#9d4edd", "#5b5bd6", "#3b8fff"];

/** El texto de un cambio, como en la pantalla. */
export function textoCambio(c: Cambio): string {
  if (c.n === 0) return `= igual que ${nombreMes(c.mes)}`;
  return c.n > 0 ? `↑ +${c.n} % vs ${nombreMes(c.mes)}` : `↓ −${Math.abs(c.n)} % vs ${nombreMes(c.mes)}`;
}

/** "97,335 <small>kg</small>" → "97,335 kg": la imagen no lleva HTML. */
export const sinEtiquetas = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function redondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Escribe `texto` achicando la letra hasta que quepa en `max` px. */
function ajustado(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, max: number, peso: number, tam: number): void {
  let t = tam;
  ctx.font = `${peso} ${t}px ${LETRA}`;
  while (ctx.measureText(texto).width > max && t > 18) { t -= 2; ctx.font = `${peso} ${t}px ${LETRA}`; }
  ctx.fillText(texto, x, y);
}

/** Dibuja el póster en un canvas nuevo de 1080 × 1920. */
export function dibujarPoster(d: DatosPoster): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";

  // Fondo y marco con los colores de los rangos.
  ctx.fillStyle = C.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  const brillo = ctx.createRadialGradient(ANCHO / 2, 0, 0, ANCHO / 2, 0, ALTO * 0.6);
  brillo.addColorStop(0, "#26345a");
  brillo.addColorStop(1, "rgba(18, 18, 20, 0)");
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  const marco = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
  MARCO.forEach((c, i) => marco.addColorStop(i / (MARCO.length - 1), c));
  ctx.lineWidth = 10;
  ctx.strokeStyle = marco;
  redondo(ctx, 28, 28, ANCHO - 56, ALTO - 56, 64);
  ctx.stroke();

  const izq = 96;
  const ancho = ANCHO - izq * 2;
  let y = 190;

  // Encabezado y nombre.
  ctx.fillStyle = C.acento;
  ctx.font = `800 38px ${LETRA}`;
  ctx.fillText(`${nombreMes(d.mes).toUpperCase()} ${d.mes.slice(0, 4)} · OSFIT`, izq, y);
  y += 130;
  ctx.fillStyle = C.texto;
  ajustado(ctx, d.nombre, izq, y, ancho, 900, 120);
  y += 60;

  // El rango con su medalla.
  if (d.rango) {
    const alto = 190;
    redondo(ctx, izq, y, ancho, alto, 40);
    ctx.fillStyle = "rgba(224, 69, 123, 0.13)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(224, 69, 123, 0.5)";
    ctx.stroke();
    const cx = izq + 100, cy = y + alto / 2;
    const medalla = ctx.createRadialGradient(cx - 18, cy - 20, 6, cx, cy, 60);
    medalla.addColorStop(0, "#ffffff");
    medalla.addColorStop(0.35, d.rango.color);
    medalla.addColorStop(1, "#3a1530");
    ctx.fillStyle = medalla;
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.texto;
    ajustado(ctx, d.rango.nombre, izq + 190, y + 92, ancho - 220, 900, 76);
    ctx.fillStyle = C.texto2;
    ajustado(ctx, `Más fuerte que el ${d.rango.percentil} % de quienes entrenan`, izq + 190, y + 140, ancho - 220, 500, 32);
    if (d.rango.cambio) {
      ctx.fillStyle = d.rango.cambio.n < 0 ? C.baja : d.rango.cambio.n > 0 ? C.sube : C.texto3;
      ctx.font = `800 30px ${LETRA}`;
      ctx.fillText(textoCambio(d.rango.cambio), izq + 190, y + 176);
    }
    y += alto + 44;
  }

  // Los 4 números, en una cuadrícula de 2 × 2 con aire.
  const sep = 30, anchoCaja = (ancho - sep) / 2, altoCaja = 230;
  d.numeros.forEach((n, i) => {
    const x = izq + (i % 2) * (anchoCaja + sep);
    const yy = y + Math.floor(i / 2) * (altoCaja + sep);
    redondo(ctx, x, yy, anchoCaja, altoCaja, 36);
    ctx.fillStyle = C.caja;
    ctx.fill();
    ctx.fillStyle = n.color;
    redondo(ctx, x + 36, yy + 34, 64, 9, 4);
    ctx.fill();
    ctx.fillStyle = C.texto;
    ajustado(ctx, n.valor, x + 36, yy + 112, anchoCaja - 72, 900, 62);
    ctx.fillStyle = C.texto2;
    ctx.font = `500 32px ${LETRA}`;
    ctx.fillText(n.etiqueta, x + 36, yy + 158);
    if (n.cambio) {
      ctx.fillStyle = n.cambio.n < 0 ? C.baja : n.cambio.n > 0 ? C.sube : C.texto3;
      ajustado(ctx, textoCambio(n.cambio), x + 36, yy + 200, anchoCaja - 72, 800, 28);
    }
  });
  y += altoCaja * 2 + sep + 80;

  // Sus ejercicios y sus músculos.
  const col2 = izq + ancho * 0.56;
  ctx.fillStyle = C.texto3;
  ctx.font = `900 28px ${LETRA}`;
  if (d.ejercicios.length) ctx.fillText("TUS EJERCICIOS", izq, y);
  if (d.musculos.length) ctx.fillText("TUS MÚSCULOS", col2, y);
  y += 26;
  d.ejercicios.forEach((e, i) => {
    const yy = y + 58 * (i + 1);
    ctx.fillStyle = C.acento;
    ctx.font = `900 36px ${LETRA}`;
    ctx.fillText(String(i + 1), izq, yy);
    ctx.fillStyle = C.texto;
    ajustado(ctx, e, izq + 48, yy, col2 - izq - 80, 600, 36);
  });
  d.musculos.forEach((m, i) => {
    const yy = y + 58 * (i + 1);
    ctx.fillStyle = m.color;
    redondo(ctx, col2, yy - 26, 26, 26, 8);
    ctx.fill();
    ctx.fillStyle = C.texto;
    ajustado(ctx, m.nombre, col2 + 44, yy, ANCHO - izq - col2 - 44, 600, 36);
  });

  // Pie.
  ctx.fillStyle = C.texto3;
  ctx.font = `600 30px ${LETRA}`;
  ctx.textAlign = "center";
  ctx.fillText(`Mi resumen de ${nombreMes(d.mes)} en OSfit`, ANCHO / 2, ALTO - 100);
  ctx.textAlign = "left";
  return canvas;
}

/** El póster como archivo PNG. */
export function posterComoArchivo(d: DatosPoster): Promise<File> {
  return new Promise((resolver, rechazar) => {
    dibujarPoster(d).toBlob((blob) => {
      if (!blob) { rechazar(new Error("sin imagen")); return; }
      resolver(new File([blob], `osfit-${nombreMes(d.mes)}-${d.mes.slice(0, 4)}.png`, { type: "image/png" }));
    }, "image/png");
  });
}

/**
 * Comparte el archivo con el menú del teléfono o, si no se puede, lo descarga. Devuelve qué
 * hizo, para el mensaje de la pantalla. Cancelar el menú de compartir no es un error.
 */
export async function compartirPoster(archivo: File, mes: string): Promise<"compartido" | "descargado" | "cancelado"> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [archivo] })) {
    try {
      await nav.share({ files: [archivo], title: `Mi resumen de ${nombreMes(mes)}` });
      return "compartido";
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return "cancelado";
    }
  }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "descargado";
}

