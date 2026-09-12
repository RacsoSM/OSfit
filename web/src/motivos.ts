import type { Asistencia } from "./datos";

/**
 * Catálogo de motivos del cambio de día (spec, "Motivos del cambio de día").
 *
 * Los dos primeros son condicionales porque son afirmaciones sobre hechos: "hoy es lunes"
 * ofrecido un miércoles es absurdo, y ofrecerlo igual enseña que las opciones no significan
 * nada. Se filtran con datos que la página ya tiene: la fecha y el historial de asistencias.
 */
export interface Motivo {
  id: string;
  texto: string;
  /** Habilita el campo de texto libre. */
  libre?: boolean;
}

const CATALOGO: Motivo[] = [
  { id: "lunes", texto: "Hoy es lunes y quiero iniciar con algo que me guste" },
  { id: "ausencia", texto: "Tengo más de dos días sin venir y quiero iniciar con lo que yo quiera" },
  { id: "adelantar", texto: "Quiero adelantar el día" },
  { id: "reservado", texto: "La neta no te quiero decir, solo no quiero hacerlo" },
  { id: "fragil", texto: "Soy una perra frágil" },
  { id: "otro", texto: "Otro (describe el motivo)", libre: true },
];

/** Cuántos días hábiles hacia atrás se miran para decidir si lleva "más de dos días sin venir". */
const DIAS_HABILES_DE_AUSENCIA = 2;

function esDiaHabil(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00`).getUTCDay();
  return dia !== 0 && dia !== 6;
}

function restarUnDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function esLunes(fecha: string): boolean {
  return new Date(`${fecha}T12:00:00`).getUTCDay() === 1;
}

/**
 * Ventana de la ausencia: hoy más los 2 días **hábiles** anteriores.
 *
 * Hábiles y no naturales: el gimnasio no abre sábado ni domingo, así que un lunes el viernes
 * es "ayer". Contar días naturales haría que todos los lunes el cliente pudiera afirmar que
 * lleva más de dos días sin venir aunque hubiera venido el viernes, que es justo la mentira
 * que el filtro existe para evitar.
 *
 * Hoy entra en la ventana porque si ya vino hoy tampoco es cierto que lleve días sin venir.
 */
function ventanaDeAusencia(hoy: string): string[] {
  const ventana = [hoy];
  let fecha = restarUnDia(hoy);
  // Tope de seguridad: sin él, un dato raro colgaría la pestaña del cliente.
  for (let i = 0; i < 30 && ventana.length <= DIAS_HABILES_DE_AUSENCIA; i++) {
    if (esDiaHabil(fecha)) ventana.push(fecha);
    fecha = restarUnDia(fecha);
  }
  return ventana;
}

/**
 * Solo `asistio`: una falta justificada no es haber venido. Para la racha el soborno vale,
 * pero este motivo afirma un hecho físico — el cliente no pisó el gimnasio — y justificar
 * la falta no lo cambia.
 */
function vinoEnLaVentana(asistencias: Asistencia[], hoy: string): boolean {
  const ventana = new Set(ventanaDeAusencia(hoy));
  return asistencias.some((a) => a.asistio && ventana.has(a.fecha));
}

export function motivosDisponibles(hoy: string, asistencias: Asistencia[]): Motivo[] {
  const hayAusencia = !vinoEnLaVentana(asistencias, hoy);
  return CATALOGO.filter((m) => {
    if (m.id === "lunes") return esLunes(hoy);
    if (m.id === "ausencia") return hayAusencia;
    return true;
  });
}
