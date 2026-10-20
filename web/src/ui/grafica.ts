import type { Punto } from "../estadisticas";
import { escapar } from "./tarjetaDia";

/**
 * La gráfica de línea de Estadísticas (ver la spec de Estadísticas). SVG armado a mano como el
 * mapa: una sola serie en `--primario`, rejilla recesiva y el eje X en fechas reales, así que
 * las semanas sin entrenar se ven como hueco.
 *
 * Cada punto lleva su fecha y su etiqueta en atributos: `conectarGrafica` los lee del DOM para
 * la lectura de arriba, y así esta función sigue siendo pura.
 */

export interface Banda { desde: number; hasta: number; nombre: string; color: string; }

export interface OpcionesGrafica {
  /** Franjas de fondo (los rangos en la gráfica de nivel). Con ellas el eje Y va de 0 a la última. */
  bandas?: readonly Banda[];
  /** El texto del eje Y. */
  unidad?: string;
  /** El número grande de la lectura de cada punto ("72.9 kg"); por defecto, su etiqueta. */
  formato?: (p: Punto) => string;
}

/** Lo que dice la lectura de un punto: el número grande y, al lado, la fecha y la serie. */
function partesLectura(p: Punto, formato: (p: Punto) => string): { valor: string; detalle: string } {
  const valor = formato(p);
  return { valor, detalle: p.etiqueta && p.etiqueta !== valor ? `${fechaCorta(p.fecha)} · ${p.etiqueta}` : fechaCorta(p.fecha) };
}

const ANCHO = 340;
const ALTO = 180;
const IZQ = 34, DER = 10, ARR = 12, ABA = 22;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "16 oct". */
export function fechaCorta(fecha: string): string {
  return `${Number(fecha.slice(8, 10))} ${MESES[Number(fecha.slice(5, 7)) - 1]}`;
}

const dia = (fecha: string) => Date.parse(`${fecha}T12:00:00Z`) / 86_400_000;

/** El paso de la rejilla: 1, 2, 5, 10, 20, 50… lo que deje unas 4 líneas. */
function paso(rango: number): number {
  const bruto = rango / 4;
  const base = 10 ** Math.floor(Math.log10(bruto || 1));
  return [1, 2, 5, 10].map((m) => m * base).find((p) => p >= bruto) ?? 10 * base;
}

export function graficaLinea(puntos: readonly Punto[], opciones: OpcionesGrafica = {}): string {
  if (puntos.length === 0) return "";
  const dias = puntos.map((p) => dia(p.fecha));
  const d0 = dias[0], d1 = dias[dias.length - 1];
  const valores = puntos.map((p) => p.valor);
  let v0: number, v1: number, salto: number;
  if (opciones.bandas) {
    v0 = 0; v1 = Math.max(...opciones.bandas.map((b) => b.hasta)); salto = 0;
  } else {
    const min = Math.min(...valores), max = Math.max(...valores);
    salto = paso(Math.max(max - min, max * 0.2, 1));
    v0 = Math.max(0, Math.floor((min - salto * 0.5) / salto) * salto);
    v1 = Math.ceil((max + salto * 0.5) / salto) * salto;
  }
  const x = (d: number) => (d1 === d0 ? (IZQ + ANCHO - DER) / 2 : IZQ + ((d - d0) / (d1 - d0)) * (ANCHO - IZQ - DER));
  const y = (v: number) => ARR + (1 - (v - v0) / (v1 - v0)) * (ALTO - ARR - ABA);
  const r = (n: number) => n.toFixed(1);

  const fondo = opciones.bandas
    ? opciones.bandas.map((b) => `
        <rect x="${IZQ}" y="${r(y(b.hasta))}" width="${ANCHO - IZQ - DER}" height="${r(y(b.desde) - y(b.hasta))}" fill="${b.color}" opacity="0.18"/>
        <text x="${IZQ + 4}" y="${r(y(b.desde) - 3)}" class="grafica-banda">${escapar(b.nombre)}</text>`).join("")
    : Array.from({ length: Math.round((v1 - v0) / salto) + 1 }, (_, i) => v0 + i * salto).map((v) => `
        <line x1="${IZQ}" x2="${ANCHO - DER}" y1="${r(y(v))}" y2="${r(y(v))}" class="grafica-rejilla"/>
        <text x="${IZQ - 6}" y="${r(y(v) + 3)}" text-anchor="end" class="grafica-eje">${v.toLocaleString("es-MX")}</text>`).join("");

  // Tres fechas abajo: la primera, la de en medio y la última (sin repetir con un solo punto).
  const marcas = [...new Set([0, Math.floor((puntos.length - 1) / 2), puntos.length - 1])];
  const fechas = marcas.map((i, k) => {
    const ancla = marcas.length > 1 && k === 0 ? "start" : k === marcas.length - 1 && marcas.length > 1 ? "end" : "middle";
    return `<text x="${r(x(dias[i]))}" y="${ALTO - 6}" text-anchor="${ancla}" class="grafica-eje">${fechaCorta(puntos[i].fecha)}</text>`;
  }).join("");

  const linea = puntos.length > 1
    ? `<polyline class="grafica-linea" points="${puntos.map((p, i) => `${r(x(dias[i]))},${r(y(p.valor))}`).join(" ")}"/>`
    : "";
  const ultimo = puntos.length - 1;
  const formato = opciones.formato ?? ((p: Punto) => p.etiqueta);
  const circulos = puntos.map((p, i) => {
    const { valor, detalle } = partesLectura(p, formato);
    return `
      <circle class="grafica-punto${i === ultimo ? " elegido" : ""}" cx="${r(x(dias[i]))}" cy="${r(y(p.valor))}" r="${i === ultimo ? 5 : 3.5}"
        data-valor="${escapar(valor)}" data-detalle="${escapar(detalle)}"/>`;
  }).join("");
  const guia = `<line class="grafica-guia" x1="${r(x(dias[ultimo]))}" x2="${r(x(dias[ultimo]))}" y1="${ARR}" y2="${ALTO - ABA}"/>`;
  const resumen = `${puntos.length} ${puntos.length === 1 ? "fecha" : "fechas"}, del ${fechaCorta(puntos[0].fecha)} al ${fechaCorta(puntos[ultimo].fecha)}`;

  return `
    <svg class="grafica" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="${escapar(resumen)}${opciones.unidad ? ` (${escapar(opciones.unidad)})` : ""}">
      ${fondo}${fechas}${guia}${linea}${circulos}
    </svg>`;
}

