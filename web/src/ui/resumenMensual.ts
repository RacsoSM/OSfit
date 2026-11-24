import { RANGOS, indiceRango, nombreMusculo, nombreRango, percentilEntrenanDe } from "../fuerza";
import { COLORES_RANGO } from "./insigniaRango";
import { comparaMarca, formatoKg, nombreMes, type ResumenMensual, type SerieMarca } from "../resumenMensual";
import { prepararSvg } from "./mapaMuscular";
import { escapar } from "./tarjetaDia";
import { lluviaDeConfeti, rafagaDeConfeti } from "./confeti";
import { decidirDeslizamiento } from "./deslizarRegistro";
import { compartirPoster, posterComoArchivo, sinEtiquetas, type Cambio, type DatosPoster } from "./posterImagen";

/**
 * La ventana Resumen mensual, estilo "historias" (entrenador, 2026-11-24, inspirado en el
 * Wrapped de Spotify): primero pregunta qué mes quiere ver y, al elegirlo, se abre a pantalla
 * completa una historia por sección, que se pasan deslizando de lado o tocando los bordes:
 * portada, Entrenamiento, Constancia, Fuerza, Mejores marcas y un resumen final. Una sección
 * sin datos no tiene historia. Como antes, no dice cuántos entrenamientos registró ni su día
 * favorito (entrenador, 2026-10-28).
 *
 * **Paleta y estilo fijos** (entrenador, 2026-11-24): el resumen se ve igual con cualquier
 * estilo o paleta de la clienta. Por eso todo lleva clases propias (`rh-`), nunca `.tarjeta`,
 * `.boton` ni `.cal`, que cada estilo repinta; los colores viven en `.rh-fijo` (`estilos.css`).
 * La paleta es la de referencia de la guía de visualización (validada para daltonismo sobre
 * la superficie oscura): azul para las cantidades y verde/ámbar/rojo de estado para
 * entrenó/justificada/falta, siempre con su texto al lado.
 *
 * Las gráficas son HTML (barras con `div`): cada una lleva sus números escritos y un
 * `aria-label` con los datos, porque tocar la pantalla cambia de historia y no hay "pasar el
 * dedo" para ver un valor.
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
  /** Kilos de cada semana del mes (`kgPorSemana`); null sin entrenamientos. */
  semanas?: readonly { desde: number; hasta: number; kg: number }[] | null;
  /** Su mejor serie de cada ejercicio antes del mes (`mejoresAntes`); null mientras llega el historial. */
  previas?: Readonly<Record<string, SerieMarca>> | null;
  /**
   * El resumen del mes inmediato anterior, para el "+X % vs septiembre"; null si ese mes no
   * tiene registro, si el elegido está en curso (medio mes contra uno completo engaña) o si el
   * anterior en la lista no es el mes de justo antes.
   */
  anterior?: ResumenMensual | null;
  /** Su nombre, para el póster de la historia final. */
  nombre?: string;
  /** Los SVG del mapa del cuerpo de su sexo; null mientras llegan o sin sexo. */
  mapa?: { frente: string; espalda: string } | null;
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
/**
 * Cuándo empezó el espectáculo de la historia final (`performance.now()`), o null si todavía no
 * llega a ella. Vive aquí porque un snapshot repinta el visor a media función: con esto el
 * espectáculo sigue donde iba en vez de empezar de nuevo.
 */
let escenaInicio: number | null = null;

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
  escenaInicio = null;
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
const corto = (mes: string) => nombreMes(mes).slice(0, 3);

/** El número grande con su unidad chica: "17 h 24 min". */
function tiempo(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const min = Math.round(minutos % 60);
  if (h === 0) return `${min} <small>min</small>`;
  return min === 0 ? `${h} <small>h</small>` : `${h} h <small>${min} min</small>`;
}


const pct = (v: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0).toFixed(1);

// ── La lista de meses ─────────────────────────────────────────────────────────

function lista(d: DatosResumenMensual): string {
  if (d.meses.length === 0) {
    return `<div class="rh-fijo rh-lista-meses"><p class="rh-vacio-lista">${d.cargando ? "Cargando tus meses…" : "Todavía no hay meses que resumir."}</p></div>`;
  }
  const fila = (m: MesDeLista) => `
      <button type="button" class="rm-mes-opcion${m.enCurso ? " en-curso" : ""}" data-rm-mes="${m.mes}">
        <span class="rm-mes-nombre">${capital(nombreMes(m.mes))} <span class="rm-mes-anio">${m.mes.slice(0, 4)}</span></span>
        <span class="rm-mes-estado">${m.enCurso ? `En curso · al ${Number(d.hoy.slice(8, 10))}` : "Cerrado"}</span>
        <span class="rm-mes-ir" aria-hidden="true">›</span>
      </button>`;
  return `
    <div class="rh-fijo rh-lista-meses">
      <p class="rm-pregunta">¿Qué mes quieres ver?</p>
      <div class="rm-meses">${d.meses.map(fila).join("")}</div>
    </div>`;
}

// ── Contra el mes anterior ───────────────────────────────────────────────────

/**
 * Cuánto cambió contra el mes anterior, redondeado: en % del valor anterior (`relativo`) o en
 * puntos (`puntos`, para la asistencia, que ya es un %). null sin dato anterior con qué comparar.
 */
