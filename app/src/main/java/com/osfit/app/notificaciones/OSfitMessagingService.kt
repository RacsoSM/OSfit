package com.osfit.app.notificaciones

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.osfit.app.MainActivity
import com.osfit.app.R

/**
 * Muestra el aviso cuando llega con la app **abierta**.
 *
 * Con la app cerrada o en segundo plano no hace falta nada de esto: el propio SDK de Firebase
 * arma la notificación desde el mensaje y la deja en la barra. Pero en primer plano el SDK no
 * muestra nada —entrega el mensaje aquí y se desentiende—, así que sin este servicio el aviso
 * se perdería justo cuando el entrenador tiene la app en la mano.
 *
 * No hay `onNewToken`: al ir por tema y no por token, FCM mantiene la suscripción por su
 * cuenta cuando el token se renueva.
 */
class OSfitMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val aviso = message.notification ?: return

        // Sin el permiso, `notify` no hace nada. Se comprueba para salir sin ruido en vez de
        // fingir que se mostró algo.
        val permitido = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        if (!permitido) return

        // Abrir la app y ya: el aviso no lleva a ninguna pantalla concreta, solo avisa. El
        // nombre en amarillo de la lista es lo que de verdad hay que mirar.
        val abrirApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificacion = NotificationCompat.Builder(this, Notificaciones.CANAL_AVISOS)
            .setSmallIcon(R.drawable.ic_notificacion)
            .setContentTitle(aviso.title)
            .setContentText(aviso.body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(abrirApp)
            .build()

        // Id distinto en cada aviso para que dos clientas que avisan seguido se vean las dos:
        // con un id fijo la segunda pisaría a la primera y solo quedaría un nombre a la vista.
        val id = (System.currentTimeMillis() and 0xFFFFFF).toInt()
        NotificationManagerCompat.from(this).notify(id, notificacion)
    }
}
