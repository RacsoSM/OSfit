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

/**
 * Si su pago es semanal o mensual. La app no lo guarda en el pago, pero sí la fecha de
 * vencimiento que calcula con él (7 días para semanal, 30 para mensual): menos de 25 días entre
 * el pago y su vencimiento es semanal. GEMELO del corte de `periodoEnPalabras` en
 * `functions/src/ultimoPago.ts`. Sin las dos fechas, mensual (como siempre).
 */
export function esSemanal(pago: { fecha: string; vence: string | null } | null | undefined): boolean {
  if (!pago?.vence) return false;
  const dias = Math.round((Date.parse(`${pago.vence}T12:00:00Z`) - Date.parse(`${pago.fecha}T12:00:00Z`)) / 86_400_000);
  return dias > 0 && dias < 25;
}

/** El estado del periodo en palabras, y si va bien, por vencer o vencido. */
export function estadoPeriodo(vence: string, hoy: string): { texto: string; tono: "bien" | "pronto" | "vencido" } {
  const dias = diasParaPago(vence, hoy);
  if (dias < 0) return { texto: dias === -1 ? "Venció ayer" : `Venció hace ${-dias} días`, tono: "vencido" };
  if (dias === 0) return { texto: "Vence hoy", tono: "pronto" };
  if (dias === 1) return { texto: "Vence mañana", tono: "pronto" };
  return { texto: `Te quedan ${dias} días`, tono: dias <= 5 ? "pronto" : "bien" };
}

const ICONO_COPIAR = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICONO_COPIADO = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

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
  // Semanal: lo que paga es el monto de su pago de la semana (la mensualidad de la app es por
  // mes). Mensual: la mensualidad de la app, o si no hay, el monto de su último pago.
  const semanal = esSemanal(ultimo);
  const cuota = semanal
    ? ultimo?.monto ?? null
    : typeof c.mensualidad === "number" && c.mensualidad > 0 ? c.mensualidad : ultimo?.monto ?? null;

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
    cuota !== null && cuota > 0 ? `<li><span>${semanal ? "Tu pago semanal" : "Tu mensualidad"}</span><b>${pesos(cuota)}</b></li>` : "",
  ].join("");

  // Cada dato con su botón de copiar (entrenador, 2026-11-26): para pegarlo en la app del banco.
  const comoPagar = config
    ? `<ul class="factura-lista">${config.lineas.map((l) => `
        <li><span>${escapar(l.etiqueta)}</span>
          <span class="factura-dato"><b>${escapar(l.valor)}</b>
            <button type="button" class="factura-copiar" data-copiar="${escapar(l.valor)}" aria-label="Copiar ${escapar(l.etiqueta)}">${ICONO_COPIAR}</button>
          </span>
        </li>`).join("")}</ul>
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

/**
 * Los botones de copiar. Al copiar, el ícono cambia a una palomita un momento. Sin permiso del
 * navegador para el portapapeles, se copia seleccionando un campo de texto escondido.
 */
export function conectarFacturacion(): void {
  document.querySelectorAll<HTMLButtonElement>("#contenido .factura-copiar[data-copiar]").forEach((b) =>
    b.addEventListener("click", async () => {
      const valor = b.dataset.copiar ?? "";
      let ok = false;
      try {
        await navigator.clipboard.writeText(valor);
        ok = true;
      } catch {
        const t = document.createElement("textarea");
        t.value = valor;
        t.setAttribute("readonly", "");
        t.style.position = "fixed";
        t.style.opacity = "0";
        document.body.append(t);
        t.select();
        ok = document.execCommand("copy");
        t.remove();
      }
      if (!ok) return;
      b.innerHTML = ICONO_COPIADO;
      b.classList.add("copiado");
      b.setAttribute("aria-label", "Copiado");
      setTimeout(() => { b.innerHTML = ICONO_COPIAR; b.classList.remove("copiado"); }, 1600);
    })
  );
}