export function variacion(actual: number, previo: number | null | undefined, modo: "relativo" | "puntos"): number | null {
  if (previo === null || previo === undefined || !Number.isFinite(previo)) return null;
  if (modo === "puntos") return Math.round(actual - previo);
  if (previo <= 0) return null;
  return Math.round(((actual - previo) / previo) * 100);
}

/** La pastilla "↑ +12 % vs septiembre"; nada sin dato. */
function vs(n: number | null, mesPrevio: string | null): string {
  if (n === null || !mesPrevio) return "";
  const mes = nombreMes(mesPrevio);
  if (n === 0) return `<span class="rh-vs igual">= igual que ${mes}</span>`;
  return n > 0
    ? `<span class="rh-vs sube">↑ +${n} % vs ${mes}</span>`
    : `<span class="rh-vs baja">↓ −${Math.abs(n)} % vs ${mes}</span>`;
}

// ── Gráficas ──────────────────────────────────────────────────────────────────

/** Barras verticales: kilos por semana. La más alta lleva el acento; todas, su número. */
function graficaSemanas(mes: string, semanas: readonly { desde: number; hasta: number; kg: number }[]): string {
  if (semanas.length === 0 || semanas.every((s) => s.kg === 0)) return "";
  const max = Math.max(...semanas.map((s) => s.kg));
  const etiqueta = (s: { desde: number; hasta: number }) => (s.desde === s.hasta ? `${s.desde}` : `${s.desde}–${s.hasta}`);
  const resumen = semanas.map((s) => `del ${s.desde} al ${s.hasta}: ${formatoKg(s.kg)} kg`).join("; ");
  return `
    <figure class="rh-grafica" role="img" aria-label="Kilos por semana de ${nombreMes(mes)}: ${resumen}">
      <figcaption class="rh-grafica-titulo">Kilos por semana</figcaption>
      <div class="rh-columnas">
        ${semanas.map((s) => `
          <div class="rh-columna">
            <span class="rh-columna-valor">${s.kg > 0 ? formatoKg(s.kg) : ""}</span>
            <div class="rh-columna-barra${s.kg === max ? " max" : ""}" style="height: ${pct(s.kg, max)}%"></div>
            <span class="rh-columna-eje">${etiqueta(s)} ${corto(mes)}</span>
          </div>`).join("")}
      </div>
    </figure>`;
}

