import type { EjercicioBanco, Sesion, Sexo } from "../datos";
import {
  ejerciciosHechos, historialEjercicio, musculosHechos, nivelesMusculo, puntosEjercicio, resumenEjercicio,
  type EjercicioHecho, type ModoGrafica, type PerfilFuerza, type Punto, type ResumenEjercicio,
} from "../estadisticas";
import { RANGOS, indiceRango, nombreMusculo, nombreRango, type FuerzaMusculo } from "../fuerza";
import { claveBanco, urlGif } from "../banco";
import { escapar } from "./tarjetaDia";
import { conectarGrafica, fechaCorta, graficaLinea, lecturaGrafica, type Banda } from "./grafica";
import { COLORES_RANGO, insigniaRango } from "./insigniaRango";
import { bloqueSiguiente } from "./mapaMuscular";
import { CREDITO, medioDelEjercicio } from "./registro";

/**
 * La ventana Estadísticas (backlog 2, punto 22; ver
 * `docs/superpowers/specs/2026-10-20-estadisticas-design.md`). Diseño "A" que eligió el
 * entrenador: arriba la tarjeta de lo elegido con "Cambiar", que abre una hoja con buscador;
 * debajo los datos clave en tarjetas, la gráfica y la lista de sesiones.
 */

export interface DatosEstadisticas {
  /** Todo su historial; mientras llega, las últimas que ya hay. null si todavía no hay ninguna. */
  sesiones: readonly Sesion[] | null;
  /** Si todavía falta que llegue el historial completo. */
  cargandoHistorial: boolean;
  banco: readonly EjercicioBanco[];
  hoy: string;
  sexo: Sexo | null;
  /** Para el nivel de un músculo en el tiempo; null sin sexo o sin peso en su ficha. */
  perfil: PerfilFuerza | null;
  /** Su fuerza de hoy (la del mapa), para el rango actual de cada músculo. */
  fuerza: Readonly<Record<string, FuerzaMusculo>>;
  /** Su peso en la ficha, para "te faltan X kg" (como en Músculos). */
  peso: number | null;
}

type Elegido = { tipo: "ejercicio" | "musculo"; id: string };

/**
 * Lo elegido y lo abierto viven en el módulo, como en Registro y Músculos: la ventana se repinta
 * con cada snapshot de Firestore y no debe perder la selección.
 */
let elegido: Elegido | null = null;
let modo: ModoGrafica = "1rm";
let hojaAbierta = false;
let busqueda = "";
/** Cuántas sesiones se ven en la lista; "Ver más" suma otras tantas. */
let visibles = 10;
const DE_A = 10;

/** Para los tests: el estado del módulo sobrevive entre pruebas. */
export function reiniciarEstadisticas(): void {
  elegido = null;
  modo = "1rm";
  hojaAbierta = false;
  busqueda = "";
  visibles = DE_A;
}

const numero = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 });
const kg = (n: number) => `${numero(n)} kg`;

function dato(titulo: string, valor: string, nota: string): string {
  return `
    <div class="tarjeta estad-dato">
      <p class="tarjeta-titulo">${titulo}</p>
      <p class="estad-dato-valor">${valor}</p>
      <p class="estad-dato-nota">${nota}</p>
    </div>`;
}

function duracion(segundos: number): string {
  const m = Math.floor(segundos / 60), s = segundos % 60;
  return m === 0 ? `${s} s` : `${m} min${s ? ` ${s} s` : ""}`;
}

