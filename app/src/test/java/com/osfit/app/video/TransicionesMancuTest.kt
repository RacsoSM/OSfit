package com.osfit.app.video

import org.junit.Assert.*
import org.junit.Test

class TransicionesMancuTest {
    @Test fun `las transiciones empiezan en nube y repiten un ciclo de cuatro sin vecinas iguales`() {
        val ciclo = listOf(TipoTransicionMancu.NUBE, TipoTransicionMancu.TELON,
            TipoTransicionMancu.IRIS, TipoTransicionMancu.BROCHA)
        for (i in 0 until 40) {
            assertEquals(ciclo[i % 4], TipoTransicionMancu.paraIndice(i))
            assertNotEquals(TipoTransicionMancu.paraIndice(i), TipoTransicionMancu.paraIndice(i + 1))
        }
    }

    @Test fun `nube y telon corren mientras iris y brocha saltan`() {
        assertEquals(EstiloViajeMancu.CORRER, TipoTransicionMancu.NUBE.viaje)
        assertEquals(EstiloViajeMancu.CORRER, TipoTransicionMancu.TELON.viaje)
        assertEquals(EstiloViajeMancu.SALTO, TipoTransicionMancu.IRIS.viaje)
        assertEquals(EstiloViajeMancu.SALTO, TipoTransicionMancu.BROCHA.viaje)
    }

    @Test fun `el salto anticipa despega y aterriza antes de terminar`() {
        assertEquals(0f, MancuAnimacion.viajeSaltoY(0f), 0f)
        assertEquals(0f, MancuAnimacion.viajeSaltoY(0.15f), 0.0001f)
        assertEquals(-1.2f, MancuAnimacion.viajeSaltoY(0.5f), 0.0001f)
        assertTrue(MancuAnimacion.viajeSaltoY(0.3f) < 0f)
        assertTrue(MancuAnimacion.viajeSaltoY(0.75f) < 0f)
        assertEquals(0f, MancuAnimacion.viajeSaltoY(0.925f), 0.0001f)
        assertEquals(0f, MancuAnimacion.viajeSaltoY(1f), 0f)
    }

    @Test fun `el salto conserva escalas positivas agacha estira y recupera el volumen`() {
        assertEquals(1f, MancuAnimacion.viajeSaltoEscalaY(0f), 0f)
        assertEquals(0.8f, MancuAnimacion.viajeSaltoEscalaY(0.14999f), 0.0001f)
        assertEquals(1.15f, MancuAnimacion.viajeSaltoEscalaY(0.5f), 0f)
        assertEquals(0.8f, MancuAnimacion.viajeSaltoEscalaY(0.925f), 0.0001f)
        assertEquals(1f, MancuAnimacion.viajeSaltoEscalaY(1f), 0.0001f)
        for (i in 0..1000) {
            val a = i / 1000f
            assertTrue(MancuAnimacion.viajeSaltoEscalaY(a) > 0f)
            assertTrue(kotlin.math.abs(MancuAnimacion.viajeSaltoInclinacion(a)) <= 6f)
        }
        assertEquals(0f, MancuAnimacion.viajeSaltoInclinacion(0f), 0f)
        assertEquals(0f, MancuAnimacion.viajeSaltoInclinacion(1f), 0f)
    }
}