/** Barras horizontales con el nombre arriba y el número a la derecha. */
function barrasHorizontales(
  titulo: string,
  filas: readonly { nombre: string; valor: number; texto: string; nota?: string }[],
  max: number,
  marcasEje: readonly { en: number; texto: string }[] = []
): string {
  const resumen = filas.map((f) => `${f.nombre}: ${f.texto}`).join("; ");
  return `
    <figure class="rh-grafica" role="img" aria-label="${titulo ? `${escapar(titulo)}: ` : ""}${escapar(resumen)}">
      ${titulo ? `<figcaption class="rh-grafica-titulo">${escapar(titulo)}</figcaption>` : ""}
      ${marcasEje.length ? `<div class="rh-eje">${marcasEje.map((m) => `<span style="left: ${pct(m.en, max)}%">${m.texto}</span>`).join("")}</div>` : ""}
      <ul class="rh-barras">
        ${filas.map((f) => `
          <li>
            <div class="rh-barras-texto"><span class="rh-barras-nombre">${escapar(f.nombre)}</span><span class="rh-barras-valor">${f.texto}${f.nota ?? ""}</span></div>
            <div class="rh-barras-pista">
              ${marcasEje.map((m) => `<i class="rh-guia" style="left: ${pct(m.en, max)}%"></i>`).join("")}
              <div class="rh-barras-relleno" style="width: ${pct(f.valor, max)}%"></div>
            </div>
          </li>`).join("")}
      </ul>
    </figure>`;
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

function entrenamiento(r: ResumenMensual, semanas: DatosResumenMensual["semanas"], ant: ResumenMensual | null): Historia | null {
  const t = r.entrenamiento;
  if (t.sesiones === 0) return null;
  const p = ant && ant.entrenamiento.sesiones > 0 ? ant.entrenamiento : null;
  const mp = p ? ant!.mes : null;
  const maxVeces = Math.max(1, ...t.top.map((e) => e.veces));
  return historia("entrenamiento", "Entrenamiento", `
    <p class="rh-grande">${formatoKg(t.kg)} <small>kg</small></p>
    <p class="rh-sub">levantaste este mes ${vs(variacion(t.kg, p?.kg, "relativo"), mp)}</p>
    ${semanas ? graficaSemanas(r.mes, semanas) : ""}
    <div class="rh-pares">
      <div><p class="rh-num">${formatoKg(t.series)}</p><p class="rh-etq">series</p>${vs(variacion(t.series, p?.series, "relativo"), mp)}</div>
      <div><p class="rh-num">${formatoKg(t.reps)}</p><p class="rh-etq">repeticiones</p>${vs(variacion(t.reps, p?.reps, "relativo"), mp)}</div>
    </div>
    ${t.top.length ? barrasHorizontales("Lo que más hiciste",
      t.top.map((e) => ({ nombre: e.nombre, valor: e.veces, texto: `${e.veces} ${e.veces === 1 ? "vez" : "veces"}` })), maxVeces) : ""}`);
}

/** Entrenó, justificada y falta: los tres colores de estado, siempre con su nombre. */
const ESTADOS = [
  { clave: "e", clase: "rh-e", nombre: "Entrenó" },
  { clave: "j", clase: "rh-j", nombre: "Justificada" },
  { clave: "f", clase: "rh-f", nombre: "Falta" },
] as const;

function constancia(r: ResumenMensual, enCurso: boolean, hoy: string, ant: ResumenMensual | null): Historia | null {
  const a = r.asistencia;
  const total = a.entreno + a.justificadas + a.faltas;
  if (total === 0) return null;
  const pa = ant ? ant.asistencia : null;
  const conPrevio = pa && pa.entreno + pa.justificadas + pa.faltas > 0 ? pa : null;
  const mp = conPrevio ? ant!.mes : null;
  const cuenta = { e: a.entreno, j: a.justificadas, f: a.faltas };
  // Barra de proporción con hueco de 2 px entre tramos; solo los tramos con algo.
  const tramos = ESTADOS.filter((s) => cuenta[s.clave] > 0)
    .map((s) => `<div class="rh-tramo ${s.clase}" style="flex: ${cuenta[s.clave]}"></div>`).join("");
  const leyenda = ESTADOS.map((s) =>
    `<li><i class="rh-punto ${s.clase}"></i><span>${s.nombre}</span><strong>${cuenta[s.clave]}</strong></li>`).join("");

  // El calendario, armado aquí (no con `.cal`, que cada estilo repinta). Lunes primero.
  const [anio, m] = r.mes.split("-").map(Number);
  const dias = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const hueco = (new Date(Date.UTC(anio, m - 1, 1)).getUTCDay() + 6) % 7;
  const celdas = [
    ...Array.from({ length: hueco }, () => `<span class="rh-dia vacio"></span>`),
    ...Array.from({ length: dias }, (_, i) => {
      const dd = String(i + 1).padStart(2, "0");
      const marca = a.dias[dd];
      const clase = marca ? ESTADOS.find((s) => s.clave === marca)!.clase : "";
      const esHoy = enCurso && `${r.mes}-${dd}` === hoy;
      return `<span class="rh-dia ${clase}${esHoy ? " hoy" : ""}">${i + 1}</span>`;
    }),
  ].join("");

  return historia("constancia", "Constancia", `
    <p class="rh-grande">${a.porcentaje} <small>%</small></p>
    <p class="rh-sub">de asistencia ${vs(variacion(a.porcentaje, conPrevio?.porcentaje, "puntos"), mp)}</p>
    <figure class="rh-grafica" role="img"
            aria-label="Entrenó ${a.entreno}, justificadas ${a.justificadas}, faltas ${a.faltas}">
      <div class="rh-proporcion">${tramos}</div>
      <ul class="rh-leyenda">${leyenda}</ul>
    </figure>
    <div class="rh-semana" aria-hidden="true"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
    <div class="rh-calendario" aria-label="Calendario de ${nombreMes(r.mes)}">${celdas}</div>
    <div class="rh-pares">
      <div><p class="rh-num">${a.rachaMasLarga}</p><p class="rh-etq">tu racha más larga</p>${vs(variacion(a.rachaMasLarga, conPrevio?.rachaMasLarga, "relativo"), mp)}</div>
      <div><p class="rh-num">${a.visitasConMinutos > 0 ? tiempo(a.minutos) : "—"}</p><p class="rh-etq">en el gym</p>${a.visitasConMinutos > 0 && conPrevio && conPrevio.visitasConMinutos > 0 ? vs(variacion(a.minutos, conPrevio.minutos, "relativo"), mp) : ""}</div>
    </div>`);
}

/**
 * El color de cada músculo: el de su rango, el mismo del apartado Músculos (`COLORES_RANGO`,
 * "hielo → fuego"), no un tono de la paleta del resumen (entrenador, 2026-11-24). Son colores
 * fijos: no cambian con el estilo de la clienta.
 */
export const colorNivel = (nivel: number) => COLORES_RANGO[indiceRango(nivel)];

/** El mapa de frente o espalda con cada músculo de su tono; sin datos, gris (lo pone el CSS). */
function cuerpoPintado(svg: string, prefijo: string, musculos: Readonly<Record<string, number>>): string {
  return prepararSvg(svg, prefijo).replace(/class="musculo" data-musculo="([^"]+)"/g, (todo, g: string) =>
    musculos[g] === undefined ? todo : `${todo} style="fill: ${colorNivel(musculos[g])}"`);
}

/**
 * Fuerza (propuesta "A · Tu cuerpo pintado", entrenador 2026-11-24): el rango general, contra
 * quiénes entrenan, su cuerpo de frente y de espalda pintado por nivel y su músculo más fuerte.
 */
