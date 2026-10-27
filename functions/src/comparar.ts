import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION, clienteDeLaSesion, db, hoyEnMazatlan } from "./comun";
import {
  SEMANAS_VENTANA, diasAntes, edadEn, nivelesPorMusculo, pesoParaFuerza,
  type EjercicioFuerza, type SesionFuerza, type Sexo,
} from "./fuerza";
import { bancoEnSede, factoresDesdeDoc, type Factores } from "./sede";

/**
 * "Amigos" (antes "Compararme"), en Músculos de la web: todas las clientas con algún músculo con rango, con su
 * nivel por músculo, para ver su rango general y sus cuerpos lado a lado.
 *
 * Lo calcula el servidor por lo mismo que el ranking de rachas: las reglas solo dejan que cada
 * clienta lea sus propias sesiones. Al navegador solo viaja nombre, sexo (para dibujar su
 * cuerpo) y el nivel de cada músculo: nada de pesos, series ni ids.
 *
 * Decisiones del entrenador (2026-10-14): se ven los nombres; en orden alfabético con "Tú"
 * primero, para que nadie se sienta abajo; aparece todo el que tenga al menos un músculo con
 * datos, activo o no.
 *
 * 2026-10-15 la ventana pasa a llamarse "Amigos" y cambian las llaves:
 *  - El entrenador decide quién puede entrar, desde la app (`sinAccesoAmigos`). Quien no
 *    tiene acceso ni ve la lista ni sale en ella.
 *  - Cada quien decide quién la ve (`visibilidadAmigos`, que escribe `elegirMostrarEnAmigos`):
 *    todos, solo algunas personas que ella escoge (`compartirAmigosCon`, ids de clientes) o
 *    nadie. Mientras no elija, no sale: nadie aparece sin haberlo dicho.
 *  - Quien se oculta tampoco ve a los demás (pedido del entrenador, 2026-10-15). Quien comparte
 *    con algunas ve a todos los que se muestran a ella.
 *  - El administrador (`adminAmigos`, hoy solo el perfil de Said; se pone a mano, la app ni la
 *    web lo escriben) ve a todos los que tienen datos, sin importar lo que eligieron ni el
 *    acceso (pedido del entrenador, 2026-10-16). Lo que él muestra sigue su propia elección.
 *
 * `mostrarEnAmigos` (true/false) es la versión de la primera tarde: se lee como "todos"/"nadie"
 * mientras no haya `visibilidadAmigos`.
 */

/** GEMELO: `ModoAmigos` de `web/src/datos.ts`. */
export type ModoAmigos = "todos" | "algunos" | "nadie";
const MODOS: readonly ModoAmigos[] = ["todos", "algunos", "nadie"];
const esModo = (v: unknown): v is ModoAmigos => MODOS.includes(v as ModoAmigos);

/** Lo elegido, con la versión vieja (`mostrarEnAmigos`) de respaldo; null si no ha elegido. */
export function modoAmigosDesdeDoc(d: Record<string, unknown>): ModoAmigos | null {
  if (esModo(d.visibilidadAmigos)) return d.visibilidadAmigos;
  if (d.mostrarEnAmigos === true) return "todos";
  if (d.mostrarEnAmigos === false) return "nadie";
  return null;
}

/** Alguien a quien se le pueden compartir los músculos, para la lista de "Solo a algunas". */
export interface Candidato {
  id: string;
  nombre: string;
}

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
  /** El entrenador le quitó Amigos (`sinAccesoAmigos`). */
  sinAcceso: boolean;
  activo: boolean;
  /** Administrador de Amigos: ve a todos (`adminAmigos`). */
  admin: boolean;
  /** Lo que eligió (`modoAmigosDesdeDoc`). Sin elegir cuenta como "nadie" pero se le pregunta. */
  modo: ModoAmigos | null;
  /** Con "algunos": los ids de clientes que sí la ven. */
  compartirCon: string[];
  /** Su gimnasio (`sede`, ver `sede.ts`); null = Focus Novum, sin factores. */
  sede: string | null;
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
    sinAcceso: d.sinAccesoAmigos === true,
    activo: d.activo !== false,
    admin: d.adminAmigos === true,
    modo: modoAmigosDesdeDoc(d),
    compartirCon: Array.isArray(d.compartirAmigosCon)
      ? d.compartirAmigosCon.filter((x): x is string => typeof x === "string")
      : [],
    sede: typeof d.sede === "string" && d.sede !== "" ? d.sede : null,
  };
}

