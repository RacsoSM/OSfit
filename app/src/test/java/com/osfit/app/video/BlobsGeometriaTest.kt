package com.osfit.app.video

import com.osfit.app.paletas.Paletas

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BlobsGeometriaTest {

    private val blobs = BlobsGeometria.blobs(Paletas.porDefectoVideo)

    @Test
    fun `posicionEn es determinista para el mismo tiempo`() {
        val blob = blobs.first()
        assertEquals(BlobsGeometria.posicionEn(blob, 12_345L), BlobsGeometria.posicionEn(blob, 12_345L))
    }

    @Test
    fun `posicionEn se mantiene dentro de la amplitud declarada del blob a lo largo de un periodo`() {
        val blob = blobs.first()
        var t = 0L
        while (t < blob.periodoMs) {
            val p = BlobsGeometria.posicionEn(blob, t)
            assertTrue(p.x in (blob.centroBaseX - blob.amplitudX - 0.001f)..(blob.centroBaseX + blob.amplitudX + 0.001f))
            assertTrue(p.y in (blob.centroBaseY - blob.amplitudY - 0.001f)..(blob.centroBaseY + blob.amplitudY + 0.001f))
            t += 250L
        }
    }

    @Test
    fun `hay al menos 4 blobs y tres matices distintos`() {
        assertTrue(blobs.size >= 4)
        assertEquals(3, blobs.map { it.colorArgb }.toSet().size)
    }

    /** El corazón del cambio: la geometría es una sola, los colores los pone la paleta. */
    @Test
    fun `los colores salen de la paleta recibida`() {
        val paleta = Paletas.porIdVideo("atardecer")
        val colores = BlobsGeometria.blobs(paleta).map { it.colorArgb }.toSet()
        assertEquals(setOf(paleta.blobA, paleta.blobB, paleta.blobC), colores)
    }

    @Test
    fun `la geometria no depende de la paleta`() {
        Paletas.disponibles.forEach { paleta ->
            val conPaleta = BlobsGeometria.blobs(paleta)
            assertEquals(blobs.size, conPaleta.size)
            conPaleta.forEachIndexed { i, blob ->
                val esperado = blobs[i]
                assertEquals(esperado.radio, blob.radio, 0f)
                assertEquals(esperado.centroBaseX, blob.centroBaseX, 0f)
                assertEquals(esperado.centroBaseY, blob.centroBaseY, 0f)
                assertEquals(esperado.amplitudX, blob.amplitudX, 0f)
                assertEquals(esperado.amplitudY, blob.amplitudY, 0f)
                assertEquals(esperado.periodoMs, blob.periodoMs)
                assertEquals(esperado.faseMs, blob.faseMs)
            }
        }
    }

    @Test
    fun `los blobs conservan el tamano original`() {
        blobs.forEach { assertTrue("radio inesperado: ${it.radio}", it.radio in 0.24f..0.35f) }
    }

    /** Aun achicados siguen sin salirse del canvas al oscilar: centro ± amplitud ± radio. */
    @Test
    fun `ningun blob se aleja tanto del canvas como para desaparecer`() {
        blobs.forEach { blob ->
            assertTrue(blob.centroBaseX + blob.amplitudX - blob.radio < 1f)
            assertTrue(blob.centroBaseX - blob.amplitudX + blob.radio > 0f)
        }
    }
}
