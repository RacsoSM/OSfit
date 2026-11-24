import type { EjercicioBanco, Sesion } from "./datos";
import { indiceRango, nombreMusculo, unoRm, type FuerzaMusculo } from "./fuerza";
import type { EjercicioBorrador, Envio } from "./registro";
import { deKg, etiquetaUnidad, type Unidad } from "./barras";
import { comparaMarca, mejoresDe } from "./resumenMensual";

/**
 * El resumen que sale al terminar un entrenamiento, de Registro o del guiado (backlog 2):
 * cuánto duró, cuánto hizo, qué músculos trabajó y si alguno subió de rango. Sin un coach que
 * le diga "bien hecho", es lo que la anima a volver. Puro, para probarlo sin DOM; la pantalla
 * vive en `ui/registro.ts`.
 */

export interface SubidaRango {
  musculo: string;
  nombre: string;
  /** Índices en `RANGOS`: de cuál a cuál. `antes` es null si el músculo no tenía rango. */
  antes: number | null;
  despues: number;
  nivel: number;
}

export interface Resumen {
  /** null si no se sabe cuándo empezó. */
  minutos: number | null;
  ejercicios: number;
  series: number;
  /** Kilos movidos (peso × reps) en los ejercicios con peso. */
  kilos: number;
  /** Lo que trabajó, primero los principales (1) y luego los secundarios. */
  musculos: { musculo: string; nombre: string; principal: boolean }[];
  subidas: SubidaRango[];
  /** Se guardó en el teléfono, sin internet: se mandará solo. */
  enTelefono: boolean;
  guiado: boolean;
}

/** El entrenamiento recién terminado, como sesión, para volver a calcular la fuerza con él. */
export function sesionDeEnvio(envio: Envio, fecha: string, banco: readonly EjercicioBanco[]): Sesion {
  return {
    id: envio.id,
    fecha,
    origen: envio.origen ?? "manual",
    ejercicios: envio.ejercicios.map((e) => ({
      ejercicioId: e.ejercicioId,
      nombre: banco.find((b) => b.id === e.ejercicioId)?.nombre ?? e.ejercicioId,
      series: e.series,
      ...(e.biserie ? { biserie: e.biserie } : {}),
    })),
  };
}

export function armarResumen(opciones: {
  envio: Envio;
  iniciado?: number;
  terminado: number;
  banco: readonly EjercicioBanco[];
  /** La fuerza por músculo sin y con este entrenamiento; vacías si no hay sexo o peso. */
  fuerzaAntes: Record<string, FuerzaMusculo>;
  fuerzaDespues: Record<string, FuerzaMusculo>;
  enTelefono: boolean;
  guiado: boolean;
}): Resumen {
  const { envio, banco } = opciones;
  const porId = new Map(banco.map((b) => [b.id, b]));
  let series = 0;
  let kilos = 0;
  const trabajo = new Map<string, number>();
  for (const e of envio.ejercicios) {
    series += e.series.length;
    const b = porId.get(e.ejercicioId);
    // Las bajadas de un dropset también son kilos movidos (aunque no cuenten para la fuerza).
    if (b?.tipo === "peso") {
      for (const s of e.series) for (const x of [s, ...(s.caidas ?? [])]) kilos += (x.peso ?? 0) * x.reps;
    }
    for (const [musculo, cuanto] of Object.entries(b?.musculos ?? {})) {
      trabajo.set(musculo, Math.max(trabajo.get(musculo) ?? 0, cuanto));
    }
  }
  const musculos = [...trabajo]
    .sort((a, b) => b[1] - a[1])
    .map(([musculo, cuanto]) => ({ musculo, nombre: nombreMusculo(musculo), principal: cuanto >= 1 }));

  const subidas: SubidaRango[] = [];
  for (const [musculo, f] of Object.entries(opciones.fuerzaDespues)) {
    const previo = opciones.fuerzaAntes[musculo];
    const despues = indiceRango(f.nivel);
    const antes = previo ? indiceRango(previo.nivel) : null;
    if (antes === null ? despues > 0 : despues > antes) {
      subidas.push({ musculo, nombre: nombreMusculo(musculo), antes, despues, nivel: f.nivel });
    }
  }
  subidas.sort((a, b) => b.despues - a.despues);

  const minutos = typeof opciones.iniciado === "number" && opciones.terminado >= opciones.iniciado
    ? Math.round((opciones.terminado - opciones.iniciado) / 60_000)
    : null;
  return {
    minutos,
    ejercicios: envio.ejercicios.length,
    series,
    kilos: Math.round(kilos),
    musculos,
    subidas,
    enTelefono: opciones.enTelefono,
    guiado: opciones.guiado,
  };
}

// ── Los ejercicios del resumen (entrenador, 2026-11-24) ─────────────────────────

/**
 * Qué dice la pastilla de cada ejercicio: récord personal, cuánto subió o bajó contra la última
 * vez que lo hizo, igual, o nuevo si es la primera vez. Nada en el cardio.
 */
export type Etiqueta =
  | { tipo: "record" | "sube" | "baja" | "igual" | "nuevo"; texto: string }
  | null;

export interface FilaEjercicio {
  ejercicioId: string;
  nombre: string;
  gifRuta: string | null;
  /** Sus series tal como las anotó, cortas: "180×11 · 180×10". */
  series: string;
  etiqueta: Etiqueta;
}

