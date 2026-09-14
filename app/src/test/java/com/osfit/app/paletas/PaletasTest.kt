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

    /** Luminancia relativa de WCAG 2.1, sobre los ocho bits bajos de cada canal. */
    private fun luminancia(color: Int): Double {
        val canales = listOf(16, 8, 0).map { ((color shr it) and 0xFF) / 255.0 }
        val lineal = canales.map {
            if (it <= 0.03928) it / 12.92 else Math.pow((it + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * lineal[0] + 0.7152 * lineal[1] + 0.0722 * lineal[2]
    }

    private fun contraste(a: Int, b: Int): Double {
        val la = luminancia(a)
        val lb = luminancia(b)
        return (maxOf(la, lb) + 0.05) / (minOf(la, lb) + 0.05)
    }

    /** El fondo de la web, que no cambia con la paleta (ver estilos.css). */
    private val FONDO_WEB = 0xFF121212.toInt()

    @Test
    fun `hay quince paletas`() {
        assertEquals(15, Paletas.disponibles.size)
    }

    /** La web sin configurar tiene que seguir viéndose como el día anterior al despliegue.
     *  Estos cuatro valores son literalmente los de :root en web/src/estilos.css. */
    @Test
    fun `la paleta por defecto de la web conserva los colores actuales de la pagina`() {
        val defecto = Paletas.porDefectoWeb
        assertEquals("morado_osfit", defecto.id)
        assertEquals(0xFFB388FF.toInt(), defecto.webPrimario)
        assertEquals(0xFF6A1B9A.toInt(), defecto.webPrimarioOscuro)
        assertEquals(0xFFE3D2FF.toInt(), defecto.webPrimarioClaro)
        assertEquals(0xFF2A0064.toInt(), defecto.webSobrePrimario)
    }

    @Test
    fun `porIdWeb devuelve la paleta pedida`() {
        Paletas.disponibles.forEach { paleta ->
            assertEquals(paleta, Paletas.porIdWeb(paleta.id))
        }
    }

    /** Una clienta sin paleta asignada, y una con un preset ya retirado del código, tienen
     *  que caer en el morado de siempre y no en una pantalla rota. */
    @Test
    fun `porIdWeb cae en el morado ante null, vacio o desconocido`() {
        assertEquals(Paletas.porDefectoWeb, Paletas.porIdWeb(null))
        assertEquals(Paletas.porDefectoWeb, Paletas.porIdWeb(""))
        assertEquals(Paletas.porDefectoWeb, Paletas.porIdWeb("preset_que_ya_no_existe"))
    }

    /** Los dos por defecto son distintos a propósito: cada lado conserva su aspecto previo. */
    @Test
    fun `el por defecto del video sigue siendo aqua noche y el de la web es el morado`() {
        assertEquals("aqua_noche", Paletas.porDefectoVideo.id)
        assertEquals("morado_osfit", Paletas.porDefectoWeb.id)
    }

    /** Los colores de web se pintan sobre superficies opacas: un alfa distinto de FF aquí
     *  sería un color a medio escribir, no una decisión. */
    @Test
    fun `los cuatro colores de web de toda paleta son opacos`() {
        Paletas.disponibles.forEach { paleta ->
            listOf(
                paleta.webPrimario,
                paleta.webPrimarioOscuro,
                paleta.webPrimarioClaro,
                paleta.webSobrePrimario
            ).forEach { color ->
                assertEquals("alfa en ${paleta.id}", 0xFF, (color ushr 24) and 0xFF)
            }
        }
    }

    /** Un campo olvidado en un constructor de diez colores sale como 0, que es transparente
     *  o negro según dónde se pinte, y en ninguno de los dos casos es una decisión. */
    @Test
    fun `ninguna paleta tiene un color en cero`() {
        Paletas.disponibles.forEach { paleta ->
            listOf(
                paleta.blobA, paleta.blobB, paleta.blobC, paleta.destacado,
                paleta.webPrimario, paleta.webPrimarioOscuro,
                paleta.webPrimarioClaro, paleta.webSobrePrimario
            ).forEach { color ->
                assertNotEquals("color en cero en ${paleta.id}", 0, color)
            }
        }
    }

    /** Lo que impide que una paleta bonita deje el saludo ilegible. */
    @Test
    fun `el primario de web de toda paleta contrasta con el fondo oscuro`() {
        Paletas.disponibles.forEach { paleta ->
            val ratio = contraste(paleta.webPrimario, FONDO_WEB)
            assertTrue("contraste bajo en ${paleta.id}: $ratio", ratio >= 4.5)
        }
    }

    @Test
    fun `el texto sobre primario contrasta con su propio primario`() {
        Paletas.disponibles.forEach { paleta ->
            val ratio = contraste(paleta.webSobrePrimario, paleta.webPrimario)
            assertTrue("contraste bajo en ${paleta.id}: $ratio", ratio >= 4.5)
        }
    }
}
