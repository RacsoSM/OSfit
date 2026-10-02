package com.osfit.app.video

import com.osfit.app.domain.TipoResumen
import org.junit.Assert.*
import org.junit.Test

class EstilosVideoTest {
    @Test fun `los ids ausentes y desconocidos usan blobs`() {
        assertEquals(EstilosVideo.BLOBS, EstilosVideo.porId(null))
        assertEquals(EstilosVideo.BLOBS, EstilosVideo.porId("inexistente"))
    }
    @Test fun `mancu se encuentra por id y blobs es el primero`() {
        assertEquals(EstilosVideo.MANCU, EstilosVideo.porId("mancu"))
        assertEquals(EstilosVideo.BLOBS, EstilosVideo.disponibles.first())
        assertTrue(EstilosVideo.BLOBS.usaPaleta)
        assertFalse(EstilosVideo.MANCU.usaPaleta)
    }
    @Test fun `solo el quincenal admite el estilo configurado`() {
        assertEquals(EstilosVideo.BLOBS, EstilosVideo.paraResumen(TipoResumen.SEMANAL, EstilosVideo.MANCU))
        assertEquals(EstilosVideo.BLOBS, EstilosVideo.paraResumen(TipoResumen.MENSUAL, EstilosVideo.MANCU))
        assertEquals(EstilosVideo.MANCU, EstilosVideo.paraResumen(TipoResumen.QUINCENAL, EstilosVideo.MANCU))
    }
}
