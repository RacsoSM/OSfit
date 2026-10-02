package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Test

class CascadaLogrosMancuTest {
    @Test fun `un logro entra a los tres segundos con fade de seiscientos`() {
        assertEquals(3000L, CascadaLogrosMancu.inicio(1, 0))
        assertEquals(0f, CascadaLogrosMancu.opacidad(1, 0, 3000), 0f)
        assertEquals(0.5f, CascadaLogrosMancu.opacidad(1, 0, 3300), 0f)
        assertEquals(1f, CascadaLogrosMancu.opacidad(1, 0, 3600), 0f)
    }
    @Test fun `varios logros entran separados por quinientos milisegundos`() {
        assertEquals(2200L, CascadaLogrosMancu.inicio(3, 0))
        assertEquals(2700L, CascadaLogrosMancu.inicio(3, 1))
        assertEquals(3200L, CascadaLogrosMancu.inicio(3, 2))
        assertEquals(0f, CascadaLogrosMancu.opacidad(3, 2, 3100), 0f)
        assertEquals(1f, CascadaLogrosMancu.opacidad(3, 2, 10000), 0f)
    }
}
