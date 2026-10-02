package com.osfit.app.video
import org.junit.Assert.*
import org.junit.Test
class RitmoVideoTest {
    private val escenas = listOf(EscenaResumen.Saludo("Ana"), EscenaResumen.Despedida)
    @Test fun `el default conserva duraciones ventana y reloj`() {
        val t = TimelineResumen(escenas)
        assertEquals(listOf(4000L, 6000L), t.tramos.map { it.duracionMs })
        assertNull(t.tramoEntrante(3399L))
        assertEquals(0.5f, t.alphaEntrante(3700L), 0f)
        assertEquals(300L, t.elapsedEnTramo(t.tramos[1], 3700L))
    }

    @Test fun `Mancu extiende las escenas y destapa a mitad de ventana`() {
        val t = TimelineResumen(escenas, RitmosVideo.MANCU)
        assertEquals(listOf(5000L, 7500L), t.tramos.map { it.duracionMs })
        assertEquals(1000L, t.ritmo.ventanaTransicionMs)
        assertNull(t.tramoEntrante(3999L))
        assertEquals(0.5f, t.alphaEntrante(4500L), 0f)
        assertEquals(500L, t.elapsedEnTramo(t.tramos[1], 4500L))
        assertEquals(-500L, t.relojVisible(t.tramos[1], 4000L))
        assertEquals(0L, t.relojVisible(t.tramos[1], 4500L))
        assertEquals(4500L, t.relojVisible(t.tramos[0], 4500L))
    }
    @Test fun `todos los tipos conservan la base y reciben su extra Mancu`() {
        val ranking = com.osfit.app.domain.RankingResultado(1, emptyList())
        val todas = listOf(
        EscenaResumen.Saludo("Ana"),
        EscenaResumen.Asistencia("Semana", 3, 5, "semana", ranking),
        EscenaResumen.Tiempo(120, ranking),
        EscenaResumen.DiaFavorito("Pierna", "semana", 3),
        EscenaResumen.RachaMasLarga(3, ranking),
        EscenaResumen.Medalla("Premio", null, null, ""),
        EscenaResumen.LogrosPersonales(listOf(EscenaResumen.LogroEnEscena("Logro", null, ""))),
        EscenaResumen.Despedida
        )
        val base = TimelineResumen(todas)
        val mancu = TimelineResumen(todas, RitmosVideo.MANCU)
        assertEquals(listOf(4000L, 6000L, 8000L, 7000L, 5000L, 5900L, 7500L, 6000L),
        base.tramos.map { it.duracionMs })
        todas.indices.forEach { i ->
            assertEquals(base.tramos[i].duracionMs + if (i == todas.lastIndex) 1500L else 1000L,
            mancu.tramos[i].duracionMs)
        }
    }
}
