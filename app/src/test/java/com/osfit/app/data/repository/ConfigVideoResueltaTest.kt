package com.osfit.app.data.repository

import com.osfit.app.video.EstilosVideo
import org.junit.Assert.assertEquals
import org.junit.Test

class ConfigVideoResueltaTest {
    @Test fun `un periodo ausente usa los valores originales`() {
        val config = ConfigVideoResuelta.desde(null)
        assertEquals("aqua_noche", config.paleta.id)
        assertEquals(EstilosVideo.BLOBS, config.estilo)
    }
    @Test fun `los documentos antiguos conservan su paleta`() {
        val config = ConfigVideoResuelta.desde(ConfigVideoGuardada("atardecer", null))
        assertEquals("atardecer", config.paleta.id)
        assertEquals(EstilosVideo.BLOBS, config.estilo)
    }
    @Test fun `un periodo con solo estilo usa la paleta original`() {
        val config = ConfigVideoResuelta.desde(ConfigVideoGuardada(null, "mancu"))
        assertEquals("aqua_noche", config.paleta.id)
        assertEquals(EstilosVideo.MANCU, config.estilo)
    }
    @Test fun `los ids desconocidos usan los valores originales`() {
        val config = ConfigVideoResuelta.desde(ConfigVideoGuardada("inexistente", "inexistente"))
        assertEquals("aqua_noche", config.paleta.id)
        assertEquals(EstilosVideo.BLOBS, config.estilo)
    }
}
