package com.osfit.app.video

import com.osfit.app.domain.RankingResultado
import org.junit.Assert.assertEquals
import org.junit.Test

class TextosEscenaTest {
    @Test fun `las frases fijas conservan su redaccion`() {
        assertEquals("Hola, ", TextosEscena.SALUDO_PREFIJO)
        assertEquals("Gracias por confiar en nosotros", TextosEscena.DESPEDIDA)
        assertEquals("Estuviste en el poderoso Focus un total de", TextosEscena.TIEMPO_PREFIJO)
        assertEquals("Tu racha más larga fue de", TextosEscena.RACHA_PREFIJO)
        assertEquals("¡Felicidades! Te ganaste:", TextosEscena.MEDALLA_PREFIJO)
        assertEquals("Y contra ti mismo, lograste:", TextosEscena.LOGROS_PREFIJO)
        assertEquals("Logros grupales", TextosEscena.TITULO_GRUPAL)
        assertEquals("Logros personales", TextosEscena.TITULO_PERSONAL)
        assertEquals("¡Vas primero en tiempo asistido!", TextosEscena.TIEMPO_PRIMERO)
        assertEquals("¡Vas primero en racha este mes!", TextosEscena.RACHA_PRIMERO)
        assertEquals("tiempo asistido", TextosEscena.TIEMPO_LUGAR)
        assertEquals("racha", TextosEscena.RACHA_LUGAR)
    }
    @Test fun `los determinantes respetan el genero y las mayusculas`() {
        assertEquals("este", TextosEscena.determinante("mes"))
        assertEquals("Este", TextosEscena.determinante("mes", true))
        assertEquals("esta", TextosEscena.determinante("quincena"))
        assertEquals("Esta", TextosEscena.determinante("quincena", true))
        assertEquals("Esta", TextosEscena.determinante("semana", true))
    }
    @Test fun `asistencia y duraciones mantienen sus espacios y unidades`() {
        val escena = EscenaResumen.Asistencia("rango", 9, 10, "quincena", RankingResultado(1, emptyList()))
        assertEquals("Esta quincena asististe ", TextosEscena.asistenciaPrefijo(escena))
        assertEquals("Este mes asististe ", TextosEscena.asistenciaPrefijo(escena.copy(unidad = "mes")))
        assertEquals("9 días", TextosEscena.asistenciaDias(escena))
        assertEquals(" de 10 días hábiles", TextosEscena.asistenciaSufijo(escena))
        assertEquals("2h 5min", TextosEscena.tiempoDuracion(125))
        assertEquals("0h 0min", TextosEscena.tiempoDuracion(0))
        assertEquals("9 días seguidos", TextosEscena.rachaDias(9))
    }
    @Test fun `la comparacion conserva el primer lugar y los nombres por encima`() {
        assertEquals("¡Vas primero en tiempo asistido!", TextosEscena.comparacion(RankingResultado(1, emptyList()), TextosEscena.TIEMPO_PRIMERO, TextosEscena.TIEMPO_LUGAR))
        assertEquals("¡Vas primero en racha este mes!", TextosEscena.comparacion(RankingResultado(1, emptyList()), TextosEscena.RACHA_PRIMERO, TextosEscena.RACHA_LUGAR))
        assertEquals("Estás en el lugar 3 de tiempo asistido, solamente detrás de: A, B", TextosEscena.comparacion(RankingResultado(3, listOf("A", "B")), TextosEscena.TIEMPO_PRIMERO, TextosEscena.TIEMPO_LUGAR))
    }
    @Test fun `dia favorito conserva sus tres variantes`() {
        assertEquals("Tu día favorito fue Pierna", TextosEscena.mensajeDiaFavorito(EscenaResumen.DiaFavorito("Pierna", "quincena", 9)))
        assertEquals("Esta quincena no viniste, ¡te esperamos la próxima!", TextosEscena.mensajeDiaFavorito(EscenaResumen.DiaFavorito(null, "quincena", 0)))
        assertEquals("Este mes no viniste, ¡te esperamos la próxima!", TextosEscena.mensajeDiaFavorito(EscenaResumen.DiaFavorito(null, "mes", 0)))
        assertEquals("¡Sigue registrando tu día de rutina para descubrir cuál es tu favorito!", TextosEscena.mensajeDiaFavorito(EscenaResumen.DiaFavorito(null, "quincena", 9)))
    }
}