function datosClave(r: ResumenEjercicio): string {
  const desde = r.primera ? `desde el ${fechaCorta(r.primera)}` : "";
  const veces = dato("Veces", numero(r.veces), desde);
  const mejorFecha = r.mejor ? fechaCorta(r.mejor.fecha) : "";
  if (r.tipo === "peso" && r.unoRm !== null && r.mejor) {
    const cambio = r.cambio30 === null
      ? "tu máximo estimado"
      : r.cambio30 > 0
        ? `<span class="estad-sube">▲ ${kg(r.cambio30)}</span> en 30 días`
        : r.cambio30 < 0 ? `▼ ${kg(-r.cambio30)} en 30 días` : "igual que hace 30 días";
    return [
      dato("1RM estimado", kg(r.unoRm), cambio),
      dato("Mejor serie", `${numero(r.mejor.peso ?? 0)} × ${r.mejor.reps}`, mejorFecha),
      dato("Kg levantados", numero(r.kgTotales), "en toda tu historia"),
      veces,
      dato("Reps totales", numero(r.reps), `en ${numero(r.series)} ${r.series === 1 ? "serie" : "series"}`),
      dato("Peso máximo", kg(r.pesoMaximo ?? 0), ""),
    ].join("");
  }
  if (r.tipo === "cardio") {
    return [
      dato("Minutos totales", numero(r.reps), "en toda tu historia"),
      veces,
      dato("Sesión más larga", `${numero(r.mejor?.reps ?? 0)} min`, mejorFecha),
      dato("Velocidad máxima", r.velocidadMaxima === null ? "—" : numero(r.velocidadMaxima), r.velocidadMaxima === null ? "sin anotar" : ""),
    ].join("");
  }
  if (r.tipo === "tiempo") {
    return [
      dato("Serie más larga", duracion(r.mejor?.reps ?? 0), mejorFecha),
      veces,
      dato("Tiempo total", duracion(r.reps), "en toda tu historia"),
      dato("Series", numero(r.series), ""),
    ].join("");
  }
  return [
    dato("Más reps", numero(r.mejor?.reps ?? 0), mejorFecha ? `en una serie · ${mejorFecha}` : ""),
    veces,
    dato("Reps totales", numero(r.reps), "en toda tu historia"),
    dato("Series", numero(r.series), ""),
  ].join("");
}

function gifDe(banco: readonly EjercicioBanco[], id: string, clase: string): string {
  const url = urlGif(banco.find((b) => b.id === id)?.gifRuta);
  return url
    ? `<img class="${clase}" src="${escapar(url)}" alt="" loading="lazy" decoding="async">`
    : `<span class="${clase} estad-sin-gif" aria-hidden="true">🏋️</span>`;
}

function grupoPrincipal(banco: readonly EjercicioBanco[], id: string): string | null {
  const m = banco.find((b) => b.id === id)?.musculos ?? {};
  return Object.keys(m).find((g) => m[g] >= 1) ?? null;
}

function tarjetaElegido(d: DatosEstadisticas, e: Elegido, hechos: readonly EjercicioHecho[]): string {
  let figura: string, nombre: string, nota: string;
  if (e.tipo === "ejercicio") {
    const h = hechos.find((x) => x.id === e.id);
    const grupo = grupoPrincipal(d.banco, e.id);
    figura = gifDe(d.banco, e.id, "estad-elegido-figura");
    nombre = h?.nombre ?? e.id;
    nota = [grupo ? nombreMusculo(grupo) : null, h ? `${h.veces} ${h.veces === 1 ? "vez" : "veces"}` : null].filter(Boolean).join(" · ");
  } else {
    const f = d.fuerza[e.id];
    figura = f
      ? `<span class="estad-elegido-figura estad-insignia">${insigniaRango(indiceRango(f.nivel), 46, `estad-${e.id}`)}</span>`
      : `<span class="estad-elegido-figura estad-sin-gif" aria-hidden="true">💪</span>`;
    nombre = nombreMusculo(e.id);
    nota = f && d.sexo ? nombreRango(f.nivel, d.sexo) : "Sin rango todavía";
  }
  return `
    <button type="button" class="tarjeta estad-elegido" data-estad="cambiar" aria-haspopup="dialog">
      ${figura}
      <span class="estad-elegido-texto"><strong>${escapar(nombre)}</strong><small>${escapar(nota)}</small></span>
      <span class="estad-cambiar">Cambiar ›</span>
    </button>`;
}

