package com.osfit.app.notificaciones

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging

/**
 * Los avisos que manda el servidor cuando una clienta toca "hoy no voy a poder ir" en la web.
 *
 * Es solo la parte de recibirlos: la app nunca manda notificaciones ni escribe nada aquí. La
 * verdad sobre el aviso sigue siendo el documento de `avisosFalta` que pinta el nombre de
 * amarillo en la lista; esto es un aviso encima, para enterarse sin tener la app abierta.
 */
object Notificaciones {

    /**
     * Tema de FCM al que se suscribe este teléfono.
     *
     * Un tema y no un token por dispositivo: los dos teléfonos que usan OSfit comparten
     * cuenta y quieren el mismo aviso, así que no hay nada que elegir ni tokens muertos que
     * limpiar en Firestore.
     *
     * GEMELO: `TEMA_ENTRENADOR` en `functions/src/avisarFalta.ts`. Si cambia uno, el otro
     * deja de recibir: el servidor publicaría en un tema al que nadie está suscrito.
     */
    private const val TEMA_ENTRENADOR = "entrenador"

    /**
     * Canal de Android donde caen los avisos.
     *
     * GEMELO: `CANAL_AVISOS` en `functions/src/avisarFalta.ts`. El servidor manda este id
     * dentro del mensaje, así que si los dos no coinciden la notificación no se muestra.
     */
    const val CANAL_AVISOS = "avisos_falta"

    /**
     * Crea el canal. Desde Android 8 una notificación sin canal registrado no se muestra, y
     * el mensaje puede llegar con la app cerrada, así que el canal tiene que existir desde
     * antes: se crea al arrancar, no al recibir. Volver a crearlo es inofensivo —Android lo
     * ignora si ya existe—, por eso se llama en cada arranque sin comprobar nada.
     */
    fun crearCanal(context: Context) {
        val canal = NotificationChannel(
            CANAL_AVISOS,
            "Avisos de falta",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Cuando una clienta avisa que hoy no va a poder ir."
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(canal)
    }

    /** Idempotente y cacheada por el SDK: se puede llamar en cada arranque sin coste. */
    fun suscribirAlTema() {
        FirebaseMessaging.getInstance().subscribeToTopic(TEMA_ENTRENADOR)
    }
}
