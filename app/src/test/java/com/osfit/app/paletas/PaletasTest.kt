package com.osfit.app.paletas

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PaletasTest {

    /** Garantía de que la app sin configurar sigue generando el video de siempre: si alguien
     *  cambia estos colores, todos los periodos sin paleta asignada cambian de aspecto. */
    @Test
    fun `la paleta por defecto conserva los colores actuales del video`() {
        val defecto = Paletas.porDefectoVideo
        assertEquals("aqua_noche", defecto.id)
        assertEquals(0xB37B1575.toInt(), defecto.blobA)
        assertEquals(0xB3157B7B.toInt(), defecto.blobB)
        assertEquals(0xB34C157B.toInt(), defecto.blobC)
        assertEquals(0xFF00E6A8.toInt(), defecto.destacado)
    }

    @Test
    fun `la paleta por defecto es la primera de la lista`() {
        assertEquals(Paletas.porDefectoVideo, Paletas.disponibles.first())
    }

    @Test
    fun `porId devuelve la paleta pedida`() {
        Paletas.disponibles.forEach { paleta ->
            assertEquals(paleta, Paletas.porIdVideo(paleta.id))
        }
    }

    /** Un periodo puede tener guardado el id de un preset que después se quitó del código, y
     *  un periodo nunca configurado no tiene id: ninguno de los dos casos debe romper. */
    @Test
    fun `porId cae en la paleta por defecto ante null, vacio o desconocido`() {
        assertEquals(Paletas.porDefectoVideo, Paletas.porIdVideo(null))
        assertEquals(Paletas.porDefectoVideo, Paletas.porIdVideo(""))
        assertEquals(Paletas.porDefectoVideo, Paletas.porIdVideo("preset_que_ya_no_existe"))
    }

    @Test
    fun `los ids de los presets son unicos`() {
        val ids = Paletas.disponibles.map { it.id }
        assertEquals(ids.size, ids.toSet().size)
    }

    @Test
    fun `hay al menos cinco presets y todos tienen nombre`() {
        assertTrue(Paletas.disponibles.size >= 5)
        Paletas.disponibles.forEach { assertTrue(it.nombre.isNotBlank()) }
    }

    /** Los tres blobs de una paleta tienen que distinguirse entre sí: si dos son iguales el
     *  fondo pierde profundidad. */
    @Test
    fun `cada paleta tiene tres matices de blob distintos`() {
        Paletas.disponibles.forEach { paleta ->
            assertNotEquals(paleta.blobA, paleta.blobB)
            assertNotEquals(paleta.blobB, paleta.blobC)
            assertNotEquals(paleta.blobA, paleta.blobC)
        }
    }

    /** El destacado se pinta opaco sobre el fondo: es el dato que el cliente tiene que leer. */
    @Test
    fun `el color destacado de toda paleta es completamente opaco`() {
        Paletas.disponibles.forEach { paleta ->
            assertEquals(0xFF, (paleta.destacado ushr 24) and 0xFF)
        }
    }

    /** Los blobs son fondo, no protagonistas: van semitransparentes. */
    @Test
    fun `los blobs de toda paleta son semitransparentes`() {
        Paletas.disponibles.forEach { paleta ->
            listOf(paleta.blobA, paleta.blobB, paleta.blobC).forEach { color ->
                val alfa = (color ushr 24) and 0xFF
                assertTrue("alfa fuera de rango en ${paleta.id}: $alfa", alfa in 0x60..0xC0)
            }
        }
    }
}
