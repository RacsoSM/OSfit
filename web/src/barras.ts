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

export type Unidad = "kg" | "barras";

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
]);

/** En qué unidad abre el ejercicio en Registro. */
export function unidadPorDefecto(ejercicioId: string): Unidad {
  return MAQUINAS_DE_BARRAS.has(ejercicioId) ? "barras" : "kg";
}

/** Barras → kg, redondeado a décimas para no guardar 22.500000000000004. */
export function barrasAKg(barras: number): number {
  return Math.round(barras * KG_POR_BARRA * 10) / 10;
}

/** Kg → barras, a la barra más cercana (lo que se puede poner en la máquina). */
export function kgABarras(kg: number): number {
  return Math.round(kg / KG_POR_BARRA);
}
