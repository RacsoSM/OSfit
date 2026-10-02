package com.osfit.app.video

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class GeometriaMancuTest {
    @Test fun `el eje conserva referencias aunque el tiempo sea bajo`() {
        assertEquals(120, GeometriaMancu.maximoGrafica(listOf(0, 45)))
        assertEquals(180, GeometriaMancu.maximoGrafica(listOf(180, 60)))
        assertEquals(1120f, GeometriaMancu.yGrafica(60, 120, 960f, 1280f), 0.001f)
        assertEquals("02/10", GeometriaMancu.fechaEje(LocalDate.of(2026, 10, 2)))
    }
    @Test fun `la dona mantiene proporciones y parte por el espacio mas cercano`() {
        assertEquals(270f, GeometriaMancu.barridoDona(3, 4), 0.001f)
        assertEquals(0f, GeometriaMancu.barridoDona(1, 0), 0f)
        assertEquals(listOf("Pierna", "(cuádriceps)"), GeometriaMancu.partirNombreDia("Pierna (cuádriceps)"))
        assertEquals(listOf("abcdefghijkl", "mn"), GeometriaMancu.partirNombreDia("abcdefghijklmn"))
        assertEquals(listOf("Espalda"), GeometriaMancu.partirNombreDia("Espalda"))
    }
    @Test fun `la sentadilla vuelve a su apoyo y la salida cabe en seis segundos`() {
        assertEquals(0f, GeometriaMancu.sentadilla(0), 0.001f)
        assertEquals(1f, GeometriaMancu.sentadilla(600), 0.001f)
        assertEquals(0f, GeometriaMancu.sentadilla(1200), 0.001f)
        assertEquals(0f, GeometriaMancu.salida(4500), 0f)
        assertEquals(1f, GeometriaMancu.salida(6000), 0f)
    }
}
