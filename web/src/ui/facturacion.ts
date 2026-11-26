import type { Cliente, ConfigFacturacion } from "../datos";
import { fechaEnMazatlan } from "../fecha";
import { diasParaPago } from "../pago";
import { escapar } from "./tarjetaDia";

/**
 * El apartado Facturación (entrenador, 2026-11-26): su periodo vigente, cuándo pagó y cuánto,
 * cuándo vence, su mensualidad y cómo pagar. Solo si el entrenador se lo prendió en la app
 * (`facturacionWeb`); si no, un aviso de que no tiene acceso.
 *
 * Los datos salen de su documento: `ultimoPago` (lo copia la función `alCambiarPago` de sus
 * pagos), `fechaProximoPago` y `mensualidad` (los pone la app). Cómo pagar, de
 * `configFacturacion/datos`, igual para todas.
 */

export const SIN_ACCESO = "Vaya, parece ser que por algún motivo desconocido no tienes acceso a este apartado";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "20 de noviembre de 2026". */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** "$650" o "$1,250.50", en pesos. */
export function pesos(monto: number): string {
  return `$${monto.toLocaleString("es-MX", { minimumFractionDigits: Number.isInteger(monto) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Hasta cuándo le alcanza: la fecha del próximo pago de la app, o la del último pago. */
export function venceEl(c: Cliente): string | null {
  if (c.fechaProximoPago) return fechaEnMazatlan(c.fechaProximoPago.toDate());
  return c.ultimoPago?.vence ?? null;
}

/** El estado del periodo en palabras, y si va bien, por vencer o vencido. */
export function estadoPeriodo(vence: string, hoy: string): { texto: string; tono: "bien" | "pronto" | "vencido" } {
  const dias = diasParaPago(vence, hoy);
  if (dias < 0) return { texto: dias === -1 ? "Venció ayer" : `Venció hace ${-dias} días`, tono: "vencido" };
  if (dias === 0) return { texto: "Vence hoy", tono: "pronto" };
  if (dias === 1) return { texto: "Vence mañana", tono: "pronto" };
  return { texto: `Te quedan ${dias} días`, tono: dias <= 5 ? "pronto" : "bien" };
}

export function ventanaFacturacion(c: Cliente, hoy: string, config: ConfigFacturacion | null): string {
  if (c.facturacionWeb !== true) {
    return `
      <div class="tarjeta vacio factura-sin-acceso">
        <div class="vacio-emoji">🔒</div>
        <p>${SIN_ACCESO}</p>
      </div>`;
  }

  const ultimo = c.ultimoPago ?? null;
  const vence = venceEl(c);
  const mensualidad = typeof c.mensualidad === "number" && c.mensualidad > 0 ? c.mensualidad : ultimo?.monto ?? null;

  const periodo = vence
    ? (() => {
        const estado = estadoPeriodo(vence, hoy);
        return `
          <div class="tarjeta factura-periodo">
            <div class="factura-cabecera">
              <p class="tarjeta-titulo">Tu periodo</p>
              <span class="factura-estado ${estado.tono}">${estado.texto}</span>
            </div>
            <p class="factura-rango">${ultimo ? `Del ${escapar(fechaLarga(ultimo.fecha))}<br>al ` : "Hasta el "}${escapar(fechaLarga(vence))}</p>
          </div>`;
      })()
    : `
      <div class="tarjeta vacio">
        <div class="vacio-emoji">🧾</div>
        <p>Todavía no hay pagos registrados.</p>
      </div>`;

  const filas = [
    ultimo ? `<li><span>Pagaste</span><b>${escapar(fechaLarga(ultimo.fecha))}${ultimo.monto > 0 ? ` · ${pesos(ultimo.monto)}` : ""}</b></li>` : "",
    vence ? `<li><span>Vence</span><b>${escapar(fechaLarga(vence))}</b></li>` : "",
    mensualidad !== null && mensualidad > 0 ? `<li><span>Tu mensualidad</span><b>${pesos(mensualidad)}</b></li>` : "",
  ].join("");

  const comoPagar = config
    ? `<ul class="factura-lista">${config.lineas.map((l) => `<li><span>${escapar(l.etiqueta)}</span><b>${escapar(l.valor)}</b></li>`).join("")}</ul>
       ${config.nota ? `<p class="factura-nota">${escapar(config.nota)}</p>` : ""}`
    : `<p class="factura-nota">Pídele a tu coach los datos para pagar.</p>`;

  return `
    ${periodo}
    ${filas ? `<div class="tarjeta"><p class="tarjeta-titulo">Tu último pago</p><ul class="factura-lista">${filas}</ul></div>` : ""}
    <div class="tarjeta factura-pagar">
      <p class="tarjeta-titulo">Cómo pagar</p>
      ${comoPagar}
    </div>`;
}
