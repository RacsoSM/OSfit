package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MancuCoreografiaTest {
    @Test fun `la transicion queda acotada y avanza suavemente entre sus extremos`() {
        assertEquals(0f, MancuAnimacion.transicion(99L, 100L, 400L), 0f)
        assertEquals(0f, MancuAnimacion.transicion(100L, 100L, 400L), 0f)
        assertEquals(0.5f, MancuAnimacion.transicion(300L, 100L, 400L), 0f)
        assertEquals(1f, MancuAnimacion.transicion(500L, 100L, 400L), 0f)
        assertEquals(1f, MancuAnimacion.transicion(900L, 100L, 400L), 0f)
        var anterior = 0f
        for (t in 100L..500L) {
            val valor = MancuAnimacion.transicion(t, 100L, 400L)
            assertTrue(valor in anterior..1f)
            anterior = valor
        }
    }

    @Test fun `la sentadilla anticipa subiendo antes de bajar y repite el fondo cada ciclo`() {
        assertEquals(0f, MancuAnimacion.sentadillaAnticipada(0L), 0f)
        assertEquals(-0.15f, MancuAnimacion.sentadillaAnticipada(120L), 0.00001f)
        assertEquals(1f, MancuAnimacion.sentadillaAnticipada(600L), 0f)
        assertEquals(0f, MancuAnimacion.sentadillaAnticipada(1200L), 0f)
        for (t in -1200L..2400L) {
            val valor = MancuAnimacion.sentadillaAnticipada(t)
            assertTrue(valor in -0.15f..1f)
            assertEquals(valor, MancuAnimacion.sentadillaAnticipada(t + 1200L), 0f)
        }
    }

    @Test fun `el balanceo triste oscila tres grados lentamente y empieza sin giro`() {
        assertEquals(0f, MancuAnimacion.balanceoTriste(0L), 0f)
        assertEquals(3f, MancuAnimacion.balanceoTriste(600L), 0.00001f)
        assertEquals(-3f, MancuAnimacion.balanceoTriste(1800L), 0.00001f)
        for (t in -2400L..2400L step 17L) {
            assertTrue(MancuAnimacion.balanceoTriste(t) in -3f..3f)
            assertEquals(MancuAnimacion.balanceoTriste(t), MancuAnimacion.balanceoTriste(t + 2400L), 0f)
        }
    }
}