function vistaEjercicio(d: DatosEstadisticas, h: EjercicioHecho, sesiones: readonly Sesion[]): string {
  const r = resumenEjercicio(sesiones, h.id, h.tipo, d.hoy);
  const conPeso = h.tipo === "peso" && r.unoRm !== null;
  const m: ModoGrafica = conPeso ? modo : "1rm";
  const puntos = puntosEjercicio(sesiones, h.id, h.tipo, m);
  const formato = conPeso && m === "1rm" ? (p: Punto) => kg(p.valor) : (p: Punto) => p.etiqueta;
  const pestanas = conPeso
    ? `<div class="estad-seg" role="group" aria-label="Qué muestra la gráfica">
        <button type="button" data-estad-modo="1rm" aria-pressed="${m === "1rm"}" class="${m === "1rm" ? "activa" : ""}">1RM</button>
        <button type="button" data-estad-modo="sesiones" aria-pressed="${m === "sesiones"}" class="${m === "sesiones" ? "activa" : ""}">Sesiones</button>
      </div>`
    : `<p class="tarjeta-titulo">${h.tipo === "cardio" ? "Tus minutos por sesión" : h.tipo === "tiempo" ? "Tu serie más larga por sesión" : "Tus reps máximas por sesión"}</p>`;
  const explicacion = conPeso
    ? `<p class="estad-nota">${m === "1rm"
      ? "Tu máximo estimado para una repetición, sacado de tu mejor serie de cada día."
      : "Tu serie más pesada de cada día, tal cual la hiciste."}</p>`
    : "";
  const historial = historialEjercicio(sesiones, h.id, h.tipo);
  const filas = historial.slice(0, visibles).map((x) => `
      <li><span class="estad-hist-fecha">${fechaCorta(x.fecha)}</span><span>${escapar(x.series.join(" · "))}</span></li>`).join("");
  const mas = historial.length > visibles
    ? `<button type="button" class="boton-texto" data-estad="mas">Ver más (${historial.length - visibles})</button>`
    : "";
  // El ejercicio en grande, como cuando se abre en Registro (entrenador, 2026-10-20).
  const delBanco = d.banco.find((b) => b.id === h.id);
  return `
    <div class="tarjeta estad-medio">
      <div class="registro-activo-gif">${medioDelEjercicio(delBanco?.gifRuta, delBanco?.videoRuta)}</div>
      ${CREDITO}
    </div>
    <div class="estad-datos">${datosClave(r)}</div>
    <div class="tarjeta">
      ${pestanas}
      ${lecturaGrafica(puntos, formato)}
      ${graficaLinea(puntos, { formato, unidad: conPeso ? "kg" : h.tipo === "cardio" ? "minutos" : h.tipo === "tiempo" ? "segundos" : "reps" })}
      ${explicacion}
    </div>
    <div class="tarjeta">
      <p class="tarjeta-titulo">Tus sesiones</p>
      <ul class="estad-hist">${filas}</ul>
      ${mas}
    </div>`;
}

/**
 * Las franjas de los rangos para la gráfica de nivel, con su color del mapa. Élite empieza en
 * el nivel máximo (8) y no tiene "hasta": se le da una franja angosta arriba para que se vea y
 * lleve su nombre.
 */
function bandas(sexo: Sexo): Banda[] {
  return RANGOS.map((r, i) => ({
    desde: r.desde,
    hasta: RANGOS[i + 1]?.desde ?? r.desde + 0.7,
    nombre: nombreRango(r.desde, sexo),
    color: COLORES_RANGO[i],
  }));
}

function vistaMusculo(d: DatosEstadisticas, grupo: string, ejercicios: readonly EjercicioHecho[], sesiones: readonly Sesion[]): string {
  const nombre = nombreMusculo(grupo);
  const f = d.fuerza[grupo];
  const cabeza = f && d.sexo
    ? `<p class="tarjeta-titulo">${escapar(nombre)}</p>
       <p class="estad-rango" style="color: ${COLORES_RANGO[indiceRango(f.nivel)]}">${escapar(nombreRango(f.nivel, d.sexo))}</p>
       ${d.peso ? bloqueSiguiente(f, d.sexo, d.peso, nombre) : ""}`
    : `<p class="tarjeta-titulo">${escapar(nombre)}</p>
       <p class="estad-nota">${d.perfil
         ? "Todavía sin rango: sus ejercicios de las últimas 8 semanas no tienen estándares de fuerza."
         : "Para ver su rango, pon tu peso en Músculos."}</p>`;
  const puntos = d.perfil ? nivelesMusculo(sesiones, d.banco, grupo, d.perfil) : [];
  const formato = (p: Punto) => numero(Math.round(p.valor * 10) / 10);
  const grafica = puntos.length > 0 && d.sexo
    ? `<div class="tarjeta">
        <p class="tarjeta-titulo">Tu nivel con el tiempo</p>
        ${lecturaGrafica(puntos, formato)}
        ${graficaLinea(puntos, { formato, bandas: bandas(d.sexo), unidad: "nivel de 0 a 8" })}
        <p class="estad-nota">Cada punto es su nivel ese día, con tu mejor marca de las 8 semanas anteriores y tu peso de hoy.</p>
      </div>`
    : "";
  const lista = ejercicios.map((h) => `
      <li><button type="button" class="estad-fila-ej" data-estad-elegir="ejercicio:${escapar(h.id)}">
        ${gifDe(d.banco, h.id, "estad-fila-gif")}
        <span><strong>${escapar(h.nombre)}</strong><small>${h.veces} ${h.veces === 1 ? "vez" : "veces"} · ${fechaCorta(h.ultima)}</small></span>
        <span aria-hidden="true">›</span>
      </button></li>`).join("");
  return `
    <div class="tarjeta">${cabeza}</div>
    ${grafica}
    <div class="tarjeta">
      <p class="tarjeta-titulo">Sus ejercicios</p>
      <ul class="estad-lista">${lista}</ul>
    </div>`;
}

