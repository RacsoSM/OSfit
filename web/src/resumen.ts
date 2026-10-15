import type { EjercicioBanco, Sesion } from "./datos";
import { indiceRango, nombreMusculo, type FuerzaMusculo } from "./fuerza";
import type { Envio } from "./registro";

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
