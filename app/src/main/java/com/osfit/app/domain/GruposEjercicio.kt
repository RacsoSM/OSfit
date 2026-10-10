package com.osfit.app.domain

import com.osfit.app.data.model.EjercicioBanco
import java.text.Collator
import java.util.Locale

/**
 * Los grupos del grid de Registro en la web ("Pecho:", "Hombro:"…) y la lista de ejercicios de
 * cada uno, que el entrenador configura desde la app: una sola para todas las clientas, en
 * `configEjercicios/grupos` (`porGrupo: { pecho: [ids…] }`).
 *
 * Mientras un grupo no se configura, sale con los ejercicios del banco que le pertenecen
 * ([EjercicioBanco.grupo]), por nombre. Una lista guardada vacía sí cuenta: el entrenador vació
 * el grupo. La web hace exactamente la misma cuenta.
 *
 * GEMELO: `GRUPOS` y `listaDeGrupo` en `web/src/grupos.ts`, y `GRUPOS` en
 * `functions/scripts/bancoEjercicios.mjs`.
 */
data class GrupoEjercicio(val id: String, val nombre: String)

object GruposEjercicio {
    val TODOS: List<GrupoEjercicio> = listOf(
        GrupoEjercicio("pecho", "Pecho"),
        GrupoEjercicio("espalda", "Espalda"),
        GrupoEjercicio("hombro", "Hombro"),
        GrupoEjercicio("biceps", "Bíceps"),
        GrupoEjercicio("triceps", "Tríceps"),
        GrupoEjercicio("cuadriceps", "Cuádriceps"),
        GrupoEjercicio("gluteo", "Glúteo"),
        GrupoEjercicio("femoral", "Femoral"),
        GrupoEjercicio("pantorrilla", "Pantorrilla"),
        GrupoEjercicio("abdomen", "Abdomen"),
        GrupoEjercicio("cardio", "Cardio y funcional")
    )

    private val porNombre: Comparator<EjercicioBanco> =
        compareBy(Collator.getInstance(Locale.forLanguageTag("es"))) { it.nombre }

    /** Los ejercicios del grupo: la lista configurada en su orden, o los del banco por nombre. */
    fun listaDeGrupo(
        grupo: String,
        config: Map<String, List<String>>?,
        banco: List<EjercicioBanco>
    ): List<EjercicioBanco> {
        val ids = config?.get(grupo)
        if (ids != null) {
            val porId = banco.associateBy { it.id }
            return ids.mapNotNull { porId[it] }
        }
        return banco.filter { it.grupo == grupo }.sortedWith(porNombre)
    }

    /** Los ids tal como se van a guardar después de un cambio. */
    fun ids(lista: List<EjercicioBanco>): List<String> = lista.map { it.id }

    /** Sube o baja un ejercicio una posición. Fuera de rango no cambia nada. */
    fun mover(ids: List<String>, desde: Int, hacia: Int): List<String> {
        if (desde !in ids.indices || hacia !in ids.indices || desde == hacia) return ids
        return ids.toMutableList().apply { add(hacia, removeAt(desde)) }
    }

    fun quitar(ids: List<String>, id: String): List<String> = ids - id

    /** Lo agrega al final; si ya estaba no lo repite. */
    fun agregar(ids: List<String>, id: String): List<String> = if (id in ids) ids else ids + id

    /** El banco ordenado por nombre, para el selector de "Agregar". */
    fun ordenados(banco: List<EjercicioBanco>): List<EjercicioBanco> = banco.sortedWith(porNombre)
}