/** La hoja de "Cambiar": buscador y sus ejercicios agrupados por músculo. */
function hoja(d: DatosEstadisticas, hechos: readonly EjercicioHecho[]): string {
  const musculos = musculosHechos(hechos, d.banco)
    .sort((a, b) => nombreMusculo(a.grupo).localeCompare(nombreMusculo(b.grupo), "es"));
  const conMusculo = new Set(musculos.flatMap((m) => m.ejercicios.map((e) => e.id)));
  const otros = hechos.filter((h) => !conMusculo.has(h.id));
  const fila = (h: EjercicioHecho) => `
      <li data-buscar="${escapar(claveBanco(h.nombre))}"><button type="button" class="estad-fila-ej" data-estad-elegir="ejercicio:${escapar(h.id)}">
        ${gifDe(d.banco, h.id, "estad-fila-gif")}
        <span><strong>${escapar(h.nombre)}</strong></span>
        <small>${h.veces} ${h.veces === 1 ? "vez" : "veces"}</small>
      </button></li>`;
  const grupos = musculos.map(({ grupo, ejercicios }) => {
    const f = d.fuerza[grupo];
    const pastilla = f && d.sexo
      ? `<span class="estad-pastilla" style="color: ${COLORES_RANGO[indiceRango(f.nivel)]}">${escapar(nombreRango(f.nivel, d.sexo))} ›</span>`
      : `<span class="estad-pastilla">Ver ›</span>`;
    return `
      <div class="estad-grupo" data-buscar="${escapar(claveBanco(nombreMusculo(grupo)))}">
        <button type="button" class="estad-grupo-titulo" data-estad-elegir="musculo:${escapar(grupo)}">
          <span>${escapar(nombreMusculo(grupo))}</span>${pastilla}
        </button>
        <ul class="estad-lista">${ejercicios.map(fila).join("")}</ul>
      </div>`;
  }).join("");
  const resto = otros.length > 0
    ? `<div class="estad-grupo" data-buscar="otros"><p class="estad-grupo-titulo"><span>Otros</span></p>
        <ul class="estad-lista">${otros.map(fila).join("")}</ul></div>`
    : "";
  return `
    <div class="estad-velo" data-estad="cerrar"></div>
    <section class="estad-hoja" role="dialog" aria-modal="true" aria-label="Elegir ejercicio o músculo">
      <div class="hoja-agarre" aria-hidden="true"><div class="hoja-asa"></div></div>
      <input type="search" class="estad-buscar" id="estad-buscar" placeholder="🔍  Buscar ejercicio o músculo"
             value="${escapar(busqueda)}" autocomplete="off" aria-label="Buscar ejercicio o músculo">
      <div class="estad-hoja-cuerpo">${grupos}${resto}
        <p class="estad-nota estad-sin-resultados" hidden>No encontramos nada con ese nombre.</p>
      </div>
    </section>`;
}

