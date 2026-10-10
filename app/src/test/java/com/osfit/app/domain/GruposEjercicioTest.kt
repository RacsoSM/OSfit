package com.osfit.app.domain

import com.osfit.app.data.model.EjercicioBanco
import org.junit.Assert.assertEquals
import org.junit.Test

/** Unidad: la lista de ejercicios de cada grupo del grid de Registro. */
class GruposEjercicioTest {

    private val banco = listOf(
        EjercicioBanco(id = "press-banca", nombre = "Press de banca", grupo = "pecho"),
        EjercicioBanco(id = "aperturas", nombre = "Aperturas", grupo = "pecho"),
        EjercicioBanco(id = "press-militar", nombre = "Press militar", grupo = "hombro")
    )

    @Test
    fun `sin configurar salen los del banco de ese grupo por nombre`() {
        val lista = GruposEjercicio.listaDeGrupo("pecho", null, banco)
        assertEquals(listOf("aperturas", "press-banca"), GruposEjercicio.ids(lista))
    }

    @Test
    fun `configurado manda el orden del entrenador y salta ids que ya no existen`() {
        val config = mapOf("pecho" to listOf("press-banca", "borrado", "press-militar"))
        val lista = GruposEjercicio.listaDeGrupo("pecho", config, banco)
        assertEquals(listOf("press-banca", "press-militar"), GruposEjercicio.ids(lista))
    }

    @Test
    fun `una lista configurada vacia se respeta`() {
        assertEquals(emptyList<EjercicioBanco>(), GruposEjercicio.listaDeGrupo("pecho", mapOf("pecho" to emptyList()), banco))
    }

    @Test
    fun `mover sube y baja, y fuera de rango no cambia nada`() {
        val ids = listOf("a", "b", "c")
        assertEquals(listOf("b", "a", "c"), GruposEjercicio.mover(ids, 1, 0))
        assertEquals(listOf("a", "c", "b"), GruposEjercicio.mover(ids, 1, 2))
        assertEquals(ids, GruposEjercicio.mover(ids, 0, -1))
        assertEquals(ids, GruposEjercicio.mover(ids, 2, 3))
    }

    @Test
    fun `agregar no repite y quitar saca solo ese`() {
        assertEquals(listOf("a", "b"), GruposEjercicio.agregar(listOf("a"), "b"))
        assertEquals(listOf("a"), GruposEjercicio.agregar(listOf("a"), "a"))
        assertEquals(listOf("b"), GruposEjercicio.quitar(listOf("a", "b"), "a"))
    }

    @Test
    fun `los grupos son los mismos que en la web y en la semilla`() {
        assertEquals(
            listOf("pecho", "espalda", "hombro", "biceps", "triceps", "cuadriceps", "gluteo",
                "femoral", "pantorrilla", "abdomen", "cardio"),
            GruposEjercicio.TODOS.map { it.id }
        )
    }
}
