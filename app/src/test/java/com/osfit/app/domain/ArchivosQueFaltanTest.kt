package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.model.MedallaCatalogo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Desinstalar borra filesDir. Estas pruebas fijan las dos mitades de la decisión: qué
 * archivos deberían estar, y cuáles hay que bajar porque no están.
 */
class ArchivosQueFaltanTest {

    private val cancionDeAna = ArchivoEsperado("ana.mp3", "canciones", "canciones/ana.mp3")

    @Test
    fun `si todo esta en disco no baja nada`() {
        val faltantes = ArchivosQueFaltan.calcular(listOf(cancionDeAna)) { true }
        assertTrue(faltantes.isEmpty())
    }

    @Test
    fun `baja lo que falta en disco y tiene respaldo`() {
        val faltantes = ArchivosQueFaltan.calcular(listOf(cancionDeAna)) { false }
        assertEquals(listOf(cancionDeAna), faltantes)
    }

    @Test
    fun `lo que falta sin respaldo no se intenta bajar`() {
        val sinRespaldo = ArchivoEsperado("ana.mp3", "canciones", rutaRemota = null)
        val faltantes = ArchivosQueFaltan.calcular(listOf(sinRespaldo)) { false }
        assertTrue(faltantes.isEmpty())
    }

    @Test
    fun `una clienta sin cancion no espera ningun archivo`() {
        val ana = Cliente(id = "ana", cancionArchivo = null, cancionRuta = null)
        val esperados = ArchivosQueFaltan.esperadosDe(listOf(ana), emptyList(), emptyList())
        assertTrue(esperados.isEmpty())
    }

    @Test
    fun `la cancion de una clienta usa la ruta guardada en su documento`() {
        val ana = Cliente(id = "ana", cancionArchivo = "ana.mp3", cancionRuta = "canciones/ana.mp3")
        val esperados = ArchivosQueFaltan.esperadosDe(listOf(ana), emptyList(), emptyList())
        assertEquals(listOf(cancionDeAna), esperados)
    }

    @Test
    fun `una cancion de antes de este campo se espera pero sin respaldo`() {
        val ana = Cliente(id = "ana", cancionArchivo = "ana.mp3", cancionRuta = null)
        val esperados = ArchivosQueFaltan.esperadosDe(listOf(ana), emptyList(), emptyList())
        assertEquals(listOf(ArchivoEsperado("ana.mp3", "canciones", null)), esperados)
    }

    @Test
    fun `la imagen de una medalla se arma con su id, no con su imagenUrl`() {
        val medalla = MedallaCatalogo(
            id = "constancia",
            imagenArchivo = "constancia.png",
            imagenUrl = "https://firebasestorage.example/cualquier-cosa?token=abc"
        )
        val esperados = ArchivosQueFaltan.esperadosDe(emptyList(), listOf(medalla), emptyList())
        assertEquals(
            listOf(ArchivoEsperado("constancia.png", "medallas", "insignias/medallas/constancia.png")),
            esperados
        )
    }

    @Test
    fun `una medalla que nunca se subio no tiene respaldo`() {
        val medalla = MedallaCatalogo(id = "constancia", imagenArchivo = "constancia.png", imagenUrl = null)
        val esperados = ArchivosQueFaltan.esperadosDe(emptyList(), listOf(medalla), emptyList())
        assertEquals(listOf(ArchivoEsperado("constancia.png", "medallas", null)), esperados)
    }

    @Test
    fun `un logro personal apunta a su propia carpeta`() {
        val logro = LogroPersonalCatalogo(
            id = "primer_mes",
            imagenArchivo = "primer_mes.png",
            imagenUrl = "https://firebasestorage.example/x"
        )
        val esperados = ArchivosQueFaltan.esperadosDe(emptyList(), emptyList(), listOf(logro))
        assertEquals(
            listOf(
                ArchivoEsperado(
                    "primer_mes.png",
                    "logrosPersonales",
                    "insignias/logrosPersonales/primer_mes.png"
                )
            ),
            esperados
        )
    }

    @Test
    fun `una medalla sin imagen propia no espera archivo`() {
        val medalla = MedallaCatalogo(id = "racha", imagenArchivo = null)
        val esperados = ArchivosQueFaltan.esperadosDe(emptyList(), listOf(medalla), emptyList())
        assertTrue(esperados.isEmpty())
    }
}
