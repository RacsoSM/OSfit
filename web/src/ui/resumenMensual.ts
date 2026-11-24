import { nombreMusculo, nombreRango } from "../fuerza";
import { formatoKg, nombreMes, type ResumenMensual } from "../resumenMensual";
import { celdasMes } from "./calendario";
import { escapar } from "./tarjetaDia";

/**
 * La ventana Resumen mensual, estilo "historias" (entrenador, 2026-11-24, inspirado en el
 * Wrapped de Spotify): primero pregunta qué mes quiere ver y, al elegirlo, se abre a pantalla
 * completa una historia por sección, que se pasan deslizando de lado o tocando los bordes:
 * portada, Entrenamiento, Constancia (calendario y números), Fuerza, Mejores marcas y un
 * resumen final. Una sección sin datos no tiene historia. Como antes, no dice cuántos
 * entrenamientos registró ni su día favorito (entrenador, 2026-10-28).
 *
 * Antes (2026-10-28) era una sola página con todo y un selector arriba; los cálculos no
 * cambiaron. Ver `docs/superpowers/specs/2026-10-28-resumen-mensual-design.md`.
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
 * El mes elegido, si la historia está abierta y en qué página va. Viven aquí y no en
 * `pintar()`, como el estado de Registro: un snapshot a destiempo repinta y no debe cerrar la
 * historia ni regresarla a la portada.
 */
let mesElegido: string | null = null;
let abierta = false;
let pagina = 0;
/** La historia acaba de abrirse: la portada entra con animación una sola vez. */
let recienAbierta = false;

export function elegirMes(mes: string | null): void {
  mesElegido = mes;
}

export function mesElegidoResumen(): string | null {
  return mesElegido;
}

/** Abre la historia de ese mes en su portada. */
export function abrirHistoria(mes: string): void {
  mesElegido = mes;
  abierta = true;
  pagina = 0;
  recienAbierta = true;
}

export function cerrarHistoria(): void {
  abierta = false;
  pagina = 0;
}

export function historiaAbierta(): boolean {
  return abierta;
}

