import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import { clienteCompararDesdeDoc, puedeSalir, type ClienteComparar } from "./comparar";
import { edadEn, factorEdad, factorPeso, pesoParaFuerza, unoRm, type Sexo } from "./fuerza";

/**
 * Batalla, en Amigos (pedido del entrenador, 2026-10-21): dos personas comparan sus mejores
 * series ejercicio por ejercicio, de un músculo, de un ejercicio o de todo lo que las dos
 * tienen en su historial. La web decide quién gana con lo que trae esta función.
 *
 * Se puede retar a quien ya se ve en Amigos (`puedeSalir`): quien se muestra a alguien acepta
 * que esa persona vea sus mejores series, pesos incluidos (decisión del entrenador,
 * 2026-10-21). Solo viajan las dos personas; de las demás, nada.
 *
 * Gana quien levanta más en proporción a su peso corporal, con los mismos ajustes del mapa
 * (`puntajeDe`): así una batalla entre un hombre y una mujer, o entre alguien de 90 kg y
 * alguien de 55 kg, es pareja.
 */

export interface EjercicioBatallaBanco {
  id: string;
  nombre: string;
  tipo: "peso" | "corporal" | "tiempo" | "cardio";
  musculos: Record<string, number>;
  estandares?: Record<Sexo, readonly number[]> | null;
  pesoPorMancuerna?: boolean;
}

export interface SesionBatalla {
  ejercicios: { ejercicioId: string; series: { reps: number; peso: number | null }[] }[];
}

/** La mejor serie de alguien en un ejercicio. GEMELO: `MarcaBatalla` de `web/src/batalla.ts`. */
export interface MarcaBatalla {
  reps: number;
  peso: number | null;
  /** 1RM estimado en kg (Epley, como el mapa); null en los que no son de peso. */
  unoRm: number | null;
  /** Con lo que se decide quién gana: más es mejor. */
  puntaje: number;
}

/** GEMELO: `EjercicioBatalla` de `web/src/batalla.ts`. */
export interface EjercicioBatalla {
  id: string;
  nombre: string;
  tipo: "peso" | "corporal" | "tiempo";
  /** Los músculos que trabaja directo (× 1 en el banco), como los que pinta en el mapa. */
  musculos: string[];
  pesoPorMancuerna: boolean;
  /** `a` es quien reta (la de la sesión); `b`, la retada. */
  a: MarcaBatalla;
  b: MarcaBatalla;
}

/** GEMELO: `DatosBatalla` de `web/src/batalla.ts`. */
export interface DatosBatalla {
  a: { nombre: string; sexo: Sexo };
  b: { nombre: string; sexo: Sexo };
  ejercicios: EjercicioBatalla[];
}

export interface Peleador {
  sexo: Sexo;
  /** `pesoParaFuerza`: su peso, corregido por grasa si la hay. */
  peso: number;
  edad: number | null;
}

/**
 * La marca de una serie, la misma que usa el mapa (1RM ÷ peso corporal × `factorPeso`, o las
 * reps), por `factorEdad`. Con estándares se divide entre el Élite de su sexo: eso empareja
 * hombres y mujeres, que tienen tablas distintas, y no se topa en 8 como el nivel, así que dos
 * Élite todavía se pueden ganar. Sin estándares queda la marca (en los de tiempo, los
 * segundos).
 */
export function puntajeDe(
  e: EjercicioBatallaBanco,
  serie: { reps: number; peso: number | null },
  p: Peleador
): number {
  if (!(serie.reps > 0)) return 0;
  let marca: number;
  if (e.tipo === "peso") {
    if (!((serie.peso ?? 0) > 0)) return 0;
    marca = (unoRm(serie.peso as number, serie.reps) / p.peso) * factorPeso(p.peso, p.sexo);
  } else {
    marca = serie.reps;
  }
  if (e.tipo !== "tiempo") marca *= factorEdad(p.edad);
  const elite = e.estandares?.[p.sexo]?.at(-1);
  return elite && elite > 0 && e.tipo !== "tiempo" ? marca / elite : marca;
}

/** Ejercicio → su mejor serie en todo su historial (el puntaje más alto). Sin cardio. */
export function mejoresPorEjercicio(
  sesiones: readonly SesionBatalla[],
  banco: ReadonlyMap<string, EjercicioBatallaBanco>,
  p: Peleador
): Map<string, MarcaBatalla> {
  const mejor = new Map<string, MarcaBatalla>();
  for (const s of sesiones) {
    for (const x of s.ejercicios ?? []) {
      const e = banco.get(x.ejercicioId);
      if (!e || e.tipo === "cardio") continue;
      for (const serie of x.series ?? []) {
        const puntaje = puntajeDe(e, serie, p);
        if (!(puntaje > 0) || puntaje <= (mejor.get(e.id)?.puntaje ?? 0)) continue;
        const rm = e.tipo === "peso" ? unoRm(serie.peso as number, serie.reps) : null;
        mejor.set(e.id, {
          reps: serie.reps,
          peso: e.tipo === "peso" ? serie.peso : null,
          unoRm: rm === null ? null : Math.round(rm * 10) / 10,
          puntaje: Math.round(puntaje * 10000) / 10000,
        });
      }
    }
  }
  return mejor;
}

