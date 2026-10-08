package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Notificacion
import org.junit.Assert.assertEquals
import org.junit.Test

class AvisosTest {

    private fun c(id: String, habilitada: Boolean = true, activo: Boolean = true) =
        Cliente(id = id, nombre = id, activo = activo, notificacionesWeb = habilitada)

    @Test
    fun `todas son las habilitadas y activas`() {
        val r = Avisos.destinatarias(listOf(c("a"), c("b", habilitada = false), c("x", activo = false)), null)
        assertEquals(listOf("a"), r.map { it.id })
    }

    @Test
    fun `elegir a una clienta no habilitada no la incluye`() {
        val r = Avisos.destinatarias(listOf(c("a"), c("b", habilitada = false)), setOf("a", "b"))
        assertEquals(listOf("a"), r.map { it.id })
    }

    @Test
    fun `el resumen dice en que va el envio`() {
        assertEquals("Enviando…", Avisos.resumen(Notificacion(estado = Notificacion.ESTADO_PENDIENTE)))
        assertEquals("Enviando…", Avisos.resumen(Notificacion(estado = Notificacion.ESTADO_ENVIANDO)))
        assertEquals("No se pudo enviar", Avisos.resumen(Notificacion(estado = Notificacion.ESTADO_ERROR)))
        assertEquals("Llegó a 1 teléfono", Avisos.resumen(Notificacion(estado = "enviada", enviadas = 1)))
        assertEquals(
            "Llegó a 6 teléfonos · 1 falló",
            Avisos.resumen(Notificacion(estado = "enviada", enviadas = 6, fallidas = 1))
        )
        assertEquals("Nadie tenía las notificaciones activadas", Avisos.resumen(Notificacion(estado = "enviada")))
    }
}