/** Al salir de la ventana: la próxima vez pregunta el mes otra vez. */
export function reiniciarResumenMensual(): void {
  mesElegido = null;
  cerrarHistoria();
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** El número grande con su unidad chica: "17 h 24 min". */
function tiempo(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const min = Math.round(minutos % 60);
  if (h === 0) return `${min} <small>min</small>`;
  return min === 0 ? `${h} <small>h</small>` : `${h} h <small>${min} min</small>`;
}

// ── La lista de meses ─────────────────────────────────────────────────────────

function lista(d: DatosResumenMensual): string {
  if (d.meses.length === 0) {
    return `<div class="tarjeta"><p class="rm-vacio">${d.cargando ? "Cargando tus meses…" : "Todavía no hay meses que resumir."}</p></div>`;
  }
  const fila = (m: MesDeLista) => `
      <button type="button" class="rm-mes-opcion${m.enCurso ? " en-curso" : ""}" data-rm-mes="${m.mes}">
        <span class="rm-mes-nombre">${capital(nombreMes(m.mes))} <span class="rm-mes-anio">${m.mes.slice(0, 4)}</span></span>
        <span class="rm-mes-estado">${m.enCurso ? `En curso · al ${Number(d.hoy.slice(8, 10))}` : "Cerrado"}</span>
      </button>`;
  return `
    <p class="rm-pregunta">¿Qué mes quieres ver?</p>
    <div class="rm-meses">${d.meses.map(fila).join("")}</div>`;
}

// ── Las historias ─────────────────────────────────────────────────────────────

interface Historia { id: string; html: string }

function historia(id: string, etiqueta: string, cuerpo: string): Historia {
  return { id, html: `<p class="rh-etiqueta">${etiqueta}</p>${cuerpo}` };
}

function portada(r: ResumenMensual, enCurso: boolean, hoy: string): Historia {
  return {
    id: "portada",
    html: `
      <div class="rh-portada-c">
        <p class="rh-etiqueta">${enCurso ? `En curso · al ${Number(hoy.slice(8, 10))} de ${nombreMes(r.mes)}` : "Tu resumen del mes"}</p>
        <p class="rh-mes">${capital(nombreMes(r.mes))}</p>
        <p class="rh-anio">${r.mes.slice(0, 4)}</p>
        <p class="rh-pista">Desliza para ver tu mes <span aria-hidden="true">→</span></p>
      </div>`,
  };
}

function entrenamiento(r: ResumenMensual): Historia | null {
  const t = r.entrenamiento;
  if (t.sesiones === 0) return null;
  return historia("entrenamiento", "Entrenamiento", `
    <p class="rh-grande">${formatoKg(t.kg)} <small>kg</small></p>
    <p class="rh-sub">levantaste este mes</p>
    <div class="rh-pares">
      <div><p class="rh-num">${formatoKg(t.series)}</p><p class="rh-etq">series</p></div>
      <div><p class="rh-num">${formatoKg(t.reps)}</p><p class="rh-etq">repeticiones</p></div>
    </div>
    ${t.top.length ? `
      <p class="rh-titulo">Lo que más hiciste</p>
      <ol class="rh-lista">
        ${t.top.map((e, i) => `<li><span class="rh-pos">${i + 1}</span><span class="rh-nombre">${escapar(e.nombre)}</span><span class="rh-tenue">${e.veces} ${e.veces === 1 ? "vez" : "veces"}</span></li>`).join("")}
      </ol>` : ""}`);
}

/** Verde, ámbar y rojo fijos, como siempre en el resumen (entrenador, 2026-10-28). */
const MARCA_CLASE = { e: "rm-e", j: "rm-j", f: "rm-f" } as const;

function constancia(r: ResumenMensual, enCurso: boolean, hoy: string): Historia | null {
  const a = r.asistencia;
  if (a.entreno + a.justificadas + a.faltas === 0) return null;
  const celdas = celdasMes(r.mes, (fecha) => {
    const marca = a.dias[fecha.slice(8, 10)];
    const clases: string[] = marca ? [MARCA_CLASE[marca]] : [];
    if (enCurso && fecha === hoy) clases.push("hoy-celda");
    return clases;
  });
  return historia("constancia", "Constancia", `
    <p class="rh-grande">${a.porcentaje} <small>%</small></p>
    <p class="rh-sub">de asistencia</p>
    <div class="cal-dias rh-cal-dias"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
    <div class="cal rm-cal rh-cal">${celdas}</div>
    <div class="rh-pares rh-tres">
      <div><p class="rh-num"><i class="rm-punto rm-e"></i>${a.entreno}</p><p class="rh-etq">entrenaste</p></div>
      <div><p class="rh-num"><i class="rm-punto rm-j"></i>${a.justificadas}</p><p class="rh-etq">justificadas</p></div>
      <div><p class="rh-num"><i class="rm-punto rm-f"></i>${a.faltas}</p><p class="rh-etq">faltas</p></div>
    </div>
    <div class="rh-pares">
      <div><p class="rh-num">${a.rachaMasLarga}</p><p class="rh-etq">tu racha más larga</p></div>
      <div><p class="rh-num">${a.visitasConMinutos > 0 ? tiempo(a.minutos) : "—"}</p><p class="rh-etq">en el gym</p></div>
    </div>`);
}

function cambio(n: number | undefined): string {
  if (n === undefined) return "";
  if (Math.abs(n) < 0.005) return `<span class="rm-cambio">=</span>`;
  return n > 0
    ? `<span class="rm-cambio rm-sube" aria-label="subió ${n.toFixed(2)}">↑ ${n.toFixed(2)}</span>`
    : `<span class="rm-cambio rm-baja" aria-label="bajó ${Math.abs(n).toFixed(2)}">↓ ${Math.abs(n).toFixed(2)}</span>`;
}

function fuerza(r: ResumenMensual, sexo: "H" | "M" | null, cambios: Record<string, number> | null): Historia | null {
  if (!r.fuerza) return null;
  const s = sexo ?? "H";
  const musculos = Object.entries(r.fuerza.musculos).sort(([, a], [, b]) => b - a);
  return historia("fuerza", "Fuerza", `
    <p class="rh-sub rh-arriba">Tu rango general</p>
    <p class="rh-grande rh-rango">${nombreRango(r.fuerza.general, s)}</p>
    <p class="rh-sub">nivel ${r.fuerza.general.toFixed(2)} de 8${cambios ? "" : " · primer mes con datos"}</p>
    <ul class="rh-musculos">
      ${musculos.map(([g, nivel]) => `
        <li>
          <div class="rh-fila"><span>${escapar(nombreMusculo(g))}</span><span class="rh-tenue">${nombreRango(nivel, s)} ${cambio(cambios?.[g])}</span></div>
          <div class="rm-barra rh-barra"><div style="width: ${Math.min(100, (nivel / 8) * 100).toFixed(1)}%"></div></div>
        </li>`).join("")}
    </ul>`);
}

function marcas(r: ResumenMensual): Historia | null {
  if (r.marcas.length === 0) return null;
  const serie = (m: ResumenMensual["marcas"][number]) =>
    m.tipo === "peso" && m.peso !== null ? `${m.peso} kg × ${m.reps}` : `${m.reps} ${m.reps === 1 ? "rep" : "reps"}`;
  return historia("marcas", "Mejores marcas", `
    <p class="rh-sub rh-arriba">Lo más pesado que moviste este mes</p>
    <ol class="rh-marcas">
      ${r.marcas.map((m) => `<li><span class="rh-nombre">${escapar(m.nombre)}</span><strong>${serie(m)}</strong></li>`).join("")}
    </ol>`);
}

function final(r: ResumenMensual, sexo: "H" | "M" | null): Historia {
  const a = r.asistencia;
  const t = r.entrenamiento;
  const dato = (valor: string, etiqueta: string) =>
    `<div class="rh-dato"><p class="rh-num">${valor}</p><p class="rh-etq">${etiqueta}</p></div>`;
  const conRegistros = a.entreno + a.justificadas + a.faltas > 0;
  return {
    id: "final",
    html: `
      <p class="rh-etiqueta">Tu ${nombreMes(r.mes)} en resumen</p>
      <div class="rh-final-datos">
        ${dato(conRegistros ? `${a.porcentaje} %` : "—", "asistencia")}
        ${dato(t.sesiones > 0 ? `${formatoKg(t.kg)} <small>kg</small>` : "—", "levantados")}
        ${dato(a.visitasConMinutos > 0 ? tiempo(a.minutos) : "—", "en el gym")}
        ${dato(t.sesiones > 0 ? formatoKg(t.series) : "—", "series")}
        ${dato(r.fuerza ? nombreRango(r.fuerza.general, sexo ?? "H") : "—", "rango general")}
        ${dato(String(a.rachaMasLarga), "racha más larga")}
      </div>
      ${t.top[0] ? `<p class="rh-nota">Tu ejercicio del mes: <strong>${escapar(t.top[0].nombre)}</strong></p>` : ""}
      <div class="rh-botones">
        <button type="button" class="boton" data-rh="otra-vez">Ver otra vez</button>
        <button type="button" class="boton secundario" data-rh="cerrar">Cerrar</button>
      </div>`,
  };
}

/** Las historias del mes, en orden, sin las secciones vacías. */
export function historiasDelMes(d: Pick<DatosResumenMensual, "resumen" | "enCurso" | "hoy" | "sexo" | "cambios">): Historia[] {
  const r = d.resumen;
  if (!r) return [];
  return [
    portada(r, d.enCurso, d.hoy),
    entrenamiento(r),
    constancia(r, d.enCurso, d.hoy),
    fuerza(r, d.sexo, d.cambios),
    marcas(r),
    final(r, d.sexo),
  ].filter((h): h is Historia => h !== null);
}

const CERRAR = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

function visor(d: DatosResumenMensual): string {
  const historias = historiasDelMes(d);
  if (historias.length === 0) {
    return `<div class="rh-visor" role="dialog" aria-modal="true" aria-label="Resumen del mes">
      <button type="button" class="rh-cerrar" data-rh="cerrar" aria-label="Cerrar">${CERRAR}</button>
      <div class="rh-vacia"><p>Cargando…</p></div></div>`;
  }
  pagina = Math.min(pagina, historias.length - 1);
  const entrada = recienAbierta ? " entrando" : "";
  recienAbierta = false;
  const barras = historias.map((_, i) =>
    `<span class="${i < pagina ? "vista" : i === pagina ? "actual" : ""}"></span>`).join("");
  return `
    <div class="rh-visor${entrada}" role="dialog" aria-modal="true"
         aria-label="Resumen de ${nombreMes(d.mes ?? "")} ${(d.mes ?? "").slice(0, 4)}, ${pagina + 1} de ${historias.length}">
      <div class="rh-progreso" aria-hidden="true">${barras}</div>
      <div class="rh-cabeza">
        <span>${capital(nombreMes(d.mes ?? ""))} ${(d.mes ?? "").slice(0, 4)}</span>
        <button type="button" class="rh-cerrar" data-rh="cerrar" aria-label="Cerrar">${CERRAR}</button>
      </div>
      <div class="rh-carril" style="transform: translateX(${-pagina * 100}%)">
        ${historias.map((h, i) => `
          <section class="rh-pagina rh-${h.id}" aria-hidden="${i !== pagina}">
            <div class="rh-contenido">${h.html}</div>
          </section>`).join("")}
      </div>
    </div>`;
}

export function ventanaResumenMensual(d: DatosResumenMensual): string {
  return `${lista(d)}${abierta && d.mes ? visor(d) : ""}`;
}

// ── Conexión ──────────────────────────────────────────────────────────────────

const ES_MES = /^\d{4}-\d{2}$/;

/** Dónde le dice `main.ts` a la navegación que se abrió o cerró la historia ("atrás" la cierra). */
export interface NavegacionHistoria {
  alAbrir: () => void;
  alCerrar: () => void;
}

/**
 * La lista, los botones y el deslizar de la historia. Se vuelven a colgar en cada repintado
 * (`innerHTML` tira los anteriores).
 */
export function conectarResumenMensual(repintar: () => void, nav: NavegacionHistoria): void {
  document.body.classList.toggle("historia-abierta", abierta);
  document.querySelectorAll<HTMLElement>("[data-rm-mes]").forEach((b) =>
    b.addEventListener("click", () => {
      const mes = b.dataset.rmMes;
      if (!mes || !ES_MES.test(mes)) return;
      abrirHistoria(mes);
      nav.alAbrir();
      repintar();
    })
  );

  const visorEl = document.querySelector<HTMLElement>(".rh-visor");
  if (!visorEl) return;
  const carril = visorEl.querySelector<HTMLElement>(".rh-carril");
  const total = visorEl.querySelectorAll(".rh-pagina").length;

  // Cambiar de historia mueve el carril en su lugar, sin repintar: así se ve deslizarse. Un
  // repintado posterior (un snapshot) ya sale en la página nueva.
  const ir = (nueva: number) => {
    pagina = Math.max(0, Math.min(total - 1, nueva));
    if (carril) carril.style.transform = `translateX(${-pagina * 100}%)`;
    visorEl.querySelectorAll<HTMLElement>(".rh-progreso span").forEach((b, i) => {
      b.className = i < pagina ? "vista" : i === pagina ? "actual" : "";
    });
    visorEl.querySelectorAll<HTMLElement>(".rh-pagina").forEach((p, i) => p.setAttribute("aria-hidden", String(i !== pagina)));
  };
  const cerrar = () => {
    cerrarHistoria();
    document.body.classList.remove("historia-abierta");
    nav.alCerrar();
    repintar();
  };

  visorEl.querySelectorAll<HTMLElement>("[data-rh]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (b.dataset.rh === "cerrar") cerrar();
      if (b.dataset.rh === "otra-vez") ir(0);
    })
  );

  // Deslizar de lado para cambiar de historia; un toque en el tercio izquierdo regresa y en el
  // resto avanza, como en las historias de Instagram. El scroll vertical (una historia larga
  // en un teléfono chico) no se toca.
  let x0 = 0, y0 = 0, arrastrando = false, horizontal: boolean | null = null;
  visorEl.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    x0 = e.clientX; y0 = e.clientY; arrastrando = true; horizontal = null;
  });
  visorEl.addEventListener("pointermove", (e) => {
    if (!arrastrando || !carril) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (horizontal === null && Math.hypot(dx, dy) > 8) horizontal = Math.abs(dx) > Math.abs(dy);
    if (horizontal) {
      carril.classList.add("arrastrando");
      carril.style.transform = `translateX(calc(${-pagina * 100}% + ${dx}px))`;
    }
  });
  const soltar = (e: PointerEvent) => {
    if (!arrastrando) return;
    arrastrando = false;
    carril?.classList.remove("arrastrando");
    const dx = e.clientX - x0;
    if (horizontal) {
      if (dx < -50) ir(pagina + 1);
      else if (dx > 50) ir(pagina - 1);
      else ir(pagina);
      return;
    }
    if (horizontal === null) {
      const caja = visorEl.getBoundingClientRect();
      ir(e.clientX - caja.left < caja.width / 3 ? pagina - 1 : pagina + 1);
    }
  };
  visorEl.addEventListener("pointerup", soltar);
  visorEl.addEventListener("pointercancel", () => { arrastrando = false; carril?.classList.remove("arrastrando"); ir(pagina); });
  visorEl.onkeydown = (e) => {
    if (e.key === "ArrowRight") ir(pagina + 1);
    if (e.key === "ArrowLeft") ir(pagina - 1);
    if (e.key === "Escape") cerrar();
  };
  visorEl.tabIndex = -1;
  if (document.activeElement === document.body) visorEl.focus({ preventScroll: true });
}