/** Los ejercicios que las dos tienen, en orden alfabético. Pura para probarla. */
export function armarBatalla(
  a: { nombre: string } & Peleador,
  b: { nombre: string } & Peleador,
  sesionesA: readonly SesionBatalla[],
  sesionesB: readonly SesionBatalla[],
  banco: readonly EjercicioBatallaBanco[]
): DatosBatalla {
  const porId = new Map(banco.map((e) => [e.id, e]));
  const mejoresA = mejoresPorEjercicio(sesionesA, porId, a);
  const mejoresB = mejoresPorEjercicio(sesionesB, porId, b);
  const ejercicios: EjercicioBatalla[] = [];
  for (const [id, marcaA] of mejoresA) {
    const marcaB = mejoresB.get(id);
    if (!marcaB) continue;
    const e = porId.get(id)!;
    ejercicios.push({
      id,
      nombre: e.nombre,
      tipo: e.tipo as EjercicioBatalla["tipo"],
      musculos: Object.entries(e.musculos ?? {}).filter(([, cuanto]) => cuanto >= 1).map(([m]) => m),
      pesoPorMancuerna: e.pesoPorMancuerna === true,
      a: marcaA,
      b: marcaB,
    });
  }
  ejercicios.sort((x, y) => x.nombre.localeCompare(y.nombre, "es", { sensitivity: "base" }));
  return {
    a: { nombre: a.nombre, sexo: a.sexo },
    b: { nombre: b.nombre, sexo: b.sexo },
    ejercicios,
  };
}

function peleadorDe(c: ClienteComparar, hoy: string): Peleador {
  const sexo = c.sexo as Sexo;
  return { sexo, peso: pesoParaFuerza(c.peso as number, sexo, c.grasa), edad: edadEn(c.anioNacimiento, hoy) };
}

/**
 * Recibe el nombre de la retada, como lo muestra la lista de Amigos (que nunca manda ids). Si
 * hay dos con el mismo nombre se toma la primera que se le pueda mostrar. Lee todas las
 * sesiones de las dos: es su historial completo, no las 8 semanas del mapa.
 */
export const batallaAmigos = onCall({ region: REGION }, async (request): Promise<DatosBatalla> => {
  const yoId = await clienteDeLaSesion(request);
  const nombre = (request.data as { nombre?: unknown } | undefined)?.nombre;
  if (typeof nombre !== "string" || nombre.trim() === "" || nombre.length > 200) {
    throw new HttpsError("invalid-argument", "nombre");
  }
  const firestore = db();
  const hoy = hoyEnMazatlan();
  const [clientesSnap, bancoSnap] = await Promise.all([
    firestore.collection("clientes").get(),
    firestore.collection("ejercicios").get(),
  ]);
  const clientes = clientesSnap.docs.map((d) => clienteCompararDesdeDoc(d.id, d.data()));
  const yo = clientes.find((c) => c.id === yoId);
  if (!yo || !puedeSalir(yo, yo, yoId)) throw new HttpsError("failed-precondition", "sin_perfil");
  const rival = clientes.find((c) => c.id !== yoId && c.nombre === nombre.trim() && puedeSalir(c, yo, yoId));
  if (!rival) throw new HttpsError("not-found", "rival");
  const banco: EjercicioBatallaBanco[] = bancoSnap.docs.map((d) => ({
    id: d.id,
    nombre: typeof d.get("nombre") === "string" ? d.get("nombre") : d.id,
    tipo: d.get("tipo"),
    musculos: (d.get("musculos") ?? {}) as Record<string, number>,
    estandares: d.get("estandares") ?? null,
    pesoPorMancuerna: d.get("pesoPorMancuerna") === true,
  }));
  const sesionesDe = async (id: string): Promise<SesionBatalla[]> => {
    const snap = await firestore.collection("clientes").doc(id).collection("sesiones").get();
    return snap.docs.map((d) => ({ ejercicios: (d.get("ejercicios") ?? []) as SesionBatalla["ejercicios"] }));
  };
  const [sesionesA, sesionesB] = await Promise.all([sesionesDe(yo.id), sesionesDe(rival.id)]);
  return armarBatalla(
    { nombre: yo.nombre, ...peleadorDe(yo, hoy) },
    { nombre: rival.nombre, ...peleadorDe(rival, hoy) },
    sesionesA, sesionesB, banco
  );
});
