package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Test

class MaquinaEscribirTest {

    @Test
    fun `elapsedMs menor o igual a cero no muestra nada`() {
        assertEquals("", MaquinaEscribir.textoVisible("Hola", elapsedMs = 0, duracionMs = 1000))
        assertEquals("", MaquinaEscribir.textoVisible("Hola", elapsedMs = -50, duracionMs = 1000))
    }

    @Test
    fun `elapsedMs mayor o igual a duracionMs muestra el texto completo`() {
        assertEquals("Hola", MaquinaEscribir.textoVisible("Hola", elapsedMs = 1000, duracionMs = 1000))
        assertEquals("Hola", MaquinaEscribir.textoVisible("Hola", elapsedMs = 5000, duracionMs = 1000))
    }

    @Test
    fun `a la mitad del tiempo muestra la mitad de los caracteres`() {
        assertEquals("Ho", MaquinaEscribir.textoVisible("Hola", elapsedMs = 500, duracionMs = 1000))
    }

    @Test
    fun `duracionMs cero o negativa muestra el texto completo de inmediato`() {
        assertEquals("Hola", MaquinaEscribir.textoVisible("Hola", elapsedMs = 10, duracionMs = 0))
        assertEquals("Hola", MaquinaEscribir.textoVisible("Hola", elapsedMs = 10, duracionMs = -5))
    }
}
