package com.osfit.app.domain

import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Notificacion

object Avisos {

    /**
     * Los textos de los botones rápidos. Llenan el campo, no envían: así "más tarde" se
     * completa con la hora antes de mandar, y nada sale por un toque accidental.
     */
    val RAPIDOS = listOf(
        "¡Ya llegamos! Los esperamos 💪",
        "Ya nos fuimos. ¡Nos vemos la próxima!",
        "Hoy llegaremos más tarde, a las "
    )

    /** GEMELO: `LARGO_MAXIMO_TEXTO` en `functions/src/notificaciones.ts`. */
    const val LARGO_MAXIMO = 500

    /**
     * A quién le va a llegar, para decirlo antes de enviar. `elegidos == null` es "todas".
     *
     * GEMELO: `destinatarias` en `functions/src/notificaciones.ts`, que es la que manda de
     * verdad. Si estas dos difieren, el número que ve el entrenador miente.
     */
    fun destinatarias(clientes: List<Cliente>, elegidos: Set<String>?): List<Cliente> =
        clientes.filter { it.activo && it.notificacionesWeb && (elegidos == null || it.id in elegidos) }

    fun resumen(n: Notificacion): String = when (n.estado) {
        Notificacion.ESTADO_PENDIENTE, Notificacion.ESTADO_ENVIANDO -> "Enviando…"
        Notificacion.ESTADO_ERROR -> "No se pudo enviar"
        else -> when {
            n.enviadas == 0 && n.fallidas == 0 -> "Nadie tenía las notificaciones activadas"
            else -> buildString {
                append("Llegó a ${n.enviadas} ${if (n.enviadas == 1) "teléfono" else "teléfonos"}")
                if (n.fallidas > 0) append(" · ${n.fallidas} ${if (n.fallidas == 1) "falló" else "fallaron"}")
            }
        }
    }
}
