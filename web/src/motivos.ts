/**
 * Catálogo de motivos del cambio de día (spec, "Motivos del cambio de día").
 *
 * Los dos primeros nacieron condicionales —"hoy es lunes" solo los lunes, "más de dos días
 * sin venir" solo tras la ausencia— y se quitó el filtro a petición del entrenador: el motivo
 * lo lee una persona que ya conoce a la clienta, y que alguien diga "es lunes" un miércoles
 * dice más de cómo se siente que de qué día es.
 *
 * El único condicional que queda es "Soy una perra frágil", y no depende de la fecha sino de
 * quién mira: ver `NOMBRES_CON_FRAGIL`.
 */
export interface Motivo {
  id: string;
  texto: string;
  /** Habilita el campo de texto libre. */
  libre?: boolean;
}

export const MOTIVOS: Motivo[] = [
  { id: "lunes", texto: "Hoy es lunes y quiero iniciar con algo que me guste" },
  { id: "ausencia", texto: "Tengo más de dos días sin venir y quiero iniciar con lo que yo quiera" },
  { id: "adelantar", texto: "Quiero adelantar el día" },
  { id: "reservado", texto: "La neta no te quiero decir, solo no quiero hacerlo" },
  { id: "fragil", texto: "Soy una perra frágil" },
  { id: "otro", texto: "Otro (describe el motivo)", libre: true },
];

/**
 * Las únicas clientas a las que se les ofrece "Soy una perra frágil". Es una broma entre el
 * entrenador y ellas: a quien no está en la confianza no le hace gracia, le ofende.
 *
 * Se compara contra `Cliente.nombre` porque la web no tiene a mano otra cosa —el claim trae
 * el id, pero esta lista la escribe una persona y un id no se lee—. Basta con el nombre de
 * pila: "Estela" casa con "Estela Ramírez". Los nombres compuestos de la lista ("Brianda
 * tics", "Jose Jaime") están enteros a propósito, para distinguirlos de otra Brianda o de
 * otro Jaime que no están invitados a la broma.
 */
const NOMBRES_CON_FRAGIL = ["Estela", "Dulce", "Brianda tics", "Jaime", "Carito", "Jose Jaime"];

/** Sin acentos, sin mayúsculas y sin espacios de más: el nombre lo teclea una persona. */
function normalizar(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Casa por **prefijo de palabra completa**, no por substring. "Jaime" casa con "Jaime Ruiz"
 * pero no con "Jose Jaime Ruiz", que es justo lo que permite tener a los dos en la lista sin
 * que uno se coma al otro. Un apellido que contenga el nombre de otra tampoco cuela.
 */
function leTocaFragil(nombre: string): boolean {
  const suyo = normalizar(nombre);
  return NOMBRES_CON_FRAGIL.some((listado) => {
    const n = normalizar(listado);
    return suyo === n || suyo.startsWith(`${n} `);
  });
}

/** El catálogo que le toca ver a esta clienta. */
export function motivosPara(nombre: string): Motivo[] {
  return MOTIVOS.filter((m) => m.id !== "fragil" || leTocaFragil(nombre));
}
