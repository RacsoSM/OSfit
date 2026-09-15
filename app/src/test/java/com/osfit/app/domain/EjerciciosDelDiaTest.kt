package com.osfit.app.domain

import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio
import com.osfit.app.data.model.VariacionDia
import org.junit.Assert.assertEquals
import org.junit.Test

/** Unidad: el invariante de "exactamente una de las dos listas está llena". */
class EjerciciosDelDiaTest {

    private fun ejercicio(nombre: String) = Ejercicio(nombre = nombre, series = 3, repeticiones = "10")

    @Test
    fun `sin variaciones devuelve la lista base`() {
        val dia = DiaRutina(
            nombreDia = "Pecho y espalda",
            ejercicios = listOf(ejercicio("Press banca"), ejercicio("Remo"))
        )

        assertEquals(listOf(ejercicio("Press banca"), ejercicio("Remo")), ejerciciosDe(dia, 0))
        assertEquals(
            "sin variaciones el índice da igual: siempre manda la lista base",
            listOf(ejercicio("Press banca"), ejercicio("Remo")),
            ejerciciosDe(dia, 5)
        )
    }

    @Test
    fun `con variaciones devuelve la de su indice`() {
        val dia = DiaRutina(
            nombreDia = "Pecho y espalda",
            variaciones = listOf(
                VariacionDia(listOf(ejercicio("Press banca"))),
                VariacionDia(listOf(ejercicio("Dominadas"))),
                VariacionDia(listOf(ejercicio("Peso muerto")))
            )
        )

        assertEquals(listOf(ejercicio("Press banca")), ejerciciosDe(dia, 0))
        assertEquals(listOf(ejercicio("Dominadas")), ejerciciosDe(dia, 1))
        assertEquals(listOf(ejercicio("Peso muerto")), ejerciciosDe(dia, 2))
    }

    @Test
    fun `un indice fuera de rango se acota en vez de reventar`() {
        val dia = DiaRutina(
            nombreDia = "Pierna",
            variaciones = listOf(
                VariacionDia(listOf(ejercicio("Sentadilla"))),
                VariacionDia(listOf(ejercicio("Prensa")))
            )
        )

        assertEquals("por arriba se queda en la última", listOf(ejercicio("Prensa")), ejerciciosDe(dia, 7))
        assertEquals("por abajo se queda en la primera", listOf(ejercicio("Sentadilla")), ejerciciosDe(dia, -1))
    }

    @Test
    fun `un dia sin nada devuelve vacio`() {
        assertEquals(emptyList<Ejercicio>(), ejerciciosDe(DiaRutina(nombreDia = "Descanso"), 0))
    }
}