/** "180×11 · 180×10", en la unidad en que las anotó; "12 reps" sin peso; "45 s" en las de tiempo. */
export function seriesCortas(e: EjercicioBorrador): string {
  const llenas = e.series.filter((s) => s.reps.trim() !== "" || s.peso.trim() !== "");
  return llenas.map((s) => {
    const reps = s.reps.trim() || "?";
    if (e.tipo === "tiempo") return `${reps} s`;
    if (e.tipo === "cardio") return `${reps} min`;
    const peso = s.peso.trim().replace(",", ".");
    return peso === "" || Number(peso) === 0 ? `${reps} reps` : `${peso}×${reps}`;
  }).join(" · ");
}

const numero = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

/** La diferencia con signo y unidad: "+40 lb", "−2.5 kg", "+1 barra", "+3 reps". */
function diferencia(d: number, unidad: string): Etiqueta {
  if (Math.abs(d) < 0.01) return { tipo: "igual", texto: "Igual" };
  return { tipo: d > 0 ? "sube" : "baja", texto: `${d > 0 ? "+" : "−"}${numero(Math.abs(d))} ${unidad}` };
}

export function etiquetaEjercicio(opciones: {
  ejercicioId: string;
  tipo: EjercicioBanco["tipo"];
  unidad: Unidad;
  /** Las de hoy y las de la última vez que lo hizo (null: nunca), en kg. */
  hoy: readonly { peso: number | null; reps: number }[];
  ultima: readonly { peso: number | null; reps: number }[] | null;
  /** Su mejor serie de siempre antes de hoy (la regla de las marcas). */
  mejorAntes: { peso: number | null; reps: number } | undefined;
}): Etiqueta {
  const { tipo, hoy, ultima } = opciones;
  if (tipo === "cardio" || hoy.length === 0) return null;
  if (!ultima || ultima.length === 0) return { tipo: "nuevo", texto: "Nuevo" };
  const maxPeso = (xs: readonly { peso: number | null }[]) => Math.max(0, ...xs.map((s) => s.peso ?? 0));
  const maxReps = (xs: readonly { reps: number }[]) => Math.max(0, ...xs.map((s) => s.reps));
  const conPeso = tipo === "peso" && maxPeso(hoy) > 0;
  if (tipo === "peso" || tipo === "corporal") {
    // Su mejor serie de hoy contra la mejor de siempre: con la regla de las marcas.
    const mejorHoy = hoy.reduce<{ peso: number | null; reps: number } | null>((m, s) => {
      if (!m) return s;
      const valor = (x: { peso: number | null; reps: number }) =>
        conPeso ? ((x.peso ?? 0) > 0 ? unoRm(x.peso as number, x.reps) : 0) : x.reps;
      return valor(s) > valor(m) ? s : m;
    }, null)!;
    const marca = conPeso ? { tipo: "peso" as const, peso: mejorHoy.peso, reps: mejorHoy.reps } : { tipo: "corporal" as const, peso: null, reps: mejorHoy.reps };
    if (comparaMarca(marca, opciones.mejorAntes) === "record") return { tipo: "record", texto: "Récord" };
  }
  if (conPeso && maxPeso(ultima) > 0) {
    const en = (kg: number) => deKg(kg, opciones.unidad, opciones.ejercicioId);
    const d = en(maxPeso(hoy)) - en(maxPeso(ultima));
    return diferencia(d, etiquetaUnidad(opciones.unidad, String(Math.abs(d))));
  }
  if (tipo === "tiempo") return diferencia(maxReps(hoy) - maxReps(ultima), "s");
  return diferencia(maxReps(hoy) - maxReps(ultima), "reps");
}

/**
 * Una fila por ejercicio del entrenamiento recién terminado, en su orden: su GIF, sus series y
 * su pastilla. `previas` son las sesiones de antes (de la más nueva a la más vieja), sin esta.
 */
export function filasDelResumen(
  ejercicios: readonly EjercicioBorrador[], envio: Envio, previas: readonly Sesion[], banco: readonly EjercicioBanco[],
): FilaEjercicio[] {
  const ids = envio.ejercicios.map((e) => e.ejercicioId);
  const mejores = mejoresDe(previas, banco, ids);
  const usados = new Set<number>();
  return envio.ejercicios.map((e) => {
    const i = ejercicios.findIndex((b, k) => !usados.has(k) && b.ejercicioId === e.ejercicioId);
    if (i >= 0) usados.add(i);
    const b = i >= 0 ? ejercicios[i] : undefined;
    const tipo = b?.tipo ?? banco.find((x) => x.id === e.ejercicioId)?.tipo ?? "peso";
    const ultima = previas.find((s) => s.ejercicios.some((x) => x.ejercicioId === e.ejercicioId))
      ?.ejercicios.find((x) => x.ejercicioId === e.ejercicioId)?.series ?? null;
    return {
      ejercicioId: e.ejercicioId,
      nombre: b?.nombre ?? banco.find((x) => x.id === e.ejercicioId)?.nombre ?? e.ejercicioId,
      gifRuta: b?.gifRuta ?? null,
      series: b ? seriesCortas(b) : e.series.map((s) => `${s.peso ? `${numero(s.peso)}×` : ""}${s.reps}`).join(" · "),
      etiqueta: etiquetaEjercicio({
        ejercicioId: e.ejercicioId, tipo, unidad: b?.unidad ?? "kg",
        hoy: e.series.map((s) => ({ peso: s.peso ?? null, reps: s.reps })),
        ultima: ultima ? ultima.map((s) => ({ peso: s.peso ?? null, reps: s.reps })) : null,
        mejorAntes: mejores[e.ejercicioId],
      }),
    };
  });
}
