import type { Ejercicio } from "./datos";

/**
 * Los pesos y notas que el entrenador le puso a ESTA clienta, encima de los de la plantilla que
 * comparte con las demás.
 *
 * GEMELO: `domain/PesosPropios.kt` en Kotlin. Si cambia allá, cambia acá.
 *
 * Se indexan por nombre de ejercicio y no por posición para que reordenar la plantilla no le
 * despegue los pesos a nadie. Sólo se aplican mientras siga una plantilla: en rutina propia la
 * verdad es su copia, y aplicarlos encima pisaría lo que el entrenador escribió en su editor.
 */
export function claveEjercicio(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, " ");
}

export function conPesosPropios(
  ejercicios: Ejercicio[],
  pesosPropios: Record<string, string> | undefined
): Ejercicio[] {
  // Firestore omite los campos que nunca se escribieron, así que una clienta a la que nunca se
  // le puso un peso propio llega sin el mapa, no con uno vacío.
  if (!pesosPropios) return ejercicios;
  return ejercicios.map((e) => {
    const propio = pesosPropios[claveEjercicio(e.nombre ?? "")];
    // Un valor en blanco no borra el de la plantilla, cae a él: vaciar el campo es la forma de
    // decir "usa el del grupo".
    return propio && propio.trim() !== "" ? { ...e, pesoONota: propio } : e;
  });
}