export function ventanaEstadisticas(d: DatosEstadisticas): string {
  if (d.sesiones === null) {
    return `<div class="estadisticas"><div class="tarjeta"><div class="mapa-cargando" role="status" aria-label="Cargando"></div></div></div>`;
  }
  const hechos = ejerciciosHechos(d.sesiones, d.banco);
  if (hechos.length === 0) {
    return `
      <div class="estadisticas">
        <div class="tarjeta vacio">
          <div class="vacio-emoji">📈</div>
          <p>Registra tu primer entrenamiento para ver tu progreso.</p>
          <button type="button" class="boton" data-estad="registro">Ir a Registro</button>
        </div>
      </div>`;
  }
  const musculos = musculosHechos(hechos, d.banco);
  const valido = elegido !== null && (elegido.tipo === "ejercicio"
    ? hechos.some((h) => h.id === elegido?.id)
    : musculos.some((m) => m.grupo === elegido?.id));
  const e: Elegido = valido && elegido ? elegido : { tipo: "ejercicio", id: hechos[0].id };
  const vista = e.tipo === "ejercicio"
    ? vistaEjercicio(d, hechos.find((h) => h.id === e.id)!, d.sesiones)
    : vistaMusculo(d, e.id, musculos.find((m) => m.grupo === e.id)?.ejercicios ?? [], d.sesiones);
  const aviso = d.cargandoHistorial
    ? `<p class="estad-nota estad-cargando-todo">Cargando todo tu historial…</p>`
    : "";
  return `
    <div class="estadisticas">
      ${tarjetaElegido(d, e, hechos)}
      ${aviso}
      ${vista}
      ${hojaAbierta ? hoja(d, hechos) : ""}
    </div>`;
}

/** Deja ver solo lo que coincide con la búsqueda: un músculo que coincide se ve con todos sus ejercicios. */
function filtrar(raiz: HTMLElement): void {
  const q = claveBanco(busqueda);
  let alguno = false;
  raiz.querySelectorAll<HTMLElement>(".estad-grupo").forEach((g) => {
    const grupoCoincide = q === "" || (g.dataset.buscar ?? "").includes(q);
    let filas = 0;
    g.querySelectorAll<HTMLElement>("li[data-buscar]").forEach((li) => {
      const ve = grupoCoincide || (li.dataset.buscar ?? "").includes(q);
      li.hidden = !ve;
      if (ve) filas++;
    });
    g.hidden = !grupoCoincide && filas === 0;
    if (!g.hidden) alguno = true;
  });
  const nada = raiz.querySelector<HTMLElement>(".estad-sin-resultados");
  if (nada) nada.hidden = alguno;
}

/**
 * Cuelga los eventos de la ventana recién pintada. Uno delegado en `#contenido`, como Registro:
 * el contenido se rehace con cada repintado.
 */
export function conectarEstadisticas(repintar: () => void, irARegistro: () => void): void {
  // `.estadisticas` y no `#contenido`: se rehace en cada repintado, así que sus escuchas no se
  // acumulan.
  const raiz = document.querySelector<HTMLElement>(".estadisticas");
  if (!raiz) return;
  conectarGrafica(raiz);
  const buscar = raiz.querySelector<HTMLInputElement>("#estad-buscar");
  if (buscar) {
    filtrar(raiz);
    buscar.addEventListener("input", () => {
      busqueda = buscar.value;
      filtrar(raiz);
    });
  }
  raiz.addEventListener("click", (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-estad], [data-estad-modo], [data-estad-elegir]");
    if (!el) return;
    if (el.dataset.estadModo === "1rm" || el.dataset.estadModo === "sesiones") {
      modo = el.dataset.estadModo;
    } else if (el.dataset.estadElegir) {
      const [tipo, id] = el.dataset.estadElegir.split(":");
      elegido = { tipo: tipo === "musculo" ? "musculo" : "ejercicio", id };
      hojaAbierta = false;
      busqueda = "";
      visibles = DE_A;
      window.scrollTo?.({ top: 0 });
    } else if (el.dataset.estad === "cambiar") {
      hojaAbierta = true;
    } else if (el.dataset.estad === "cerrar") {
      hojaAbierta = false;
    } else if (el.dataset.estad === "mas") {
      visibles += DE_A * 2;
    } else if (el.dataset.estad === "registro") {
      irARegistro();
      return;
    } else {
      return;
    }
    repintar();
  });
}