function fuerza(r: ResumenMensual, sexo: "H" | "M" | null, mapa: DatosResumenMensual["mapa"], ant: ResumenMensual | null): Historia | null {
  if (!r.fuerza) return null;
  const s = sexo ?? "H";
  const musculos = Object.entries(r.fuerza.musculos).sort(([, a], [, b]) => b - a);
  const fuertes = musculos.slice(0, 3);
  const resumen = musculos.map(([g, n]) => `${nombreMusculo(g)}: ${nombreRango(n, s)}`).join("; ");
  return historia("fuerza", "Fuerza", `
    <p class="rh-sub rh-arriba">Tu rango general</p>
    <p class="rh-grande rh-rango">${nombreRango(r.fuerza.general, s)}</p>
    <p class="rh-sub">Más fuerte que el ${percentilEntrenanDe(r.fuerza.general)} % de quienes entrenan</p>
    ${ant?.fuerza ? `<p class="rh-sub rh-vs-linea">Tu nivel general ${vs(variacion(r.fuerza.general, ant.fuerza.general, "relativo"), ant.mes)}</p>` : ""}
    ${mapa ? `
      <figure class="rh-mapa" role="img" aria-label="Tu cuerpo por nivel de fuerza. ${escapar(resumen)}">
        ${cuerpoPintado(mapa.frente, "rh-frente", r.fuerza.musculos)}
        ${cuerpoPintado(mapa.espalda, "rh-espalda", r.fuerza.musculos)}
      </figure>
      <ul class="rh-rangos" aria-label="Los rangos, de menor a mayor">
        ${RANGOS.map((rg, k) => `<li><i style="background: ${COLORES_RANGO[k]}"></i>${nombreRango(rg.desde, s)}</li>`).join("")}
      </ul>` : `
      <div class="rh-mapa-cargando">Cargando tu cuerpo…</div>`}
    ${fuertes.length ? `
      <div class="rh-destacado">
        <p class="rh-etq">${fuertes.length === 1 ? "Tu músculo más fuerte" : "Tus músculos más fuertes"}</p>
        <ol class="rh-fuertes">
          ${fuertes.map(([g, n], k) => `
            <li><span class="rh-fuertes-pos">${k + 1}</span><i style="background: ${colorNivel(n)}"></i>
              <span class="rh-fuertes-nombre">${escapar(nombreMusculo(g))}</span><span class="rh-fuertes-rango">${nombreRango(n, s)}</span></li>`).join("")}
        </ol>
      </div>` : ""}`);
}

/**
 * Mejores marcas (propuesta "B · Récords personales", entrenador 2026-11-24): cuántos récords
 * personales rompió y cada marca contra su mejor serie de antes de este mes, en todo su
 * historial. Mientras llega el historial (`previas` null) se ven las marcas sin comparar.
 */
function marcas(r: ResumenMensual, previas: DatosResumenMensual["previas"]): Historia | null {
  if (r.marcas.length === 0) return null;
  const serie = (m: { peso: number | null; reps: number }, tipo: "peso" | "corporal") =>
    tipo === "peso" && m.peso !== null ? `${m.peso} <small>kg × ${m.reps}</small>` : `${m.reps} <small>${m.reps === 1 ? "rep" : "reps"}</small>`;
  const plano = (m: { peso: number | null; reps: number }, tipo: "peso" | "corporal") => serie(m, tipo).replace(/<\/?small>/g, "");
  const estados = r.marcas.map((m) => (previas ? comparaMarca(m, previas[m.ejercicioId]) : null));
  const records = estados.filter((e) => e === "record").length;
  const tarjeta = (m: ResumenMensual["marcas"][number], i: number) => {
    const e = estados[i];
    const antes = previas?.[m.ejercicioId];
    const insignia = e === "record" ? `<span class="rh-insignia">Récord</span>`
      : e === "igual" ? `<span class="rh-insignia borde">Igualaste</span>`
      : e === "primera" ? `<span class="rh-insignia borde">Primera vez</span>` : "";
    const linea = e === "record" && antes ? `Antes: ${plano(antes, m.tipo)}`
      : e === "igual" ? "Igual que tu mejor marca"
      : e === "debajo" && antes ? `Tu mejor: ${plano(antes, m.tipo)}`
      : e === "primera" ? "Tu primera marca en este ejercicio" : "";
    return `
      <li class="rh-marca${e === "record" ? " record" : ""}">
        <div class="rh-marca-cabeza"><span class="rh-marca-nombre">${escapar(m.nombre)}</span>${insignia}</div>
        <p class="rh-marca-num">${serie(m, m.tipo)}</p>
        ${linea ? `<p class="rh-marca-antes">${linea}</p>` : ""}
      </li>`;
  };
  const encabezado = records > 0
    ? `<p class="rh-sub rh-arriba">Este mes rompiste</p>
       <p class="rh-grande">${records} <small>${records === 1 ? "récord personal" : "récords personales"}</small></p>`
    : `<p class="rh-sub rh-arriba">Tus mejores series del mes</p>`;
  return historia("marcas", "Mejores marcas", `
    ${encabezado}
    <ol class="rh-marcas-lista">${r.marcas.map(tarjeta).join("")}</ol>`);
}

// ── El espectáculo de la historia final ──────────────────────────────────────

