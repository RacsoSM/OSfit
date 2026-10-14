import { onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import {
  SEMANAS_VENTANA, diasAntes, edadEn, nivelesPorMusculo, pesoParaFuerza,
  type EjercicioFuerza, type SesionFuerza, type Sexo,
} from "./fuerza";

/**
 * "Compararme", en Músculos de la web: todas las clientas con algún músculo con rango, con su
 * nivel por músculo, para ver su rango general y sus cuerpos lado a lado.
 *
 * Lo calcula el servidor por lo mismo que el ranking de rachas: las reglas solo dejan que cada
 * clienta lea sus propias sesiones. Al navegador solo viaja nombre, sexo (para dibujar su
 * cuerpo) y el nivel de cada músculo: nada de pesos, series ni ids.
 *
 * Decisiones del entrenador (2026-10-14): se ven los nombres; en orden alfabético con "Tú"
 * primero, para que nadie se sienta abajo; aparece todo el que tenga al menos un músculo con
 * datos, activo o no; y se puede esconder a una clienta desde la app (`ocultarEnComparar`).
 */

export interface PersonaComparar {
  nombre: string;
  sexo: Sexo;
  esTuyo: boolean;
  /** Músculo → nivel de 0 a 8 (`web/src/fuerza.ts`). Nunca vacío. */
  niveles: Record<string, number>;
}

export interface ClienteComparar {
  id: string;
  nombre: string;
  sexo: Sexo | null;
  peso: number | null;
  grasa: number | null;
  anioNacimiento: number | null;
  ocultar: boolean;
}

export function clienteCompararDesdeDoc(id: string, d: Record<string, unknown>): ClienteComparar {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    id,
    nombre: typeof d.nombre === "string" && d.nombre.trim() !== "" ? d.nombre.trim() : "Sin nombre",
    sexo: d.sexo === "H" || d.sexo === "M" ? d.sexo : null,
    peso: num(d.peso),
    grasa: num(d.porcentajeGrasa),
    anioNacimiento: num(d.anioNacimiento),
    ocultar: d.ocultarEnComparar === true,
  };
}

/** Quién puede salir: con sexo y peso (sin ellos no hay rango), y sin esconder (salvo ella misma). */
export function puedeSalir(c: ClienteComparar, yoId: string): boolean {
  return c.sexo !== null && (c.peso ?? 0) > 0 && (!c.ocultar || c.id === yoId);
}

/** La lista ya ordenada: "Tú" primero y luego alfabético. Pura para probarla. */
export function armarComparacion(
  clientes: readonly ClienteComparar[],
  sesiones: ReadonlyMap<string, readonly SesionFuerza[]>,
  banco: readonly EjercicioFuerza[],
  yoId: string,
  hoy: string
): PersonaComparar[] {
  const personas: PersonaComparar[] = [];
  for (const c of clientes) {
    if (!puedeSalir(c, yoId)) continue;
    const sexo = c.sexo as Sexo;
    const peso = pesoParaFuerza(c.peso as number, sexo, c.grasa);
    const niveles = nivelesPorMusculo(sesiones.get(c.id) ?? [], banco, sexo, peso, hoy, edadEn(c.anioNacimiento, hoy));
    if (Object.keys(niveles).length === 0) continue;
    for (const m of Object.keys(niveles)) niveles[m] = Math.round(niveles[m] * 1000) / 1000;
    personas.push({ nombre: c.nombre, sexo, esTuyo: c.id === yoId, niveles });
  }
  return personas.sort((a, b) =>
    a.esTuyo !== b.esTuyo ? (a.esTuyo ? -1 : 1) : a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
}

/**
 * Solo lectura. Lee las clientas, el banco y las sesiones de las últimas 8 semanas de quienes
 * pueden salir: con un gimnasio son unos cientos de lecturas por vez.
 */
export const compararMusculos = onCall({ region: REGION }, async (request): Promise<{ personas: PersonaComparar[] }> => {
  const yoId = await clienteDeLaSesion(request);
  const firestore = db();
  const hoy = hoyEnMazatlan();
  const desde = diasAntes(hoy, SEMANAS_VENTANA * 7);
  const [clientesSnap, bancoSnap] = await Promise.all([
    firestore.collection("clientes").get(),
    firestore.collection("ejercicios").get(),
  ]);
  const clientes = clientesSnap.docs.map((d) => clienteCompararDesdeDoc(d.id, d.data()));
  const banco: EjercicioFuerza[] = bancoSnap.docs.map((d) => ({
    id: d.id,
    tipo: d.get("tipo"),
    musculos: (d.get("musculos") ?? {}) as Record<string, number>,
    estandares: d.get("estandares") ?? null,
  }));
  const sesiones = new Map<string, SesionFuerza[]>();
  await Promise.all(clientes.filter((c) => puedeSalir(c, yoId)).map(async (c) => {
    const snap = await firestore.collection("clientes").doc(c.id).collection("sesiones")
      .where("fecha", ">=", desde).get();
    sesiones.set(c.id, snap.docs.map((d) => ({
      fecha: d.get("fecha"),
      ejercicios: (d.get("ejercicios") ?? []) as SesionFuerza["ejercicios"],
    })));
  }));
  return { personas: armarComparacion(clientes, sesiones, banco, yoId, hoy) };
});
