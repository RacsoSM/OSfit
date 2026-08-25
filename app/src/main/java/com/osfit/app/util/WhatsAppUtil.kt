package com.osfit.app.util

import android.net.Uri
import com.osfit.app.data.model.DiaRutina
import java.net.URLEncoder

object WhatsAppUtil {

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

    fun crearUriEnviarRutinaDelDia(telefono: String, nombreCliente: String, dia: DiaRutina): Uri {
        val numero = normalizarTelefonoMx(telefono)
        val mensaje = formatearMensajeRutinaDelDia(nombreCliente, dia)
        val mensajeCodificado = URLEncoder.encode(mensaje, "UTF-8")
        return Uri.parse("https://wa.me/$numero?text=$mensajeCodificado")
    }

    fun formatearMensajeRutinaDelDia(nombreCliente: String, dia: DiaRutina): String {
        val encabezado = "Hola, *$nombreCliente*, hoy te toca *${dia.nombreDia}*:\n\n"
        val ejercicios = dia.ejercicios.mapIndexed { indice, ejercicio ->
            buildString {
                append("${indice + 1}. ${ejercicio.nombre} — ${ejercicio.series} series x ${ejercicio.repeticiones}")
                if (ejercicio.pesoONota.isNotBlank()) append(" (${ejercicio.pesoONota})")
            }
        }.joinToString(separator = "\n")
        return "$encabezado$ejercicios\n\n¡Nos vemos en el gym!"
    }
}