/**
 * Los tiempos del espectáculo, en segundos (entrenador, 2026-11-24: "un espectáculo de luces
 * destapando cada card"; luego: "que la luz se enfoque en cada card y unos dos segundos después
 * la siguiente"). Escenario a oscuras; en cada turno los dos reflectores giran hasta cruzarse
 * sobre la tarjeta, la sala se oscurece alrededor y deja un círculo de luz sobre ella, que se
 * voltea, su número corre desde cero, suelta chispas y muestra su comparación; las demás quedan
 * en penumbra. Al final: destello, se encienden las luces, un brillo cruza todas las
 * tarjetas, ráfaga de confeti y aparecen el ejercicio del mes y los botones. Los mismos números
 * están en `estilos.css` (`--rh-intro`, `--rh-paso`, `--rh-remate`): si cambian aquí, allá.
 */
export const ESCENA = { intro: 1.0, paso: 2.0, voltear: 0.35, contar: 0.9, apuntar: 0.7, remate: 12.6, total: 14.0 } as const;

/** Cuándo se voltea la tarjeta `i`. */
const turno = (i: number) => ESCENA.intro + i * ESCENA.paso;

type Formato = "pct" | "kg" | "tiempo" | "entero";
function formatear(n: number, f: Formato): string {
  if (f === "pct") return `${Math.round(n)} %`;
  if (f === "kg") return `${formatoKg(n)} <small>kg</small>`;
  if (f === "tiempo") return tiempo(n);
  return formatoKg(n);
}

/** Los colores de las rayitas de los 4 números del póster (los de los rangos). */
const COLOR_NUMERO = ["#3b8fff", "#9d4edd", "#e0457b", "#ffb703"];

/**
 * Lo que dice el póster, para la pantalla y para la imagen que se comparte (`posterImagen.ts`).
 * Los cambios solo contra el mes de justo antes y si ese mes tiene el dato, como en las demás
 * historias.
 */
export function datosPoster(r: ResumenMensual, sexo: "H" | "M" | null, ant: ResumenMensual | null, nombre: string): DatosPoster {
  const a = r.asistencia;
  const t = r.entrenamiento;
  const s = sexo ?? "H";
  const pa = ant && ant.asistencia.entreno + ant.asistencia.justificadas + ant.asistencia.faltas > 0 ? ant.asistencia : null;
  const pt = ant && ant.entrenamiento.sesiones > 0 ? ant.entrenamiento : null;
  const cambio = (n: number | null): Cambio | null => (n === null || !ant ? null : { n, mes: ant.mes });
  const conRegistros = a.entreno + a.justificadas + a.faltas > 0;
  return {
    mes: r.mes,
    nombre,
    rango: r.fuerza ? {
      nombre: nombreRango(r.fuerza.general, s),
      color: colorNivel(r.fuerza.general),
      percentil: percentilEntrenanDe(r.fuerza.general),
      cambio: ant?.fuerza ? cambio(variacion(r.fuerza.general, ant.fuerza.general, "relativo")) : null,
    } : null,
    numeros: [
      { valor: conRegistros ? `${a.porcentaje} %` : "—", etiqueta: "asistencia",
        cambio: conRegistros && pa ? cambio(variacion(a.porcentaje, pa.porcentaje, "puntos")) : null },
      { valor: t.sesiones > 0 ? `${formatoKg(t.kg)} kg` : "—", etiqueta: "levantados",
        cambio: t.sesiones > 0 && pt ? cambio(variacion(t.kg, pt.kg, "relativo")) : null },
      { valor: a.visitasConMinutos > 0 ? sinEtiquetas(tiempo(a.minutos)) : "—", etiqueta: "en el gym",
        cambio: a.visitasConMinutos > 0 && pa && pa.visitasConMinutos > 0 ? cambio(variacion(a.minutos, pa.minutos, "relativo")) : null },
      { valor: `${a.rachaMasLarga} ${a.rachaMasLarga === 1 ? "día" : "días"}`, etiqueta: "racha más larga",
        cambio: pa ? cambio(variacion(a.rachaMasLarga, pa.rachaMasLarga, "relativo")) : null },
    ].map((n, i) => ({ ...n, color: COLOR_NUMERO[i] })),
    ejercicios: t.top.map((e) => e.nombre),
    musculos: r.fuerza
      // Top 5 en el póster (entrenador, 2026-11-24); la historia de Fuerza sigue con su top 3.
      ? Object.entries(r.fuerza.musculos).sort(([, x], [, y]) => y - x).slice(0, 5)
        .map(([g, n]) => ({ nombre: nombreMusculo(g), color: colorNivel(n) }))
      : [],
  };
}

/** El póster que está en pantalla, para que "Compartir" lo dibuje como imagen. */
let posterEnPantalla: DatosPoster | null = null;

/**
 * La historia final: el póster del mes a toda la pantalla (diseño "A1 · S1", entrenador
 * 2026-11-24), con el marco de los colores de los rangos. Arriba el mes y su nombre; luego su
 * rango, los 4 números en una cuadrícula con aire, sus ejercicios y músculos, y "Compartir" (la
 * imagen del póster) y "Cerrar". El espectáculo de luces destapa sus 6 partes una por una: el
 * rango, los 4 números y las listas (`rh-dato`, con `--i`).
 */
