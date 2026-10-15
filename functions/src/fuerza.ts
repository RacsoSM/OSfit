/**
 * El nivel de fuerza por músculo, del lado del servidor: lo usa `compararMusculos` para
 * calcular el de todas las clientas, porque cada una solo puede leer sus propias sesiones.
 *
 * GEMELO de `web/src/fuerza.ts` (de `unoRm` a `fuerzaPorMusculo`, sin el detalle de `origen`
 * que solo usa la hoja del músculo). `fuerza.test.ts` corre los dos sobre los mismos datos y
 * falla si dejan de dar lo mismo: si cambias uno, cambia el otro.
 */

export type Sexo = "H" | "M";

export interface EjercicioFuerza {
  id: string;
  tipo: "peso" | "corporal" | "tiempo";
  musculos: Record<string, number>;
  estandares?: Record<Sexo, readonly number[]> | null;
}

export interface SesionFuerza {
  fecha: string;
  ejercicios: { ejercicioId: string; series: { reps: number; peso: number | null }[] }[];
}

export const SEMANAS_VENTANA = 8;
const REPS_TOPE_EPLEY = 12;

export function unoRm(peso: number, reps: number): number {
  if (reps <= 1) return peso;
  return peso * (1 + Math.min(reps, REPS_TOPE_EPLEY) / 30);
}

export function nivelDe(marca: number, estandares: readonly number[]): number {
  if (!(marca > 0) || estandares.length === 0) return 0;
  const e = estandares;
  if (marca < e[0]) return marca / e[0];
  for (let i = 0; i < e.length - 1; i++) {
    if (marca < e[i + 1]) return i + 1 + (marca - e[i]) / (e[i + 1] - e[i]);
  }
  return e.length;
}

const TABLA_EDAD: readonly (readonly [number, number])[] = [
  [14, 1.23], [16, 1.13], [18, 1.06], [20, 1.02], [23, 1], [40, 1],
  [45, 1.05], [50, 1.13], [55, 1.21], [60, 1.31], [65, 1.43], [70, 1.56], [75, 1.7], [80, 1.85],
];

export function factorEdad(edad: number | null | undefined): number {
  if (typeof edad !== "number" || !Number.isFinite(edad)) return 1;
  const t = TABLA_EDAD;
  if (edad <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    const [e1, f1] = t[i];
    if (edad <= e1) {
      const [e0, f0] = t[i - 1];
      return Math.round((f0 + ((edad - e0) / (e1 - e0)) * (f1 - f0)) * 1000) / 1000;
    }
  }
  return t[t.length - 1][1];
}

export function edadEn(anioNacimiento: number | null | undefined, hoy: string): number | null {
  if (typeof anioNacimiento !== "number" || !Number.isInteger(anioNacimiento)) return null;
  const edad = Number(hoy.slice(0, 4)) - anioNacimiento;
  return edad >= 10 && edad <= 100 ? edad : null;
}

const PESO_REFERENCIA: Readonly<Record<Sexo, number>> = { H: 75, M: 60 };
const FACTOR_PESO_MIN = 0.85;
const FACTOR_PESO_MAX = 1.25;

export function factorPeso(pesoCorporal: number, sexo: Sexo): number {
  if (!(pesoCorporal > 0)) return 1;
  const f = Math.cbrt(pesoCorporal / PESO_REFERENCIA[sexo]);
  return Math.min(FACTOR_PESO_MAX, Math.max(FACTOR_PESO_MIN, f));
}

const GRASA_REFERENCIA: Readonly<Record<Sexo, number>> = { H: 20, M: 28 };

export function pesoParaFuerza(peso: number, sexo: Sexo, grasa: number | null | undefined): number {
  if (typeof grasa !== "number" || !(grasa >= 3 && grasa <= 60)) return peso;
  return (peso * (1 - grasa / 100)) / (1 - GRASA_REFERENCIA[sexo] / 100);
}

export function diasAntes(hoy: string, dias: number): string {
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Músculo → nivel (0 a 8). Mismas reglas que la web: ver su comentario. */
export function nivelesPorMusculo(
  sesiones: readonly SesionFuerza[],
  banco: readonly EjercicioFuerza[],
  sexo: Sexo,
  pesoCorporal: number,
  hoy: string,
  edad: number | null = null
): Record<string, number> {
  if (!(pesoCorporal > 0)) return {};
  const factor = factorEdad(edad);
  const porPeso = factorPeso(pesoCorporal, sexo);
  const desde = diasAntes(hoy, SEMANAS_VENTANA * 7);
  const porId = new Map(banco.map((e) => [e.id, e]));

  const mejor = new Map<string, number>();
  for (const s of sesiones) {
    if (s.fecha < desde || s.fecha > hoy) continue;
    for (const e of s.ejercicios) {
      const b = porId.get(e.ejercicioId);
      if (!b || !b.estandares || b.tipo === "tiempo") continue;
      for (const serie of e.series) {
        const marca = factor * (b.tipo === "peso"
          ? (serie.peso ?? 0) > 0 ? (unoRm(serie.peso as number, serie.reps) / pesoCorporal) * porPeso : 0
          : serie.reps);
        if (marca > (mejor.get(b.id) ?? 0)) mejor.set(b.id, marca);
      }
    }
  }

  const fuerza: Record<string, number> = {};
  for (const [id, marca] of mejor) {
    const b = porId.get(id)!;
    const nivel = nivelDe(marca, b.estandares![sexo]);
    for (const [musculo, cuanto] of Object.entries(b.musculos)) {
      // Solo el trabajo directo pinta (× 1 en el banco); un secundario no cuenta de rebote.
      if (cuanto < 1) continue;
      if (nivel > (fuerza[musculo] ?? -1)) fuerza[musculo] = nivel;
    }
  }
  return fuerza;
}
