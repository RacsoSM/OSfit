package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MancuAnimacionTest {
    @Test fun `la nube empieza y termina vacia y tapa todo en el punto medio`() {
        for (alpha in listOf(-1f, 0f, 1f, 2f)) {
            assertEquals(0f, MancuAnimacion.progresoNube(alpha), 0f)
        }
        assertEquals(1f, MancuAnimacion.progresoNube(0.5f), 0f)
    }

    @Test fun `la nube es simetrica y crece y decrece monotonamente`() {
        assertEquals(MancuAnimacion.progresoNube(0.25f),
            MancuAnimacion.progresoNube(0.75f), 0.00001f)
        var anterior = 0f
        for (i in 0..50) {
            val progreso = MancuAnimacion.progresoNube(i / 100f)
            assertTrue(progreso >= anterior)
            assertEquals(progreso, MancuAnimacion.progresoNube(1f - i / 100f), 0.00001f)
            anterior = progreso
        }
        for (i in 51..100) {
            val progreso = MancuAnimacion.progresoNube(i / 100f)
            assertTrue(progreso <= anterior)
            anterior = progreso
        }
    }

    @Test fun `la escena cambia exactamente cuando la nube alcanza cobertura total`() {
        assertTrue(!MancuAnimacion.escenaVisibleEsEntrante(0f))
        assertTrue(!MancuAnimacion.escenaVisibleEsEntrante(0.499999f))
        assertTrue(MancuAnimacion.escenaVisibleEsEntrante(0.5f))
        assertTrue(MancuAnimacion.escenaVisibleEsEntrante(1f))
    }

    @Test fun `el rebote se repite cada 1400 ms y recorre menos uno a uno`() {
        for (t in listOf(-1400L, -1L, 0L, 137L, 350L, 700L, 1050L, 1399L)) {
            assertEquals(MancuAnimacion.reboteY(t), MancuAnimacion.reboteY(t + 1400L), 0.00001f)
            assertTrue(MancuAnimacion.reboteY(t) in -1f..1f)
        }
        assertEquals(1f, MancuAnimacion.reboteY(350L), 0.00001f)
        assertEquals(-1f, MancuAnimacion.reboteY(1050L), 0.00001f)
    }

    @Test fun `el parpadeo solo cierra dentro de su ventana triangular`() {
        for (t in listOf(0L, 1000L, 3312L, 3528L, 3599L, 3600L)) {
            assertEquals(1f, MancuAnimacion.factorParpadeo(t), 0.00001f)
        }
        assertTrue(MancuAnimacion.factorParpadeo(3420L) < 0.2f)
        assertEquals(0.55f, MancuAnimacion.factorParpadeo(3366L), 0.00001f)
        assertEquals(0.55f, MancuAnimacion.factorParpadeo(3474L), 0.00001f)
        assertEquals(MancuAnimacion.factorParpadeo(3420L), MancuAnimacion.factorParpadeo(7020L), 0f)
    }

    @Test fun `la entrada cae rebota una vez y termina quieta`() {
        assertEquals(1f, MancuAnimacion.saltoEntrada(0L), 0f)
        assertEquals(0f, MancuAnimacion.saltoEntrada(450L), 0.00001f)
        assertTrue(MancuAnimacion.saltoEntrada(600L) > MancuAnimacion.saltoEntrada(450L))
        for (t in listOf(900L, 901L, 1500L, Long.MAX_VALUE)) {
            assertEquals(0f, MancuAnimacion.saltoEntrada(t), 0f)
        }
        assertEquals(1f, MancuAnimacion.saltoEntrada(-1L), 0f)
        for (t in 0L..900L step 15L) assertTrue(MancuAnimacion.saltoEntrada(t) in 0f..1f)
    }

    @Test fun `el aplastamiento conserva volumen y termina con escala uno`() {
        for (t in listOf(-1L, 0L, 90L, 180L, 350L, 500L, 700L, 1000L)) {
            val (x, y) = MancuAnimacion.squash(t)
            assertEquals(1f, x * y, 0.00001f)
            assertTrue(x > 0f && y > 0f)
        }
        assertTrue(MancuAnimacion.squash(0L).first > 1f)
        assertTrue(MancuAnimacion.squash(350L).first < 1f)
        assertEquals(1f to 1f, MancuAnimacion.squash(700L))
    }
}