/** El renglón de arriba de la gráfica: la lectura del punto elegido. Al abrir, el último. */
export function lecturaGrafica(puntos: readonly Punto[], formato: (p: Punto) => string = (p) => p.etiqueta): string {
  const p = puntos[puntos.length - 1];
  if (!p) return "";
  const { valor, detalle } = partesLectura(p, formato);
  return `
    <p class="grafica-lectura" aria-live="polite">
      <strong data-lectura="valor">${escapar(valor)}</strong>
      <span data-lectura="detalle">${escapar(detalle)}</span>
    </p>`;
}

/**
 * Tocar o arrastrar sobre la gráfica elige el punto más cercano en X: mueve la guía, agranda
 * el punto y cambia la lectura de su tarjeta. Se vuelve a colgar en cada repintado, como el
 * resto de `conectar*`.
 */
export function conectarGrafica(raiz: ParentNode): void {
  raiz.querySelectorAll<SVGSVGElement>("svg.grafica").forEach((svg) => {
    const puntos = [...svg.querySelectorAll<SVGCircleElement>(".grafica-punto")];
    const guia = svg.querySelector<SVGLineElement>(".grafica-guia");
    const caja = svg.closest(".tarjeta");
    const valor = caja?.querySelector("[data-lectura=valor]");
    const detalle = caja?.querySelector("[data-lectura=detalle]");
    if (puntos.length === 0) return;
    const elegir = (ev: PointerEvent) => {
      const marco = svg.getBoundingClientRect();
      const enX = ((ev.clientX - marco.left) / marco.width) * ANCHO;
      const distancia = (p: SVGCircleElement) => Math.abs(Number(p.getAttribute("cx")) - enX);
      const cerca = puntos.reduce((a, b) => (distancia(b) < distancia(a) ? b : a));
      for (const p of puntos) {
        p.classList.toggle("elegido", p === cerca);
        p.setAttribute("r", p === cerca ? "5" : "3.5");
      }
      const cx = cerca.getAttribute("cx") ?? "0";
      guia?.setAttribute("x1", cx);
      guia?.setAttribute("x2", cx);
      // `textContent`: lo que viene de las sesiones nunca se interpreta como HTML.
      if (valor) valor.textContent = cerca.dataset.valor ?? "";
      if (detalle) detalle.textContent = cerca.dataset.detalle ?? "";
    };
    svg.addEventListener("pointerdown", (ev) => {
      svg.setPointerCapture?.(ev.pointerId);
      elegir(ev);
    });
    svg.addEventListener("pointermove", (ev) => {
      if (ev.buttons > 0 || ev.pointerType === "mouse") elegir(ev);
    });
  });
}
