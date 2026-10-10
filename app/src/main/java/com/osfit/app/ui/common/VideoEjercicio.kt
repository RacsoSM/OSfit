package com.osfit.app.ui.common

import android.net.Uri
import android.widget.VideoView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.viewinterop.AndroidView
import com.osfit.app.domain.NombresBanco

/**
 * El ejercicio en grande: su video en bucle si lo tiene, si no su GIF ([GifEjercicio]).
 *
 * Con `VideoView` del sistema y no con una librería de video: es un clip corto, mudo y en
 * bucle, y no hace falta más. El GIF queda debajo hasta que el video arranca, para que no haya
 * un cuadro negro mientras carga. Sin sonido a propósito: es para ver el movimiento, y la app
 * no debe ponerse a sonar al abrir un ejercicio.
 */
@Composable
fun VideoEjercicio(gifRuta: String?, videoRuta: String?, lado: Dp, modifier: Modifier = Modifier) {
    val url = NombresBanco.urlVideo(videoRuta)
    if (url == null) {
        GifEjercicio(gifRuta, lado, modifier)
        return
    }
    var listo by remember(url) { mutableStateOf(false) }
    Box(
        modifier = modifier.size(lado).clip(RoundedCornerShape(lado / 12)).background(Color.White),
        contentAlignment = Alignment.Center
    ) {
        if (!listo) GifEjercicio(gifRuta, lado)
        AndroidView(
            factory = { context ->
                VideoView(context).apply {
                    setOnPreparedListener { mp ->
                        mp.isLooping = true
                        mp.setVolume(0f, 0f)
                        start()
                    }
                    // El primer cuadro ya pintado: hasta entonces se ve el GIF de debajo.
                    setOnInfoListener { _, que, _ ->
                        if (que == android.media.MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START) listo = true
                        false
                    }
                    // Si el video no carga (sin red), se queda el GIF y no sale el diálogo del sistema.
                    setOnErrorListener { _, _, _ -> true }
                    setVideoURI(Uri.parse(url))
                }
            },
            onRelease = { it.stopPlayback() },
            modifier = Modifier.size(lado)
        )
    }
}
