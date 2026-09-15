package com.osfit.app.domain

import com.osfit.app.data.model.Ejercicio
import org.junit.Assert.assertEquals
import org.junit.Test

/** Unidad: los pesos que el entrenador le pone a una clienta encima de la plantilla. */
class PesosPropiosTest {

    private fun ejercicio(nombre: String, peso: String = "") =
        Ejercicio(nombre = nombre, series = 4, repeticiones = "10", pesoONota = peso)

    @Test
    fun `sin pesos propios devuelve los de la plantilla`() {
        val ejercicios = listOf(ejercicio("Press banca", "30 kg"))
        assertEquals(ejercicios, conPesosPropios(ejercicios, emptyMap()))
    }

    @Test
    fun `el peso propio pisa al de la plantilla`() {
        val ejercicios = listOf(ejercicio("Press banca", "30 kg"))

        val resultado = conPesosPropios(ejercicios, mapOf("press banca" to "40 kg"))

        assertEquals("40 kg", resultado.single().pesoONota)
    }

    @Test
    fun `solo cambia el ejercicio que tiene peso propio`() {
        val ejercicios = listOf(ejercicio("Press banca", "30 kg"), ejercicio("Remo", "25 kg"))

        val resultado = conPesosPropios(ejercicios, mapOf("press banca" to "40 kg"))

        assertEquals("40 kg", resultado[0].pesoONota)
        assertEquals("el otro se queda con el de la plantilla", "25 kg", resultado[1].pesoONota)
    }

    @Test
    fun `la busqueda ignora mayusculas y espacios de sobra`() {
        val ejercicios = listOf(ejercicio("  Press   Banca "))

        val resultado = conPesosPropios(ejercicios, mapOf("press banca" to "40 kg"))

        assertEquals("40 kg", resultado.single().pesoONota)
    }

    @Test
    fun `un peso propio en blanco cae al de la plantilla`() {
        val ejercicios = listOf(ejercicio("Press banca", "30 kg"))

        val resultado = conPesosPropios(ejercicios, mapOf("press banca" to "   "))

        assertEquals("30 kg", resultado.single().pesoONota)
    }

    @Test
    fun `reordenar la plantilla no despega los pesos`() {
        // Es la razón de indexar por nombre y no por posición.
        val original = listOf(ejercicio("Press banca"), ejercicio("Remo"))
        val reordenada = listOf(ejercicio("Remo"), ejercicio("Press banca"))
        val propios = mapOf("press banca" to "40 kg")

        assertEquals("40 kg", conPesosPropios(original, propios)[0].pesoONota)
        assertEquals("40 kg", conPesosPropios(reordenada, propios)[1].pesoONota)
    }

    @Test
    fun `guardar normaliza la clave`() {
        assertEquals(
            mapOf("press banca" to "40 kg"),
            conPesoPropio(emptyMap(), "  Press   BANCA ", "40 kg")
        )
    }

    @Test
    fun `guardar en blanco quita la entrada en vez de dejarla vacia`() {
        val propios = mapOf("press banca" to "40 kg")

        assertEquals(emptyMap<String, String>(), conPesoPropio(propios, "Press banca", ""))
    }

    @Test
    fun `un nombre vacio no ensucia el mapa`() {
        val propios = mapOf("press banca" to "40 kg")

        assertEquals(propios, conPesoPropio(propios, "   ", "40 kg"))
    }
}
