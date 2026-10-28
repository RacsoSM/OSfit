import { nombreMusculo, nombreRango } from "../fuerza";
import { formatoKg, nombreMes, type ResumenMensual } from "../resumenMensual";
import { celdasMes } from "./calendario";
import { escapar } from "./tarjetaDia";

/**
 * La ventana Resumen mensual: el selector de meses y, del mes elegido, la portada,
 * entrenamiento, calendario, fuerza y mejores marcas, en ese orden (el diseño "Final · B + A"
 * que eligió el entrenador el 2026-10-28). Ver
 * `docs/superpowers/specs/2026-10-28-resumen-mensual-design.md`.
 */

export interface MesDeLista { mes: string; enCurso: boolean }

export interface DatosResumenMensual {
  /** Mientras llegan los meses cerrados: el mes en curso ya se puede ver. */
  cargando: boolean;
  /** Del más nuevo al más viejo. */
  meses: readonly MesDeLista[];
  /** El elegido, o null si no hay meses. */
  mes: string | null;
  resumen: ResumenMensual | null;
  enCurso: boolean;
  hoy: string;
  sexo: "H" | "M" | null;
  /** Cambio de nivel por músculo contra el mes anterior; null si no hay con qué comparar. */
  cambios: Record<string, number> | null;
}

/**
 * El mes que está viendo. Vive aquí y no en `pintar()`, como el estado de Registro: un snapshot
 * a destiempo repinta y no debe regresarla al mes en curso.
 */
let mesElegido: string | null = null;

export function elegirMes(mes: string | null): void {
  mesElegido = mes;
}

export function mesElegidoResumen(): string | null {
  return mesElegido;
}

