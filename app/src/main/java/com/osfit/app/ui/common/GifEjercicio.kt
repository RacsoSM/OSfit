package com.osfit.app.ui.common

import android.content.Context
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.GifDecoder
import coil.decode.ImageDecoderDecoder
import com.osfit.app.domain.NombresBanco

/**
 * Un solo cargador para toda la app: cada uno trae su propio caché, y uno por fila bajaría el
 * mismo GIF varias veces. Los GIF son WebP animados; desde Android 9 los anima
 * `ImageDecoderDecoder`. En Android 8 se ve el primer cuadro, que basta para reconocerlo.
 */
private var cargador: ImageLoader? = null

private fun cargadorDe(context: Context): ImageLoader =
    cargador ?: ImageLoader.Builder(context.applicationContext)
        .components {
            if (Build.VERSION.SDK_INT >= 28) add(ImageDecoderDecoder.Factory()) else add(GifDecoder.Factory())
        }
        .crossfade(true)
        .build()
        .also { cargador = it }

/**
 * El GIF de un ejercicio del banco en un cuadro blanco redondeado (las animaciones vienen sobre
 * blanco). Sin GIF muestra una pesa, como la web.
 */
@Composable
fun GifEjercicio(gifRuta: String?, lado: Dp, modifier: Modifier = Modifier) {
    val url = NombresBanco.urlGif(gifRuta)
    val forma = RoundedCornerShape(lado / 6)
    Box(
        modifier = modifier.size(lado).clip(forma).background(Color.White),
        contentAlignment = Alignment.Center
    ) {
        if (url == null) {
            Text("🏋️")
        } else {
            AsyncImage(
                model = url,
                contentDescription = null,
                imageLoader = cargadorDe(LocalContext.current),
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(lado)
            )
        }
    }
}
