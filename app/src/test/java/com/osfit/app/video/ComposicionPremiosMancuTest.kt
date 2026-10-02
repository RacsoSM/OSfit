package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ComposicionPremiosMancuTest {
    @Test fun `Mancu queda fuera de la insignia aun durante el sobrepaso`() {
        val mascota = ComposicionPremiosMancu.mascota(1)
        assertTrue(mascota.x >= 80f)
        assertTrue(mascota.x + mascota.lado <= 1000f)
        assertTrue(mascota.y + mascota.lado < 850f)
    }

    @Test fun `tres logros dejan a Mancu pequeno entre las dos insignias superiores`() {
        val mascota = ComposicionPremiosMancu.mascota(3)
        assertEquals(450f, mascota.x, 0f)
        assertEquals(180f, mascota.lado, 0f)
        assertTrue(mascota.y + mascota.lado < 800f)
    }
}