/** Al salir de la ventana: la próxima vez abre en el mes en curso. */
export function reiniciarResumenMensual(): void {
  mesElegido = null;
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const etiquetaMes = (m: MesDeLista) =>
  `${capital(nombreMes(m.mes))} ${m.mes.slice(0, 4)}${m.enCurso ? " · en curso" : ""}`;

const FLECHA_IZQ = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`;
const FLECHA_DER = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;

/**
 * Un `<select>` nativo, sin escribir (entrenador, 2026-10-28: no es un buscador), con flechas a
 * los lados. La lista va del más nuevo al más viejo: "anterior" es el de abajo.
 */
function selector(d: DatosResumenMensual): string {
  const i = d.meses.findIndex((m) => m.mes === d.mes);
  const anterior = d.meses[i + 1]?.mes ?? null;
  const siguiente = i > 0 ? d.meses[i - 1].mes : null;
  const flecha = (id: string, etiqueta: string, destino: string | null, icono: string) =>
    `<button type="button" class="rm-flecha" id="${id}" aria-label="${etiqueta}"
       ${destino ? `data-mes="${destino}"` : "disabled"}>${icono}</button>`;
  return `
    <div class="rm-selector">
      ${flecha("rm-anterior", "Mes anterior", anterior, FLECHA_IZQ)}
      <select class="rm-select" id="rm-mes" aria-label="Mes">
        ${d.meses.map((m) => `<option value="${m.mes}"${m.mes === d.mes ? " selected" : ""}>${etiquetaMes(m)}</option>`).join("")}
      </select>
      ${flecha("rm-siguiente", "Mes siguiente", siguiente, FLECHA_DER)}
    </div>`;
}

/** "Al 28 de octubre. Se cierra el 1 de noviembre." Solo en el mes en curso. */
function lineaCierre(mes: string, hoy: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const siguiente = m === 12 ? `${anio + 1}-01` : `${anio}-${String(m + 1).padStart(2, "0")}`;
  return `<p class="rm-cierre">Al ${Number(hoy.slice(8, 10))} de ${nombreMes(mes)}. Se cierra el 1 de ${nombreMes(siguiente)}.</p>`;
}

/** El número grande con su unidad chica: "59,123 kg", "17 h 24 min". */
function tiempo(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const min = Math.round(minutos % 60);
  if (h === 0) return `${min} <small>min</small>`;
  return min === 0 ? `${h} <small>h</small>` : `${h} h <small>${min} min</small>`;
}

function portada(r: ResumenMensual, enCurso: boolean, hoy: string): string {
  const a = r.asistencia;
  const conRegistros = a.entreno + a.justificadas + a.faltas > 0;
  const dato = (valor: string, etiqueta: string) =>
    `<div><p class="rm-num">${valor}</p><p class="rm-etq">${etiqueta}</p></div>`;
  return `
    <section class="rm-portada">
      <p class="rm-estado">${enCurso ? `En curso · al ${Number(hoy.slice(8, 10))}` : "Cerrado"}</p>
      <p class="rm-mes">${capital(nombreMes(r.mes))}</p>
      <div class="rm-datos">
        ${dato(conRegistros ? `${a.porcentaje} %` : "—", "asistencia")}
        ${dato(r.entrenamiento.sesiones > 0 ? `${formatoKg(r.entrenamiento.kg)} <small>kg</small>` : "—", "kg levantados")}
        ${dato(a.visitasConMinutos > 0 ? tiempo(a.minutos) : "—", "tiempo en el gym")}
      </div>
    </section>`;
}

function entrenamiento(r: ResumenMensual): string {
  const t = r.entrenamiento;
  if (t.sesiones === 0) return "";
  const caja = (valor: string, etiqueta: string) =>
    `<div class="rm-caja"><p class="rm-caja-num">${valor}</p><p class="rm-caja-etq">${etiqueta}</p></div>`;
  return `
    <section class="tarjeta rm-seccion">
      <h2 class="rm-titulo">Entrenamiento</h2>
      <div class="rm-cajas">
        ${caja(formatoKg(t.kg), "kg levantados")}
        ${caja(formatoKg(t.series), "series")}
        ${caja(formatoKg(t.reps), "reps")}
      </div>
      ${t.top.length ? `
        <h3 class="rm-subtitulo">Lo que más hiciste</h3>
        <ol class="rm-lista">
          ${t.top.map((e) => `<li><span>${escapar(e.nombre)}</span><span class="rm-tenue">${e.veces} ${e.veces === 1 ? "vez" : "veces"}</span></li>`).join("")}
        </ol>` : ""}
    </section>`;
}

/**
 * Verde, ámbar y rojo fijos (entrenador, 2026-10-28): ni la paleta de la clienta ni su estilo
 * cambian los colores de este calendario. Por eso no lleva las clases del de Inicio (`ok`, `just`,
 * `no`), que cada estilo repinta. Los colores, en `estilos.css`.
 */
const MARCA_CLASE = { e: "rm-e", j: "rm-j", f: "rm-f" } as const;

function calendarioDelMes(r: ResumenMensual, enCurso: boolean, hoy: string): string {
  if (Object.keys(r.asistencia.dias).length === 0) return "";
  const celdas = celdasMes(r.mes, (fecha) => {
    const marca = r.asistencia.dias[fecha.slice(8, 10)];
    const clases: string[] = marca ? [MARCA_CLASE[marca]] : [];
    if (enCurso && fecha === hoy) clases.push("hoy-celda");
    return clases;
  });
  return `
    <section class="tarjeta rm-seccion">
      <h2 class="rm-titulo">${capital(nombreMes(r.mes))}</h2>
      <div class="cal-dias"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="cal rm-cal">${celdas}</div>
      <div class="leyenda rm-leyenda">
        <span><i class="rm-punto rm-e"></i>Entrenó</span>
        <span><i class="rm-punto rm-j"></i>Justificada</span>
        <span><i class="rm-punto rm-f"></i>Falta</span>
      </div>
    </section>`;
}

function cambio(n: number | undefined): string {
  if (n === undefined) return "";
  if (Math.abs(n) < 0.005) return `<span class="rm-cambio">=</span>`;
  return n > 0
    ? `<span class="rm-cambio rm-sube" aria-label="subió ${n.toFixed(2)}">↑ ${n.toFixed(2)}</span>`
    : `<span class="rm-cambio rm-baja" aria-label="bajó ${Math.abs(n).toFixed(2)}">↓ ${Math.abs(n).toFixed(2)}</span>`;
}

function fuerza(r: ResumenMensual, sexo: "H" | "M" | null, cambios: Record<string, number> | null): string {
  if (!r.fuerza) return "";
  const s = sexo ?? "H";
  const musculos = Object.entries(r.fuerza.musculos).sort(([, a], [, b]) => b - a);
  return `
    <section class="tarjeta rm-seccion">
      <div class="rm-fila">
        <h2 class="rm-titulo">Fuerza</h2>
        ${cambios ? "" : `<span class="rm-pastilla">Primer mes con datos</span>`}
      </div>
      <p class="rm-general">Rango general: <strong>${nombreRango(r.fuerza.general, s)}</strong> <span class="rm-tenue">(${r.fuerza.general.toFixed(2)})</span></p>
      <ul class="rm-musculos">
        ${musculos.map(([g, nivel]) => `
          <li>
            <div class="rm-fila"><span>${escapar(nombreMusculo(g))}</span><span class="rm-rango">${nombreRango(nivel, s)} · ${nivel.toFixed(2)} ${cambio(cambios?.[g])}</span></div>
            <div class="rm-barra"><div style="width: ${Math.min(100, (nivel / 8) * 100).toFixed(1)}%"></div></div>
          </li>`).join("")}
      </ul>
    </section>`;
}

function marcas(r: ResumenMensual): string {
  if (r.marcas.length === 0) return "";
  const serie = (m: ResumenMensual["marcas"][number]) =>
    m.tipo === "peso" && m.peso !== null ? `${m.peso} kg × ${m.reps}` : `${m.reps} ${m.reps === 1 ? "rep" : "reps"}`;
  return `
    <section class="tarjeta rm-seccion">
      <h2 class="rm-titulo-chico">Mejores marcas</h2>
      <ul class="rm-marcas">
        ${r.marcas.map((m) => `<li><span>${escapar(m.nombre)}</span><strong>${serie(m)}</strong></li>`).join("")}
      </ul>
    </section>`;
}

export function ventanaResumenMensual(d: DatosResumenMensual): string {
  if (d.meses.length === 0 || !d.mes) {
    return `<div class="tarjeta"><p class="rm-vacio">${d.cargando ? "Cargando tus meses…" : "Todavía no hay meses que resumir."}</p></div>`;
  }
  return `
    ${selector(d)}
    ${d.enCurso ? lineaCierre(d.mes, d.hoy) : ""}
    ${d.resumen ? `
      ${portada(d.resumen, d.enCurso, d.hoy)}
      ${entrenamiento(d.resumen)}
      ${calendarioDelMes(d.resumen, d.enCurso, d.hoy)}
      ${fuerza(d.resumen, d.sexo, d.cambios)}
      ${marcas(d.resumen)}` : `<div class="tarjeta"><p class="rm-vacio">Cargando…</p></div>`}`;
}

const ES_MES = /^\d{4}-\d{2}$/;

/** El select y las flechas. Se vuelven a colgar en cada repintado (`innerHTML` tira los anteriores). */
export function conectarResumenMensual(repintar: () => void): void {
  const ir = (mes: string | undefined) => {
    if (!mes || !ES_MES.test(mes)) return;
    elegirMes(mes);
    repintar();
  };
  document.querySelector<HTMLSelectElement>("#rm-mes")?.addEventListener("change", (e) =>
    ir((e.target as HTMLSelectElement).value));
  for (const id of ["#rm-anterior", "#rm-siguiente"]) {
    document.querySelector<HTMLButtonElement>(id)?.addEventListener("click", (e) =>
      ir((e.currentTarget as HTMLButtonElement).dataset.mes));
  }
}