/** Id de sede → sus factores, de la colección `sedes`. */
export function sedesDesdeDocs(docs: readonly { id: string; data: () => Record<string, unknown> }[]): Map<string, Factores> {
  return new Map(docs.map((d) => [d.id, factoresDesdeDoc(d.data())]));
}

/** Si quien ve (`yo`) se puede comparar con los demás: eligió mostrarse a alguien. */
export function puedeVerALosDemas(yo: ClienteComparar | undefined): boolean {
  if (yo?.admin) return true;
  return yo !== undefined && !yo.sinAcceso && (yo.modo === "todos" || yo.modo === "algunos");
}

/**
 * Quién sale en la lista de `yo`: ella misma siempre (con sexo y peso: sin ellos no hay
 * rango). Los demás, con sexo, peso y acceso, si se muestran a todos o la escogieron a ella; y
 * solo si ella también se muestra.
 */
export function puedeSalir(c: ClienteComparar, yo: ClienteComparar | undefined, yoId: string): boolean {
  if (c.sexo === null || (c.peso ?? 0) <= 0) return false;
  if (c.id === yoId) return true;
  if (yo?.admin) return true;
  if (c.sinAcceso || !puedeVerALosDemas(yo)) return false;
  return c.modo === "todos" || (c.modo === "algunos" && c.compartirCon.includes(yoId));
}

