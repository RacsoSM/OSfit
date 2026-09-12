import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

export interface Ejercicio { nombre: string; series: number; repeticiones: string; pesoONota: string; }
export interface DiaRutina { nombreDia: string; ejercicios: Ejercicio[]; }
export interface Rutina { id: string; nombre: string; dias: DiaRutina[]; }

export interface Cliente {
  nombre: string;
  activo: boolean;
  rutinaAsignada: Rutina | null;
  ultimoDia: number | null;
  ultimoDiaFecha: string | null;
  ultimoDiaEsAncla: boolean;
}

export interface Asistencia {
  fecha: string;
  asistio: boolean;
  justificada: boolean;
  /**
   * La justificó el cliente desde la web. Solo estas gastan su cupo mensual.
   *
   * Opcional a propósito: Firestore omite los campos que nunca se escribieron, así que
   * toda asistencia anterior a esta etapa llega sin él. Ver el commit bf5463c.
   */
  justificadaPorCliente?: boolean;
  duracionMinutos: number | null;
}

export function observarCliente(clienteId: string, alCambiar: (c: Cliente | null) => void) {
  return onSnapshot(doc(db, "clientes", clienteId), (snap) => {
    alCambiar(snap.exists() ? (snap.data() as Cliente) : null);
  });
}

/**
 * La query filtra por clienteId porque las reglas validan documento por documento: sin el
 * filtro, Firestore rechaza la consulta entera en vez de devolver solo lo permitido.
 */
export function observarAsistencias(clienteId: string, alCambiar: (a: Asistencia[]) => void) {
  const consulta = query(collection(db, "asistencias"), where("clienteId", "==", clienteId));
  return onSnapshot(consulta, (snap) => {
    alCambiar(snap.docs.map((d) => d.data() as Asistencia));
  });
}
