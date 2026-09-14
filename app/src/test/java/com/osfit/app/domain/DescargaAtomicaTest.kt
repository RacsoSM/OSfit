package com.osfit.app.domain

import java.io.File
import java.io.IOException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * El restaurador decide con `File.exists()`. Estas pruebas fijan lo que eso exige: que en la
 * ruta buena no quede nunca un archivo a medias, porque contaría como restaurado para siempre.
 */
class DescargaAtomicaTest {

    @get:Rule
    val carpeta = TemporaryFolder()

    private fun destino() = File(File(carpeta.root, "canciones"), "ana.mp3")

    @Test
    fun `una descarga que termina deja el archivo completo en el destino`() = runBlocking {
        val destino = destino()

        DescargaAtomica.aArchivo(destino) { temporal -> temporal.writeText("cancion entera") }

        assertEquals("cancion entera", destino.readText())
    }

    @Test
    fun `una descarga cortada no deja nada en el destino`() = runBlocking {
        val destino = destino()

        runCatching {
            DescargaAtomica.aArchivo(destino) { temporal ->
                temporal.writeText("mitad")
                throw IOException("se cortó la red")
            }
        }

        assertFalse("el destino no debe existir tras una descarga cortada", destino.exists())
    }

    @Test
    fun `una descarga cortada no deja el parcial tirado`() = runBlocking {
        val destino = destino()

        runCatching {
            DescargaAtomica.aArchivo(destino) { temporal ->
                temporal.writeText("mitad")
                throw IOException("se cortó la red")
            }
        }

        val sobrantes = destino.parentFile?.listFiles().orEmpty()
        assertTrue("no debe quedar basura en la carpeta: ${sobrantes.map { it.name }}", sobrantes.isEmpty())
    }

    @Test
    fun `el fallo de la descarga se propaga a quien llama`() {
        val error = runCatching {
            runBlocking {
                DescargaAtomica.aArchivo(destino()) { throw IOException("se cortó la red") }
            }
        }.exceptionOrNull()

        assertTrue(error is IOException)
    }

    @Test
    fun `una descarga que termina reemplaza el archivo viejo del destino`() = runBlocking {
        val destino = destino()
        destino.parentFile?.mkdirs()
        destino.writeText("cancion vieja")

        DescargaAtomica.aArchivo(destino) { temporal -> temporal.writeText("cancion nueva") }

        assertEquals("cancion nueva", destino.readText())
    }
}