function final(r: ResumenMensual, sexo: "H" | "M" | null, ant: ResumenMensual | null, nombre: string): Historia {
  const p = datosPoster(r, sexo, ant, nombre);
  posterEnPantalla = p;
  const a = r.asistencia;
  const t = r.entrenamiento;
  const chispas = Array.from({ length: 10 }, (_, k) => `<span style="--a: ${k * 36}deg"></span>`).join("");
  const pastilla = (c: Cambio | null) => (c ? vs(c.n, c.mes) : "");
  // Cada parte tiene dos caras: el dorso con "?" y su nombre, y el frente. Un número que se puede
  // contar lleva `data-contar` y `data-formato`.
  const parte = (i: number, clase: string, dorso: string, frente: string) => `
    <div class="rh-dato ${clase}" style="--i: ${i}">
      <div class="rh-dato-dorso" aria-hidden="true"><span class="rh-dorso-signo">?</span><span class="rh-dorso-etq">${dorso}</span></div>
      <div class="rh-dato-frente">${frente}</div>
      <i class="rh-chispas" aria-hidden="true">${chispas}</i>
    </div>`;
  const contar: ({ n: number; f: Formato } | null)[] = [
    a.entreno + a.justificadas + a.faltas > 0 ? { n: a.porcentaje, f: "pct" } : null,
    t.sesiones > 0 ? { n: t.kg, f: "kg" } : null,
    a.visitasConMinutos > 0 ? { n: a.minutos, f: "tiempo" } : null,
    null,
  ];
  const valorHtml = [
    p.numeros[0].valor,
    t.sesiones > 0 ? formatear(t.kg, "kg") : "—",
    a.visitasConMinutos > 0 ? tiempo(a.minutos) : "—",
    p.numeros[3].valor.replace(/ (días?)$/, " <small>$1</small>"),
  ];
  return {
    id: "final",
    html: `
      <div class="rh-escenario" aria-hidden="true">
        <i class="rh-oscuro"></i><i class="rh-haz izq"></i><i class="rh-haz der"></i><i class="rh-flash"></i>
      </div>
      <div class="rh-poster">
        <p class="rh-poster-mes">${nombreMes(r.mes).toUpperCase()} ${r.mes.slice(0, 4)} · OSFIT</p>
        <p class="rh-poster-nombre">${escapar(nombre)}</p>
        ${parte(0, "rh-poster-rango", "tu rango", p.rango ? `
          <i class="rh-medalla" style="--color: ${p.rango.color}"></i>
          <div>
            <p class="rh-poster-rango-nombre">${p.rango.nombre}</p>
            <p class="rh-poster-rango-texto">Más fuerte que el ${p.rango.percentil} % de quienes entrenan ${pastilla(p.rango.cambio)}</p>
          </div>` : `<div><p class="rh-poster-rango-nombre">—</p><p class="rh-poster-rango-texto">Registra tus entrenamientos para tener rango</p></div>`)}
        <div class="rh-final-datos">
          ${p.numeros.map((n, i) => parte(i + 1, "rh-poster-numero", n.etiqueta, `
            <i class="rh-raya" style="background: ${n.color}"></i>
            <p class="rh-num"${contar[i] ? ` data-contar="${contar[i]!.n}" data-formato="${contar[i]!.f}"` : ""}>${valorHtml[i]}</p>
            <p class="rh-etq">${n.etiqueta}</p>${pastilla(n.cambio)}`)).join("")}
        </div>
        ${parte(5, "rh-poster-listas", "tus favoritos", `
          ${p.ejercicios.length ? `<div><p class="rh-poster-tt">Tus ejercicios</p>
            <ol class="rh-poster-lista">${p.ejercicios.map((e, i) => `<li><b>${i + 1}</b>${escapar(e)}</li>`).join("")}</ol></div>` : ""}
          ${p.musculos.length ? `<div><p class="rh-poster-tt">Tus músculos</p>
            <ol class="rh-poster-lista">${p.musculos.map((m) => `<li><i style="background: ${m.color}"></i>${escapar(m.nombre)}</li>`).join("")}</ol></div>` : ""}`)}
        <p class="rh-compartir-aviso" id="rh-compartir-aviso" role="status"></p>
        <div class="rh-botones">
          <button type="button" class="rh-boton" data-rh="compartir">Compartir</button>
          <button type="button" class="rh-boton secundario" data-rh="cerrar">Cerrar</button>
        </div>
      </div>`,
  };
}

/** Los relojes del espectáculo en curso: se cancelan antes de volver a armarlo. */
let relojes: number[] = [];

