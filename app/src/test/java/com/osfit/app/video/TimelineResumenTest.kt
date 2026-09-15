package com.osfit.app.video

import com.osfit.app.domain.RankingResultado
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TimelineResumenTest {

    private val ranking = RankingResultado(puesto = 1, nombresPorEncima = emptyList())

    private fun timelineDeDosEscenas() = TimelineResumen(
        listOf(
            EscenaResumen.Saludo("Ana"),
            EscenaResumen.Asistencia("Semana 1", dias = 3, diasHabiles = 5, unidad = "semana", ranking = ranking)
        )
    )

    @Test
    fun `arma los tramos como suma acumulada de duraciones, sin huecos`() {
        val timeline = timelineDeDosEscenas()
        assertEquals(0L, timeline.tramos[0].inicioMs)
        assertEquals(4_000L, timeline.tramos[0].duracionMs)
        assertEquals(4_000L, timeline.tramos[1].inicioMs)
        assertEquals(6_000L, timeline.tramos[1].duracionMs)
        assertEquals(10_000L, timeline.duracionTotalMs)
    }

    @Test
    fun `tramoActivo se queda en la escena saliente hasta el limite de cursor`() {
        val timeline = timelineDeDosEscenas()
        assertEquals(timeline.tramos[0], timeline.tramoActivo(0))
        assertEquals(timeline.tramos[0], timeline.tramoActivo(3_999))
        assertEquals(timeline.tramos[1], timeline.tramoActivo(4_000))
        assertEquals(timeline.tramos[1], timeline.tramoActivo(9_999))
    }

    @Test
    fun `tramoEntrante solo es no-nulo en los 600ms previos al cambio de escena`() {
        val timeline = timelineDeDosEscenas()
        assertNull(timeline.tramoEntrante(3_399))
        assertEquals(timeline.tramos[1], timeline.tramoEntrante(3_400))
        assertEquals(timeline.tramos[1], timeline.tramoEntrante(3_999))
    }

    @Test
    fun `la ultima escena nunca tiene tramoEntrante`() {
        val timeline = timelineDeDosEscenas()
        assertNull(timeline.tramoEntrante(9_999))
    }

    @Test
    fun `alphaEntrante crece de 0 a casi 1 a lo largo de la ventana de crossfade`() {
        val timeline = timelineDeDosEscenas()
        assertEquals(0f, timeline.alphaEntrante(3_400), 0.001f)
        assertEquals(0.5f, timeline.alphaEntrante(3_700), 0.001f)
        assertEquals(599f / 600f, timeline.alphaEntrante(3_999), 0.001f)
    }

    @Test
    fun `elapsedEnTramo de la primera escena arranca en 0 sin adelanto`() {
        val timeline = timelineDeDosEscenas()
        val primero = timeline.tramos[0]
        assertEquals(0L, timeline.elapsedEnTramo(primero, 0))
        assertEquals(3_999L, timeline.elapsedEnTramo(primero, 3_999))
        assertEquals(4_000L, timeline.elapsedEnTramo(primero, 4_000))
    }

    @Test
    fun `elapsedEnTramo de la segunda escena arranca 600ms antes de su cursor y es continuo`() {
        val timeline = timelineDeDosEscenas()
        val segundo = timeline.tramos[1]
        assertEquals(0L, timeline.elapsedEnTramo(segundo, 3_400))
        assertEquals(600L, timeline.elapsedEnTramo(segundo, 4_000))
        assertEquals(6_000L, timeline.elapsedEnTramo(segundo, 10_000))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `no acepta una lista vacia de escenas`() {
        TimelineResumen(emptyList())
    }

    private fun logros(cantidad: Int) = EscenaResumen.LogrosPersonales(
        (1..cantidad).map { EscenaResumen.LogroEnEscena("Logro $it", null, "mensaje $it") }
    )

    @Test
    fun `la escena de logros personales dura mas mientras mas logros trae`() {
        assertEquals(7_500L, TimelineResumen(listOf(logros(1))).duracionTotalMs)
        assertEquals(8_500L, TimelineResumen(listOf(logros(2))).duracionTotalMs)
        assertEquals(10_000L, TimelineResumen(listOf(logros(3))).duracionTotalMs)
    }

    private fun medalla(mensaje: String) = EscenaResumen.Medalla(
        nombre = "Rey de la asistencia",
        categoria = null,
        imagenPersonalizada = null,
        mensaje = mensaje
    )

    @Test
    fun `la racha mas larga dura 5 segundos`() {
        val escena = EscenaResumen.RachaMasLarga(dias = 4, ranking = ranking)

        assertEquals(5_000L, TimelineResumen(listOf(escena)).duracionTotalMs)
    }

    @Test
    fun `sin mensaje la medalla dura lo que tarda en aparecer mas la lectura del nombre`() {
        assertEquals(5_900L, TimelineResumen(listOf(medalla(""))).duracionTotalMs)
    }

    @Test
    fun `con mensaje la medalla dura el inicio mas dos segundos de animacion mas margen de lectura`() {
        // El mensaje arranca a los 5.9s y la animación dura 2s fijo; después queda
        // 2s en pantalla ya completo. 5900 + 2000 + 2000 = 9900.
        val mensaje = "a".repeat(20)

        assertEquals(9_900L, TimelineResumen(listOf(medalla(mensaje))).duracionTotalMs)
    }

    @Test
    fun `la duracion con mensaje es de 9900ms sin importar la longitud del texto`() {
        val corta = TimelineResumen(listOf(medalla("a".repeat(20)))).duracionTotalMs
        val larga = TimelineResumen(listOf(medalla("a".repeat(120)))).duracionTotalMs

        assertEquals(9_900L, corta)
        assertEquals(9_900L, larga)
    }
}
