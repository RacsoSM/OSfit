package com.osfit.app.video

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ColorMancuTest {
    @Test fun `tinta y marron son oscuros`() {
        assertTrue(ColorMancu.esColorOscuro(PaletaMancu.TINTA))
        assertTrue(ColorMancu.esColorOscuro(PaletaMancu.MARRON))
    }

    @Test fun `rojo sol y papel conservan el contorno original`() {
        assertFalse(ColorMancu.esColorOscuro(PaletaMancu.ROJO))
        assertFalse(ColorMancu.esColorOscuro(PaletaMancu.SOL))
        assertFalse(ColorMancu.esColorOscuro(PaletaMancu.PAPEL))
    }
}