function quietoPorPreferencia(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Pone en escena la historia final, `transcurrido` segundos después de que empezó (0 al llegar;
 * más si un repintado la rehízo a media función). El movimiento lo hace el CSS con
 * `animation-delay` corridos por `--desfase`; aquí solo los números que corren desde cero y la
 * ráfaga del remate.
 */
function ponerEnEscena(seccion: HTMLElement, transcurrido: number): void {
  for (const r of relojes) { clearTimeout(r); cancelAnimationFrame(r); }
  relojes = [];
  seccion.style.setProperty("--desfase", `${-transcurrido}s`);
  // Quitar y volver a poner la clase reinicia las animaciones; con el desfase, siguen donde iban.
  seccion.classList.remove("en-escena");
  void seccion.offsetWidth;
  seccion.classList.add("en-escena");
  const terminado = transcurrido >= ESCENA.total || quietoPorPreferencia();
  seccion.classList.toggle("terminado", terminado);

  seccion.querySelectorAll<HTMLElement>("[data-contar]").forEach((el) => {
    const n = Number(el.dataset.contar);
    const f = el.dataset.formato as Formato;
    const i = Number(el.closest<HTMLElement>(".rh-dato")?.style.getPropertyValue("--i") || 0);
    const desde = turno(i) + ESCENA.voltear - transcurrido;
    if (terminado || desde + ESCENA.contar <= 0) { el.innerHTML = formatear(n, f); return; }
    el.innerHTML = formatear(0, f);
    relojes.push(window.setTimeout(() => {
      const inicio = performance.now() + Math.min(0, desde) * 1000;
      const correr = (ahora: number) => {
        const p = Math.min(1, (ahora - inicio) / (ESCENA.contar * 1000));
        const suave = 1 - Math.pow(1 - p, 3);
        el.innerHTML = formatear(p >= 1 ? n : n * suave, f);
        if (p < 1) relojes.push(requestAnimationFrame(correr));
      };
      relojes.push(requestAnimationFrame(correr));
    }, Math.max(0, desde) * 1000));
  });

  apuntarReflectores(seccion, transcurrido, terminado);

  const remate = ESCENA.remate - transcurrido;
  if (!terminado && remate > 0) relojes.push(window.setTimeout(() => rafagaDeConfeti(110, 0.5, 0.45), remate * 1000));
  // Al acabar queda "terminado": los botones (invisibles hasta el remate) ya reciben toques.
  if (!terminado) relojes.push(window.setTimeout(() => seccion.classList.add("terminado"), (ESCENA.total - transcurrido) * 1000));
}

/**
 * Los reflectores y el círculo de luz siguen a la tarjeta de turno: un poco antes de que se
 * voltee (`apuntar`) giran hasta cruzarse sobre ella y el foco se mueve ahí. En el remate se
 * sueltan (`.libre`) y vuelven a barrer el escenario.
 */
function apuntarReflectores(seccion: HTMLElement, transcurrido: number, terminado: boolean): void {
  const datos = [...seccion.querySelectorAll<HTMLElement>(".rh-dato")];
  const hazes = [...seccion.querySelectorAll<HTMLElement>(".rh-haz")];
  const soltar = () => {
    seccion.classList.add("libre");
    hazes.forEach((h) => { h.style.height = ""; });
    datos.forEach((d) => d.classList.remove("foco"));
  };
  if (terminado || transcurrido >= ESCENA.remate) { soltar(); return; }
  seccion.classList.remove("libre");

  // El ángulo con que un reflector, girando sobre el centro de su base, apunta al centro de la
  // tarjeta. Con la posición sin transformar (`offset*`), que no cambia al girarlo.
  const apuntar = (i: number) => {
    const d = datos[i];
    if (!d) return;
    // Las dos cajas en el mismo instante: el carril puede ir deslizándose, y así se cancela.
    const caja = seccion.getBoundingClientRect();
    const r = d.getBoundingClientRect();
    const x = r.left + r.width / 2 - caja.left;
    const y = r.top + r.height / 2 - caja.top + seccion.scrollTop;
    for (const h of hazes) {
      const px = h.offsetLeft + h.offsetWidth / 2;
      const py = h.offsetTop + h.offsetHeight;
      const grados = (Math.atan2(x - px, py - y) * 180) / Math.PI;
      h.style.transform = `rotate(${grados.toFixed(1)}deg)`;
      // Que el haz termine justo pasando la tarjeta: la luz "cae" ahí y no sigue de largo.
      h.style.height = `${Math.round(Math.hypot(x - px, py - y) + 70)}px`;
    }
    seccion.style.setProperty("--fx", `${x.toFixed(0)}px`);
    seccion.style.setProperty("--fy", `${y.toFixed(0)}px`);
    datos.forEach((dd, k) => dd.classList.toggle("foco", k === i));
  };

  // La tarjeta que ya estaba en foco (si se retoma a media función) y las que siguen.
  datos.forEach((_, i) => {
    const cuando = turno(i) - ESCENA.apuntar - transcurrido;
    const siguiente = i + 1 < datos.length ? turno(i + 1) - ESCENA.apuntar - transcurrido : ESCENA.remate - transcurrido;
    if (siguiente <= 0) return;
    if (cuando <= 0) apuntar(i);
    else relojes.push(window.setTimeout(() => apuntar(i), cuando * 1000));
  });
  relojes.push(window.setTimeout(soltar, (ESCENA.remate - transcurrido) * 1000));
}

/** Llega (o vuelve) a la historia final: arranca el espectáculo o lo retoma donde iba. */
function escenaFinal(visorEl: HTMLElement, total: number): void {
  const seccion = visorEl.querySelector<HTMLElement>(".rh-pagina.rh-final");
  if (!seccion || pagina !== total - 1) return;
  if (escenaInicio === null) escenaInicio = performance.now();
  ponerEnEscena(seccion, (performance.now() - escenaInicio) / 1000);
}

/** La imagen del póster de cada mes, dibujada una vez. */
const imagenes = new Map<string, Promise<File>>();
function imagenDe(p: DatosPoster): Promise<File> | null {
  if (typeof document === "undefined" || typeof HTMLCanvasElement === "undefined") return null;
  const llave = JSON.stringify(p);
  if (!imagenes.has(llave)) {
    const promesa = posterComoArchivo(p);
    promesa.catch(() => imagenes.delete(llave));
    imagenes.set(llave, promesa);
  }
  return imagenes.get(llave)!;
}

/** Tocar a media función la salta al final. */
function saltarEscena(visorEl: HTMLElement): boolean {
  const seccion = visorEl.querySelector<HTMLElement>(".rh-pagina.rh-final.en-escena:not(.terminado)");
  if (!seccion || escenaInicio === null) return false;
  escenaInicio = performance.now() - ESCENA.total * 1000;
  ponerEnEscena(seccion, ESCENA.total);
  return true;
}

/** Las historias del mes, en orden, sin las secciones vacías. */
export function historiasDelMes(
  d: Pick<DatosResumenMensual, "resumen" | "enCurso" | "hoy" | "sexo" | "cambios" | "semanas" | "previas" | "mapa" | "anterior" | "nombre">
): Historia[] {
  const r = d.resumen;
  if (!r) return [];
  const ant = d.anterior ?? null;
  return [
    portada(r, d.enCurso, d.hoy),
    entrenamiento(r, d.semanas ?? null, ant),
    constancia(r, d.enCurso, d.hoy, ant),
    fuerza(r, d.sexo, d.mapa ?? null, ant),
    marcas(r, d.previas ?? null),
    final(r, d.sexo, ant, d.nombre ?? ""),
  ].filter((h): h is Historia => h !== null);
}

const CERRAR = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

function visor(d: DatosResumenMensual): string {
  const historias = historiasDelMes(d);
  if (historias.length === 0) {
    return `<div class="rh-fijo rh-visor" role="dialog" aria-modal="true" aria-label="Resumen del mes">
      <button type="button" class="rh-cerrar" data-rh="cerrar" aria-label="Cerrar">${CERRAR}</button>
      <div class="rh-vacia"><p>Cargando…</p></div></div>`;
  }
  pagina = Math.min(pagina, historias.length - 1);
  const entrada = recienAbierta ? " entrando" : "";
  recienAbierta = false;
  const barras = historias.map((_, i) =>
    `<span class="${i < pagina ? "vista" : i === pagina ? "actual" : ""}"></span>`).join("");
  return `
    <div class="rh-fijo rh-visor${entrada}" role="dialog" aria-modal="true"
         aria-label="Resumen de ${nombreMes(d.mes ?? "")} ${(d.mes ?? "").slice(0, 4)}, ${pagina + 1} de ${historias.length}">
      <canvas class="rh-confeti" aria-hidden="true"></canvas>
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
  lluviaDeConfeti(visorEl?.querySelector<HTMLCanvasElement>(".rh-confeti") ?? null);
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
    visorEl.classList.toggle("en-final", pagina === total - 1);
    escenaFinal(visorEl, total);
  };
  // "Compartir": la imagen del póster por el menú del teléfono, o descargada. Se prepara en cuanto
  // se ve el póster: en iPhone, compartir tiene que salir del toque mismo y no después de esperar
  // a que se dibuje.
  const poster = posterEnPantalla;
  const imagen = poster ? imagenDe(poster) : null;
  const compartir = async (boton: HTMLButtonElement) => {
    if (!poster || !imagen) return;
    const aviso = visorEl.querySelector<HTMLElement>("#rh-compartir-aviso");
    boton.disabled = true;
    try {
      const resultado = await compartirPoster(await imagen, poster.mes);
      if (aviso) aviso.textContent = resultado === "descargado" ? "Listo: la imagen se guardó en tu teléfono." : "";
    } catch {
      if (aviso) aviso.textContent = "No se pudo crear la imagen. Inténtalo otra vez.";
    } finally {
      boton.disabled = false;
    }
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
      if (b.dataset.rh === "compartir") void compartir(b as HTMLButtonElement);
    })
  );

  // Deslizar de lado para cambiar de historia; un toque en el tercio izquierdo regresa y en el
  // resto avanza, como en las historias de Instagram. El scroll vertical (una historia larga
  // en un teléfono chico) no se toca.
  let x0 = 0, y0 = 0, t0 = 0, arrastrando = false, horizontal: boolean | null = null;
  // Que el navegador no arrastre el SVG del cuerpo ni texto: cancelaría el gesto.
  visorEl.addEventListener("dragstart", (e) => e.preventDefault());
  visorEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); arrastrando = true; horizontal = null;
    try { visorEl.setPointerCapture(e.pointerId); } catch { /* sin captura también funciona */ }
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
      // La misma regla que Registro: lo bastante largo, o un movimiento rápido.
      const hacia = decidirDeslizamiento(dx, e.clientY - y0, performance.now() - t0);
      ir(hacia === "siguiente" ? pagina + 1 : hacia === "anterior" ? pagina - 1 : pagina);
      return;
    }
    if (horizontal === null) {
      if (pagina === total - 1 && saltarEscena(visorEl)) return;
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
  // Un repintado a media función (un snapshot) la retoma donde iba.
  visorEl.classList.toggle("en-final", pagina === total - 1);
  escenaFinal(visorEl, total);
  visorEl.tabIndex = -1;
  if (document.activeElement === document.body) visorEl.focus({ preventScroll: true });
}
