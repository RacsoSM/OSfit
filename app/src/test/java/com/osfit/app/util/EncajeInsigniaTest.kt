package com.osfit.app.util

import org.junit.Assert.assertEquals
import org.junit.Test

class EncajeInsigniaTest {

    @Test
    fun `una imagen cuadrada llena todo el lado sin franjas`() {
        val encaje = EncajeInsignia.calcular(anchoOrigen = 800, altoOrigen = 800, lado = 512)

        assertEquals(0f, encaje.izquierda, 0.01f)
        assertEquals(0f, encaje.arriba, 0.01f)
        assertEquals(512f, encaje.ancho, 0.01f)
        assertEquals(512f, encaje.alto, 0.01f)
    }

    @Test
    fun `una imagen apaisada ocupa todo el ancho y queda centrada en vertical`() {
        // 1000x500 es 2:1, así que ocupa 512 de ancho y 256 de alto: sobran 128 arriba y abajo.
        val encaje = EncajeInsignia.calcular(anchoOrigen = 1000, altoOrigen = 500, lado = 512)

        assertEquals(0f, encaje.izquierda, 0.01f)
        assertEquals(128f, encaje.arriba, 0.01f)
        assertEquals(512f, encaje.ancho, 0.01f)
        assertEquals(256f, encaje.alto, 0.01f)
    }

    @Test
    fun `una imagen vertical ocupa todo el alto y queda centrada en horizontal`() {
        val encaje = EncajeInsignia.calcular(anchoOrigen = 500, altoOrigen = 1000, lado = 512)

        assertEquals(128f, encaje.izquierda, 0.01f)
        assertEquals(0f, encaje.arriba, 0.01f)
        assertEquals(256f, encaje.ancho, 0.01f)
        assertEquals(512f, encaje.alto, 0.01f)
    }

    @Test
    fun `una imagen mas chica que el lado se agranda hasta llenarlo`() {
        // No se respeta el tamaño original: la insignia siempre sale de 512, si no las
        // imágenes chicas se verían diminutas en el video.
        val encaje = EncajeInsignia.calcular(anchoOrigen = 64, altoOrigen = 32, lado = 512)

        assertEquals(512f, encaje.ancho, 0.01f)
        assertEquals(256f, encaje.alto, 0.01f)
    }

    @Test
    fun `calcularBoundingBox detecta limites de contenido no transparente con padding`() {
        val ancho = 10
        val alto = 10
        val pixels = IntArray(ancho * alto) { 0 }
        for (y in 3..6) {
            for (x in 2..7) {
                pixels[y * ancho + x] = (0xFF shl 24)
            }
        }
        val bbox = EncajeInsignia.calcularBoundingBox(pixels, ancho, alto)
        assertEquals(EncajeInsignia.BoundingBox(minX = 2, minY = 3, maxX = 7, maxY = 6), bbox)
        assertEquals(6, bbox?.ancho)
        assertEquals(4, bbox?.alto)
    }

    @Test
    fun `calcularBoundingBox devuelve null si la imagen es totalmente transparente`() {
        val pixels = IntArray(25) { 0 }
        val bbox = EncajeInsignia.calcularBoundingBox(pixels, 5, 5)
        assertEquals(null, bbox)
    }
}
