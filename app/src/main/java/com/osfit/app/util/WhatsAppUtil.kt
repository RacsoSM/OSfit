package com.osfit.app.util

import android.net.Uri
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio
import java.net.URLEncoder

object WhatsAppUtil {

    /** Dominio gratuito del proyecto. Si algún día hay dominio propio, se cambia solo acá. */
    private const val DOMINIO_WEB = "https://osfit-cccfe.web.app"

    fun urlAccesoWeb(token: String): String = "$DOMINIO_WEB/c/$token"

    fun crearUriAccesoWeb(telefono: String, nombreCliente: String, token: String): Uri {
        val numero = normalizarTelefonoMx(telefono)
        val mensaje = "Hola, *$nombreCliente*, aqui tienes tu acceso personal a OSfit. " +
            "Ahi puedes ver el dia que te toca, tu calendario de asistencias, tu racha y tus " +
            "logros:\n\n${urlAccesoWeb(token)}\n\nEs solo tuyo, no lo compartas."
        val mensajeCodificado = URLEncoder.encode(mensaje, "UTF-8")
        return Uri.parse("https://wa.me/$numero?text=$mensajeCodificado")
    }

    fun normalizarTelefonoMx(telefono: String): String {
        val soloDigitos = telefono.filter { it.isDigit() }
        return if (soloDigitos.length == 10) "52$soloDigitos" else soloDigitos
    }

    fun crearUriRecordatorioPago(telefono: String, nombreCliente: String, fechaProximoPago: String): Uri {
        val numero = normalizarTelefonoMx(telefono)
        val mensaje = "Hola, *$nombreCliente*, este es un mensaje automatizado para recordarte que tu fecha de pago esta proxima, " +
            "tu fecha de pago es el *$fechaProximoPago*, ¡muchas gracias!"
        val mensajeCodificado = URLEncoder.encode(mensaje, "UTF-8")
        return Uri.parse("https://wa.me/$numero?text=$mensajeCodificado")
    }

    fun crearUriConfirmarAsistencia(telefono: String, nombreCliente: String): Uri {
        val numero = normalizarTelefonoMx(telefono)
        val mensaje = "Hola, *$nombreCliente*, este es un mensaje automatizado para preguntarte si tienes pensado asistir hoy " +
            "a nuestro poderoso *Focus*, saludos"
        val mensajeCodificado = URLEncoder.encode(mensaje, "UTF-8")
        return Uri.parse("https://wa.me/$numero?text=$mensajeCodificado")
    }

    fun crearUriEnviarRutinaDelDia(
        telefono: String,
        nombreCliente: String,
        dia: DiaRutina,
        ejercicios: List<Ejercicio>
    ): Uri {
        val numero = normalizarTelefonoMx(telefono)
        val mensaje = formatearMensajeRutinaDelDia(nombreCliente, dia, ejercicios)
        val mensajeCodificado = URLEncoder.encode(mensaje, "UTF-8")
        return Uri.parse("https://wa.me/$numero?text=$mensajeCodificado")
    }

    /**
     * Recibe los ejercicios ya resueltos en vez de sacarlos de [dia].
     *
     * Leer `dia.ejercicios` aquí dejaba el mensaje **vacío** en cuanto el día tenía variaciones:
     * el invariante de `DiaRutina` vacía esa lista y la buena pasa a ser `variaciones[n]`. Y
     * además hay que elegir *cuál* variación toca y aplicarle los pesos propios de la clienta,
     * dos cosas que dependen de su historial y que este util no conoce ni debe conocer.
     */
    fun formatearMensajeRutinaDelDia(
        nombreCliente: String,
        dia: DiaRutina,
        ejerciciosDelDia: List<Ejercicio>
    ): String {
        val encabezado = "Hola, *$nombreCliente*, hoy te toca *${dia.nombreDia}*:\n\n"
        val ejercicios = ejerciciosDelDia.mapIndexed { indice, ejercicio ->
            buildString {
                append("${indice + 1}. ${ejercicio.nombre} — ${ejercicio.series} series x ${ejercicio.repeticiones}")
                if (ejercicio.pesoONota.isNotBlank()) append(" (${ejercicio.pesoONota})")
            }
        }.joinToString(separator = "\n")
        return "$encabezado$ejercicios\n\n¡Nos vemos en el gym!"
    }
}
