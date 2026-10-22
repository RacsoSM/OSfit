/**
 * Las "barras" de las máquinas de placas: la pila de placas con su perno. En el gimnasio a
 * muchas se les despintó el número, así que en estas máquinas la clienta anota cuántas barras
 * puso y aquí se convierte a kg al guardar. La sesión siempre se guarda en kg: el mapa de
 * fuerza, el historial y la función `registrarSesion` no saben de barras.
 *
 * Pedido del entrenador, 2026-10-13.
 */

/**
 * Cuánto pesa una barra (kg). 4.5 kg = placa de 10 lb, lo más común en máquinas comerciales
 * (muchas europeas traen de 5 kg). Lo fijó el entrenador el 2026-10-13 "de momento", mientras
 * lo confirma en su gimnasio. Si cambia, este es el único número que hay que tocar, pero las
 * sesiones ya guardadas quedan en kg calculados con el valor anterior.
 */
export const KG_POR_BARRA = 4.5;

/**
 * En qué se anota el peso en Registro. "lb" solo con "Registrar en libras" prendido en Ajustes
 * (entrenador, 2026-10-22): entonces el selector ofrece libras en vez de kg. Como las barras,
 * las libras se convierten a kg al guardar; en todo lo demás se ve en kg.
 */
export type Unidad = "kg" | "lb" | "barras";
/** La unidad del peso libre (no de placas): kg, o lb si así lo pidió. */
export type UnidadLibre = "kg" | "lb";

/** Una libra en kg, la definición exacta. */
export const KG_POR_LB = 0.45359237;

/**
 * Los ejercicios del banco que se hacen en máquina de placas (o en polea, que cuelga de la
 * misma pila). Ahí Registro abre en barras; en todo lo demás, en kg. Fuera a propósito:
 * prensa de 45° (la "Prensa en máquina" horizontal sí es de placas), sentadilla hack, Smith
 * y elevación de talones sentado, que casi siempre son de discos; y dominadas asistidas,
 * donde la pila resta peso en vez de sumarlo.
 */
const MAQUINAS_DE_BARRAS: ReadonlySet<string> = new Set([
  "cruce-poleas",
  "pec-deck",
  "prensa-horizontal-una-pierna",
  "prensa-maquina",
  "extension-cuadriceps",
  "curl-femoral-acostado",
  "curl-femoral-sentado",
  "abductores-maquina",
  "aductores-maquina",
  "patada-gluteo-polea",
  "jalon-al-pecho",
  "jalon-agarre-abierto",
  "jalon-triangulo",
  "jalon-supino",
  "pullover-polea",
  "remo-sentado-polea",
  "remo-maquina",
  "elevaciones-laterales-polea",
  "face-pull",
  "curl-predicador-maquina",
  "curl-polea",
  "curl-inverso-polea",
  "curl-muneca-polea",
  "extension-triceps-polea",
  "extension-triceps-cuerda",
  "extension-triceps-trasnuca-polea",
  "crunch-polea",
  "crunch-maquina",
  "fondos-maquina",
]);

/** En qué unidad abre el ejercicio en Registro: barras en las de placas, si no la que prefiere. */
export function unidadPorDefecto(ejercicioId: string, libre: UnidadLibre = "kg"): Unidad {
  return MAQUINAS_DE_BARRAS.has(ejercicioId) ? "barras" : libre;
}

/** Barras → kg, redondeado a décimas para no guardar 22.500000000000004. */
export function barrasAKg(barras: number): number {
  return Math.round(barras * KG_POR_BARRA * 10) / 10;
}

/** Kg → barras, a la barra más cercana (lo que se puede poner en la máquina). */
export function kgABarras(kg: number): number {
  return Math.round(kg / KG_POR_BARRA);
}

/** Libras → kg, a décimas como las barras: 45 lb son 20.4 kg. */
export function lbAKg(lb: number): number {
  return Math.round(lb * KG_POR_LB * 10) / 10;
}

/** Kg → libras, a la media libra (los discos en libras van de 2.5 en 2.5): 20.4 kg son 45 lb. */
export function kgALb(kg: number): number {
  return Math.round((kg / KG_POR_LB) * 2) / 2;
}

/** Lo anotado en esa unidad, en kg: lo que se guarda. */
export function aKg(n: number, unidad: Unidad): number {
  return unidad === "barras" ? barrasAKg(n) : unidad === "lb" ? lbAKg(n) : n;
}

/** Kg a lo que se ve en esa unidad (al cambiar el selector). */
export function deKg(kg: number, unidad: Unidad): number {
  return unidad === "barras" ? kgABarras(kg) : unidad === "lb" ? kgALb(kg) : kg;
}

/** El nombre corto de la unidad junto al número: "kg", "lb", "barras" (o "barra"). */
export function etiquetaUnidad(unidad: Unidad, cuantas?: string): string {
  if (unidad === "barras") return cuantas === "1" ? "barra" : "barras";
  return unidad;
}
