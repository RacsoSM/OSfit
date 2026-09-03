package com.osfit.app.video

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BlobsGeometriaTest {

    @Test
    fun `posicionEn es determinista para el mismo tiempo`() {
        val blob = BlobsGeometria.blobs.first()
        assertEquals(BlobsGeometria.posicionEn(blob, 12_345L), BlobsGeometria.posicionEn(blob, 12_345L))
    }

    @Test
    fun `posicionEn se mantiene dentro de la amplitud declarada del blob a lo largo de un periodo`() {
        val blob = BlobsGeometria.blobs.first()
        var t = 0L
        while (t < blob.periodoMs) {
            val p = BlobsGeometria.posicionEn(blob, t)
            assertTrue(p.x in (blob.centroBaseX - blob.amplitudX - 0.001f)..(blob.centroBaseX + blob.amplitudX + 0.001f))
            assertTrue(p.y in (blob.centroBaseY - blob.amplitudY - 0.001f)..(blob.centroBaseY + blob.amplitudY + 0.001f))
            t += 250L
        }
    }

    @Test
    fun `hay blobs magenta, cian y purpura`() {
        val colores = BlobsGeometria.blobs.map { it.colorArgb }.toSet()
        assertEquals(3, colores.size)
    }

    @Test
    fun `hay al menos 4 blobs`() {
        assertTrue(BlobsGeometria.blobs.size >= 4)
    }
}