/** Con quién puede compartir: las demás clientas activas con acceso, en orden alfabético. */
export function candidatosAmigos(clientes: readonly ClienteComparar[], yoId: string): Candidato[] {
  return clientes
    .filter((c) => c.id !== yoId && c.activo && !c.sinAcceso)
    .map((c) => ({ id: c.id, nombre: c.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
}

/** La lista ya ordenada: "Tú" primero y luego alfabético. Pura para probarla. */
export function armarComparacion(
  clientes: readonly ClienteComparar[],
  sesiones: ReadonlyMap<string, readonly SesionFuerza[]>,
  banco: readonly EjercicioFuerza[],
  yoId: string,
  hoy: string,
  sedes: ReadonlyMap<string, Factores> = new Map()
): PersonaComparar[] {
  const personas: PersonaComparar[] = [];
  const yo = clientes.find((c) => c.id === yoId);
  for (const c of clientes) {
    if (!puedeSalir(c, yo, yoId)) continue;
    const sexo = c.sexo as Sexo;
    const peso = pesoParaFuerza(c.peso as number, sexo, c.grasa);
    // Cada quien contra los estándares de su gimnasio: unos kilos de Smart Fit no pesan lo que en Focus.
    const suBanco = c.sede ? bancoEnSede(banco, sedes.get(c.sede) ?? {}) : banco;
    const niveles = nivelesPorMusculo(sesiones.get(c.id) ?? [], suBanco, sexo, peso, hoy, edadEn(c.anioNacimiento, hoy));
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
export const compararMusculos = onCall({ region: REGION }, async (request): Promise<{ personas: PersonaComparar[]; candidatos: Candidato[] }> => {
  const yoId = await clienteDeLaSesion(request);
  const firestore = db();
  const hoy = hoyEnMazatlan();
  const desde = diasAntes(hoy, SEMANAS_VENTANA * 7);
  const [clientesSnap, bancoSnap, sedesSnap] = await Promise.all([
    firestore.collection("clientes").get(),
    firestore.collection("ejercicios").get(),
    firestore.collection("sedes").get(),
  ]);
  const clientes = clientesSnap.docs.map((d) => clienteCompararDesdeDoc(d.id, d.data()));
  const sedes = sedesDesdeDocs(sedesSnap.docs);
  const yo = clientes.find((c) => c.id === yoId);
  if (yo?.sinAcceso && !yo.admin) throw new HttpsError("permission-denied", "sin_acceso");
  const banco: EjercicioFuerza[] = bancoSnap.docs.map((d) => ({
    id: d.id,
    tipo: d.get("tipo"),
    musculos: (d.get("musculos") ?? {}) as Record<string, number>,
    estandares: d.get("estandares") ?? null,
    pinta: d.get("pinta") ?? null,
  }));
  const sesiones = new Map<string, SesionFuerza[]>();
  await Promise.all(clientes.filter((c) => puedeSalir(c, yo, yoId)).map(async (c) => {
    const snap = await firestore.collection("clientes").doc(c.id).collection("sesiones")
      .where("fecha", ">=", desde).get();
    sesiones.set(c.id, snap.docs.map((d) => ({
      fecha: d.get("fecha"),
      ejercicios: (d.get("ejercicios") ?? []) as SesionFuerza["ejercicios"],
    })));
  }));
  return {
    personas: armarComparacion(clientes, sesiones, banco, yoId, hoy, sedes),
    candidatos: candidatosAmigos(clientes, yoId),
  };
});

/** Cuántas personas se pueden escoger a lo más: de sobra para un gimnasio. */
export const MAX_COMPARTIR = 200;

/**
 * Lo que manda la web, ya validado. Acepta también `{ mostrar: boolean }`, lo que mandaba la
 * primera versión, por si una página vieja sigue abierta. Null si no sirve.
 */
export function eleccionValida(data: unknown): { modo: ModoAmigos; con: string[] } | null {
  const d = (data ?? {}) as { modo?: unknown; con?: unknown; mostrar?: unknown };
  if (typeof d.mostrar === "boolean" && d.modo === undefined) return { modo: d.mostrar ? "todos" : "nadie", con: [] };
  if (!esModo(d.modo)) return null;
  if (d.modo !== "algunos") return { modo: d.modo, con: [] };
  if (!Array.isArray(d.con) || d.con.length > MAX_COMPARTIR) return null;
  const con = [...new Set(d.con.filter((x): x is string => typeof x === "string" && x !== ""))];
  return con.length === 0 ? null : { modo: "algunos", con };
}

/**
 * Amigos: la clienta elige quién ve sus músculos: todos, algunas personas o nadie. Lo pregunta
 * la web la primera vez que entra y se puede cambiar desde la lista. Las personas escogidas se
 * guardan solo si son de las que puede escoger (`candidatosAmigos`).
 */
export const elegirMostrarEnAmigos = onCall({ region: REGION }, async (request) => {
  const clienteId = await clienteDeLaSesion(request);
  const eleccion = eleccionValida(request.data);
  if (eleccion === null) throw new HttpsError("invalid-argument", "eleccion_invalida");
  const firestore = db();
  const ref = firestore.collection("clientes").doc(clienteId);
  if ((await ref.get()).get("sinAccesoAmigos") === true) throw new HttpsError("permission-denied", "sin_acceso");
  let con: string[] = [];
  if (eleccion.modo === "algunos") {
    const snap = await firestore.collection("clientes").get();
    const validos = new Set(candidatosAmigos(snap.docs.map((d) => clienteCompararDesdeDoc(d.id, d.data())), clienteId).map((c) => c.id));
    con = eleccion.con.filter((id) => validos.has(id));
    if (con.length === 0) throw new HttpsError("invalid-argument", "eleccion_invalida");
  }
  await ref.update({ visibilidadAmigos: eleccion.modo, compartirAmigosCon: con, mostrarEnAmigos: eleccion.modo !== "nadie" });
  return { ok: true, modo: eleccion.modo, con };
});
