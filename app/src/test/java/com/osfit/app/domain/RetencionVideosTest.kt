package com.osfit.app.domain

import com.osfit.app.data.model.VideoPublicado
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RetencionVideosTest {

    private fun video(rangoInicio: String) = VideoPublicado(
        id = rangoInicio,
        rangoInicio = rangoInicio,
        rutaStorage = "resumenes/ana/$rangoInicio.mp4"
    )

    @Test
    fun `con menos de seis videos no sobra ninguno`() {
        val videos = listOf("2026-09-01", "2026-08-16", "2026-08-01").map { video(it) }
        assertTrue(RetencionVideos.sobrantes(videos).isEmpty())
    }

    @Test
    fun `con exactamente seis videos no sobra ninguno`() {
        val videos = listOf(
            "2026-09-16", "2026-09-01", "2026-08-16", "2026-08-01", "2026-07-16", "2026-07-01"
        ).map { video(it) }
        assertTrue(RetencionVideos.sobrantes(videos).isEmpty())
    }

    @Test
    fun `con mas de seis videos sobran los mas viejos`() {
        val videos = listOf(
            "2026-09-16", "2026-09-01", "2026-08-16", "2026-08-01",
            "2026-07-16", "2026-07-01", "2026-06-16", "2026-06-01"
        ).map { video(it) }
        assertEquals(
            listOf("2026-06-16", "2026-06-01"),
            RetencionVideos.sobrantes(videos).map { it.rangoInicio }
        )
    }

    @Test
    fun `el descarte ordena por rangoInicio descendente sin importar el orden de entrada`() {
        val videos = listOf(
            "2026-06-01", "2026-09-16", "2026-07-01", "2026-08-16",
            "2026-06-16", "2026-09-01", "2026-08-01"
        ).map { video(it) }
        assertEquals(
            listOf("2026-06-01"),
            RetencionVideos.sobrantes(videos).map { it.rangoInicio }
        )
    }
}
