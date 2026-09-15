package com.osfit.app.domain

import com.osfit.app.data.model.Ejercicio

/**
 * Los pesos y notas que el entrenador le puso a **una clienta concreta**, encima de los de la
 * plantilla que comparte con las demás.
 *
 * El problema que resuelven: `pesoONota` vive dentro del `Ejercicio` de la plantilla, así que
 * es el mismo para todas las que la siguen. El ejercicio es del programa, pero **el peso es de
 * la persona**, y hasta el 2026-09-15 tener pesos propios obligaba a sacarla de la plantilla —
 * y entonces dejaban de llegarle los cambios. Con esto se queda en la plantilla y sus pesos
 * viven en su documento.
 *
 * **Se indexan por nombre de ejercicio y no por posición** para que reordenar los ejercicios de
 * la plantilla, o insertar uno en medio, no le despegue los pesos a nadie. El costo es que
 * renombrar un ejercicio pierde su peso propio: no se rompe nada, simplemente vuelve a mostrar
 * el de la plantilla.
 *
 * **Sólo se aplican mientras siga una plantilla** (`plantillaOrigenId` con valor). En rutina
 * propia la verdad es su copia, y aplicarlos encima pisaría lo que el entrenador acaba de
 * escribir en su editor.
 */

/**
 * La forma en que se guarda el nombre para buscarlo: sin espacios de sobra, sin mayúsculas.
 * Así "Press Banca", "press banca" y "  Press  banca " son el mismo ejercicio, que es como los
 * escribe una persona con prisa.
 *
 * GEMELO: `claveEjercicio` en `web/src/pesosPropios.ts`. Si cambia acá, cambia allá.
 */
fun claveEjercicio(nombre: String): String =
    nombre.trim().lowercase().replace(Regex("\\s+"), " ")

/**
 * Cambia el `pesoONota` de cada ejercicio por el propio de la clienta, si tiene uno.
 *
 * Un valor en blanco no borra el de la plantilla, cae a él: dejar el campo vacío es la forma de
 * decir "usa el del grupo", y guardar el vacío sólo llenaría el mapa de entradas muertas.
 *
 * GEMELO: `conPesosPropios` en `web/src/pesosPropios.ts`.
 */
fun conPesosPropios(
    ejercicios: List<Ejercicio>,
    pesosPropios: Map<String, String>
): List<Ejercicio> {
    if (pesosPropios.isEmpty()) return ejercicios
    return ejercicios.map { ejercicio ->
        val propio = pesosPropios[claveEjercicio(ejercicio.nombre)]
        if (propio.isNullOrBlank()) ejercicio else ejercicio.copy(pesoONota = propio)
    }
}

/**
 * El mapa con [nombre] puesto en [valor], listo para guardar. Un valor en blanco **quita** la
 * entrada en vez de guardarla vacía, para que el mapa no acumule claves de ejercicios que ya
 * nadie usa y para que borrar el campo signifique "vuelve al de la plantilla".
 */
fun conPesoPropio(
    pesosPropios: Map<String, String>,
    nombre: String,
    valor: String
): Map<String, String> {
    val clave = claveEjercicio(nombre)
    if (clave.isBlank()) return pesosPropios
    return if (valor.isBlank()) {
        pesosPropios - clave
    } else {
        pesosPropios + (clave to valor)
    }
}
