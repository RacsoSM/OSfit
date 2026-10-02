package com.osfit.app.video

import org.junit.Assert.*
import org.junit.Test

class AccionesMancuTest {
    @Test fun `las acciones ciclicas repiten todos sus parametros`() {
        val periodos = mapOf(AccionMancu.SALUDAR to 400L, AccionMancu.APLAUDIR to 450L,
            AccionMancu.TIJERAS to 700L, AccionMancu.BAILAR to 900L, AccionMancu.MUSCULO to 600L,
            AccionMancu.PULGAR to 700L, AccionMancu.ESTIRARSE to 1800L, AccionMancu.CORRER_SITIO to 360L)
        for ((accion, periodo) in periodos) for (t in -100L..1000L step 37L)
            assertEquals(AccionesMancu.cuadro(accion, t), AccionesMancu.cuadro(accion, t + periodo))
    }
    @Test fun `los parametros permanecen dentro de sus rangos`() {
        for (accion in AccionMancu.values()) for (t in -100L..2000L step 11L) {
            val c = AccionesMancu.cuadro(accion, t)
            assertTrue(c.anguloBrazoIzq in -180f..180f && c.anguloBrazoDer in -180f..180f)
            assertTrue(c.codoIzq in -1f..1f && c.codoDer in -1f..1f)
            assertTrue(c.piernasAbiertas in 0f..1f && c.impacto in 0f..1f)
            assertTrue(c.escalaY > 0f && c.alturaPx >= 0f)
        }
    }
    @Test fun `la voltereta completa la vuelta en el vuelo y termina en reposo`() {
        for (t in listOf(-1L, 0L, 900L, 901L)) {
            val c = AccionesMancu.cuadro(AccionMancu.VOLTERETA, t)
            assertEquals(0f, c.rotacion, 0f); assertEquals(0f, c.alturaPx, 0f)
        }
        assertEquals(180f, AccionesMancu.cuadro(AccionMancu.VOLTERETA, 440).rotacion, 0.01f)
        assertEquals(220f, AccionesMancu.cuadro(AccionMancu.VOLTERETA, 440).alturaPx, 0.01f)
        assertEquals(360f, AccionesMancu.cuadro(AccionMancu.VOLTERETA, 699).rotacion, 0f)
        assertTrue(AccionesMancu.cuadro(AccionMancu.VOLTERETA, 700).escalaY < 1f)
    }
    @Test fun `las tijeras abren brazos y piernas juntos`() {
        for (t in 0L..700L step 10L) {
            val c = AccionesMancu.cuadro(AccionMancu.TIJERAS, t)
            val izquierdo = if (c.anguloBrazoIzq < 0f) c.anguloBrazoIzq + 360f else c.anguloBrazoIzq
            assertEquals(150f + 100f * c.piernasAbiertas, izquierdo, 0.001f)
            assertEquals(30f - 100f * c.piernasAbiertas, c.anguloBrazoDer, 0.001f)
        }
        assertEquals(0f, AccionesMancu.cuadro(AccionMancu.TIJERAS, 0).piernasAbiertas, 0f)
        assertEquals(1f, AccionesMancu.cuadro(AccionMancu.TIJERAS, 350).piernasAbiertas, 0f)
        assertEquals(30f, AccionesMancu.cuadro(AccionMancu.TIJERAS, 350).alturaPx, 0.01f)
    }
    @Test fun `el aplauso alcanza su impacto al tocarse los guantes`() {
        val c = AccionesMancu.cuadro(AccionMancu.APLAUDIR, 225)
        assertEquals(0f, c.anguloBrazoIzq, 0f)
        assertEquals(180f, c.anguloBrazoDer, 0f)
        assertEquals(1f, c.impacto, 0f)
        assertEquals(0f, AccionesMancu.cuadro(AccionMancu.APLAUDIR, 0).impacto, 0f)
    }
    @Test fun `el reloj cambia a sonrisa a los novecientos milisegundos`() {
        assertEquals(Boca.O, AccionesMancu.cuadro(AccionMancu.RELOJ, 899).boca)
        assertEquals(Boca.SONRISA, AccionesMancu.cuadro(AccionMancu.RELOJ, 900).boca)
        assertTrue(AccionesMancu.cuadro(AccionMancu.RELOJ, 1200).reloj)
    }
}
