package com.osfit.app.video

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import android.view.Surface
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private data class MuestraCodificada(val datos: ByteArray, val info: MediaCodec.BufferInfo)
private data class PistaCodificada(val formato: MediaFormat, val muestras: List<MuestraCodificada>)
private data class Pcm(val datos: ShortArray, val sampleRate: Int, val canales: Int)

/** Acumulador de PCM de 16 bits que crece sin encajonar cada muestra en un `Short`. */
private class AcumuladorPcm(capacidadInicial: Int = 1 shl 16) {
    private var datos = ShortArray(capacidadInicial)
    var tam: Int = 0
        private set

    fun agregar(origen: ShortArray, cantidad: Int) {
        if (cantidad <= 0) return
        if (tam + cantidad > datos.size) {
            var nuevaCapacidad = datos.size
            while (nuevaCapacidad < tam + cantidad) nuevaCapacidad *= 2
            datos = datos.copyOf(nuevaCapacidad)
        }
        System.arraycopy(origen, 0, datos, tam, cantidad)
        tam += cantidad
    }

    fun compactar(): ShortArray = datos.copyOf(tam)
}

/**
 * Codifica una lista de tarjetas (bitmaps fijos) como un video mp4: cada tarjeta se
 * mantiene [segundosPorTarjeta] segundos, con una pista de audio opcional (música de
 * fondo transcodificada a AAC) si `res/raw/resumen_musica.*` existe.
 *
 * Los timestamps de video se asignan manualmente por índice de tarjeta (no hay pacing
 * en tiempo real): la tarjeta `i` se presenta en `i * segundosPorTarjeta` segundos.
 */
object ResumenVideoEncoder {

    private const val TAG = "ResumenVideoEncoder"
    private const val ANCHO = 1080
    private const val ALTO = 1920
    private const val BIT_RATE_VIDEO = 4_000_000
    private const val BIT_RATE_AUDIO = 128_000
    private const val TIMEOUT_US = 10_000L
    private const val MUESTRAS_POR_FRAME_AAC = 1024

    suspend fun generar(
        tarjetas: List<Bitmap>,
        segundosPorTarjeta: Int,
        context: Context,
        salida: File
    ) = withContext(Dispatchers.Default) {
        require(tarjetas.isNotEmpty()) { "Debe haber al menos una tarjeta" }
        require(segundosPorTarjeta > 0) { "segundosPorTarjeta debe ser positivo" }
        val duracionTotalUs = tarjetas.size.toLong() * segundosPorTarjeta * 1_000_000L

        val pistaVideo = codificarVideo(tarjetas, segundosPorTarjeta)

        // El audio es opcional: si el recurso no existe o falla la transcodificación,
        // se genera el video sin música en vez de abortar todo.
        val pistaAudio = obtenerResIdMusica(context)?.let { resId ->
            runCatching { codificarAudioDesdeRecurso(context, resId, duracionTotalUs) }
                .onFailure { Log.w(TAG, "No se pudo transcodificar la música de fondo", it) }
                .getOrNull()
        }?.takeIf { it.muestras.isNotEmpty() }

        salida.parentFile?.mkdirs()
        val muxer = MediaMuxer(salida.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        try {
            // Ambas pistas se agregan ANTES del único start(); writeSampleData sólo después.
            val indiceVideo = muxer.addTrack(pistaVideo.formato)
            val indiceAudio = pistaAudio?.let { muxer.addTrack(it.formato) }
            muxer.start()
            pistaVideo.muestras.forEach {
                muxer.writeSampleData(indiceVideo, ByteBuffer.wrap(it.datos), it.info)
            }
            if (pistaAudio != null && indiceAudio != null) {
                pistaAudio.muestras.forEach {
                    muxer.writeSampleData(indiceAudio, ByteBuffer.wrap(it.datos), it.info)
                }
            }
            muxer.stop()
        } finally {
            muxer.release()
        }
    }

    /**
     * Busca `res/raw/resumen_musica.*` por nombre en vez de una referencia R.raw en
     * tiempo de compilación, para que el proyecto compile con o sin el archivo puesto.
     */
    fun obtenerResIdMusica(context: Context): Int? {
        val id = context.resources.getIdentifier("resumen_musica", "raw", context.packageName)
        return if (id != 0) id else null
    }

    // ---------------------------------------------------------------- video

    private fun codificarVideo(tarjetas: List<Bitmap>, segundosPorTarjeta: Int): PistaCodificada {
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, ANCHO, ALTO).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE_VIDEO)
            setInteger(MediaFormat.KEY_FRAME_RATE, 1)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
        }
        // La construcción/configure/start también van dentro del try: un MediaCodec que
        // se fuga bloquea el codificador de hardware para todo el dispositivo hasta que
        // muere el proceso.
        var encoder: MediaCodec? = null
        var surface: Surface? = null

        val duracionFrameUs = segundosPorTarjeta * 1_000_000L
        var salidaFormato: MediaFormat? = null
        val muestras = mutableListOf<MuestraCodificada>()
        val bufferInfo = MediaCodec.BufferInfo()
        // Cuenta sólo muestras reales escritas (los buffers de codec-config y el EOS
        // vacío no cuentan), de modo que pts = indiceMuestra * duracionFrameUs.
        var indiceMuestra = 0

        fun drenar(enc: MediaCodec, finalDeFlujo: Boolean) {
            if (finalDeFlujo) enc.signalEndOfInputStream()
            while (true) {
                val indiceSalida = enc.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)
                when {
                    indiceSalida == MediaCodec.INFO_TRY_AGAIN_LATER -> if (!finalDeFlujo) return
                    indiceSalida == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        salidaFormato = enc.outputFormat
                    }
                    indiceSalida >= 0 -> {
                        val esCodecConfig =
                            bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
                        // El csd (SPS/PPS) viaja en el MediaFormat de salida; MediaMuxer
                        // no debe recibirlo como muestra ni debe consumir un índice de pts.
                        if (bufferInfo.size > 0 && !esCodecConfig) {
                            val buffer = enc.getOutputBuffer(indiceSalida)!!
                            buffer.position(bufferInfo.offset)
                            buffer.limit(bufferInfo.offset + bufferInfo.size)
                            val datos = ByteArray(bufferInfo.size)
                            buffer.get(datos)
                            val pts = indiceMuestra * duracionFrameUs
                            indiceMuestra++
                            val flagsMuxer = bufferInfo.flags and
                                (MediaCodec.BUFFER_FLAG_CODEC_CONFIG or
                                    MediaCodec.BUFFER_FLAG_END_OF_STREAM).inv()
                            muestras.add(
                                MuestraCodificada(
                                    datos,
                                    MediaCodec.BufferInfo().apply {
                                        set(0, datos.size, pts, flagsMuxer)
                                    }
                                )
                            )
                        }
                        enc.releaseOutputBuffer(indiceSalida, false)
                        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
                    }
                }
            }
        }

        try {
            val enc = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
            encoder = enc
            enc.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            val sfc = enc.createInputSurface()
            surface = sfc
            enc.start()

            tarjetas.forEach { bitmap ->
                val canvas = sfc.lockCanvas(null)
                try {
                    canvas.drawBitmap(bitmap, 0f, 0f, null)
                } finally {
                    sfc.unlockCanvasAndPost(canvas)
                }
                drenar(enc, finalDeFlujo = false)
            }
            drenar(enc, finalDeFlujo = true)
        } finally {
            encoder?.let {
                runCatching { it.stop() }
                it.release()
            }
            surface?.release()
        }

        val formatoFinal = checkNotNull(salidaFormato) {
            "El codificador de video nunca entregó su MediaFormat de salida (falta el csd)"
        }
        check(muestras.isNotEmpty()) { "El codificador de video no produjo ninguna muestra" }
        return PistaCodificada(formatoFinal, muestras)
    }

    // ---------------------------------------------------------------- audio

    private fun codificarAudioDesdeRecurso(
        context: Context,
        resId: Int,
        duracionObjetivoUs: Long
    ): PistaCodificada? {
        val pcm = decodificarAPcm(context, resId, duracionObjetivoUs)
        if (pcm.datos.isEmpty()) return null
        val pcmLoop = repetirHastaDuracion(pcm, duracionObjetivoUs)
        if (pcmLoop.datos.isEmpty()) return null
        return codificarPcmAAac(pcmLoop)
    }

    /**
     * Decodifica el recurso a PCM 16 bits. Deja de decodificar en cuanto tiene suficiente
     * material para [duracionObjetivoUs] (evita cargar en memoria pistas muy largas).
     */
    private fun decodificarAPcm(context: Context, resId: Int, duracionObjetivoUs: Long): Pcm {
        val afd = context.resources.openRawResourceFd(resId)
            ?: error("El recurso de música no se puede abrir como fd (¿está comprimido?)")
        val extractor = MediaExtractor()
        // El decodificador se construye DENTRO del try: si configure()/start() lanza,
        // el finally igual libera extractor y códec (un MediaCodec fugado bloquea el
        // hardware para todo el dispositivo hasta que muere el proceso).
        var decoder: MediaCodec? = null
        val acumulador = AcumuladorPcm()
        var sampleRate = 0
        var canales = 0

        try {
            try {
                extractor.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            } finally {
                afd.close()
            }

            var trackIndex = -1
            var format: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val f = extractor.getTrackFormat(i)
                if (f.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                    trackIndex = i
                    format = f
                    break
                }
            }
            val formatoEntrada =
                requireNotNull(format) { "El archivo de música no tiene pista de audio" }
            extractor.selectTrack(trackIndex)

            sampleRate = formatoEntrada.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            canales = formatoEntrada.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            val mime = formatoEntrada.getString(MediaFormat.KEY_MIME)!!

            val dec = MediaCodec.createDecoderByType(mime)
            decoder = dec
            dec.configure(formatoEntrada, null, null, 0)
            dec.start()

            val bufferInfo = MediaCodec.BufferInfo()
            var entradaTerminada = false
            var salidaTerminada = false
            var suficiente = false

            while (!salidaTerminada) {
                if (!entradaTerminada) {
                    val indiceEntrada = dec.dequeueInputBuffer(TIMEOUT_US)
                    if (indiceEntrada >= 0) {
                        val buffer = dec.getInputBuffer(indiceEntrada)!!
                        buffer.clear()
                        val tam = if (suficiente) -1 else extractor.readSampleData(buffer, 0)
                        if (tam < 0) {
                            dec.queueInputBuffer(
                                indiceEntrada, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM
                            )
                            entradaTerminada = true
                        } else {
                            dec.queueInputBuffer(indiceEntrada, 0, tam, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }
                val indiceSalida = dec.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)
                when {
                    indiceSalida == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        // El PCM real puede diferir del formato del contenedor.
                        val fSalida = dec.outputFormat
                        if (fSalida.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
                            sampleRate = fSalida.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        }
                        if (fSalida.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
                            canales = fSalida.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        }
                    }
                    indiceSalida >= 0 -> {
                        if (bufferInfo.size > 0) {
                            val buffer = dec.getOutputBuffer(indiceSalida)!!
                            buffer.position(bufferInfo.offset)
                            buffer.limit(bufferInfo.offset + bufferInfo.size)
                            // Los buffers de MediaCodec son PCM 16 bits en orden nativo.
                            val shortBuffer = buffer.order(ByteOrder.nativeOrder()).asShortBuffer()
                            val temp = ShortArray(shortBuffer.remaining())
                            shortBuffer.get(temp)
                            acumulador.agregar(temp, temp.size)
                        }
                        dec.releaseOutputBuffer(indiceSalida, false)
                        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                            salidaTerminada = true
                        }
                        val objetivo = muestrasParaDuracion(duracionObjetivoUs, sampleRate, canales)
                        if (acumulador.tam >= objetivo) suficiente = true
                    }
                }
            }
        } finally {
            decoder?.let {
                runCatching { it.stop() }
                it.release()
            }
            extractor.release()
        }

        return Pcm(acumulador.compactar(), sampleRate, canales)
    }

    /** Número de `short` (muestras intercaladas) que cubren [duracionUs]. */
    private fun muestrasParaDuracion(duracionUs: Long, sampleRate: Int, canales: Int): Int {
        val porCanal = duracionUs * sampleRate / 1_000_000L
        return (porCanal * canales).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
    }

    private fun repetirHastaDuracion(pcm: Pcm, duracionObjetivoUs: Long): Pcm {
        if (pcm.datos.isEmpty()) return pcm
        var muestrasObjetivo = muestrasParaDuracion(duracionObjetivoUs, pcm.sampleRate, pcm.canales)
        // Alinear a frame completo para no desfasar los canales.
        muestrasObjetivo -= muestrasObjetivo % pcm.canales
        if (muestrasObjetivo <= 0) return Pcm(ShortArray(0), pcm.sampleRate, pcm.canales)
        val resultado = ShortArray(muestrasObjetivo)
        var i = 0
        while (i < muestrasObjetivo) {
            val copiar = minOf(muestrasObjetivo - i, pcm.datos.size)
            System.arraycopy(pcm.datos, 0, resultado, i, copiar)
            i += copiar
        }
        return Pcm(resultado, pcm.sampleRate, pcm.canales)
    }

    private fun codificarPcmAAac(pcm: Pcm): PistaCodificada {
        val format = MediaFormat.createAudioFormat(
            MediaFormat.MIMETYPE_AUDIO_AAC, pcm.sampleRate, pcm.canales
        ).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE_AUDIO)
        }
        // Igual que en video: construir/configurar/arrancar dentro del try para no
        // fugar el códec si algo de eso lanza.
        var encoder: MediaCodec? = null

        val bufferInfo = MediaCodec.BufferInfo()
        var salidaFormato: MediaFormat? = null
        val muestras = mutableListOf<MuestraCodificada>()

        val bytesPcm = ByteArray(pcm.datos.size * 2)
        ByteBuffer.wrap(bytesPcm).order(ByteOrder.nativeOrder()).asShortBuffer().put(pcm.datos)

        val bytesPorMuestra = pcm.canales * 2
        val bytesPorFrame = MUESTRAS_POR_FRAME_AAC * bytesPorMuestra
        var offset = 0
        // pts derivado del total de muestras enviadas (evita la deriva de dividir
        // 1_000_000 * 1024 / sampleRate con enteros en cada frame).
        var muestrasPorCanalEnviadas = 0L
        var entradaTerminada = false
        // Se marca en cuanto se ve el buffer de salida con EOS, en CUALQUIER llamada a
        // drenar(). Sin esta bandera, si un drenar(false) alcanzara a consumir el EOS,
        // el drenar(true) posterior giraría para siempre sobre INFO_TRY_AGAIN_LATER.
        var salidaTerminada = false

        fun ptsActual(): Long = muestrasPorCanalEnviadas * 1_000_000L / pcm.sampleRate

        fun drenar(enc: MediaCodec, finalDeFlujo: Boolean) {
            if (salidaTerminada) return
            while (true) {
                val indiceSalida = enc.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)
                when {
                    indiceSalida == MediaCodec.INFO_TRY_AGAIN_LATER -> if (!finalDeFlujo) return
                    indiceSalida == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        salidaFormato = enc.outputFormat
                    }
                    indiceSalida >= 0 -> {
                        val esCodecConfig =
                            bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
                        if (bufferInfo.size > 0 && !esCodecConfig) {
                            val buffer = enc.getOutputBuffer(indiceSalida)!!
                            buffer.position(bufferInfo.offset)
                            buffer.limit(bufferInfo.offset + bufferInfo.size)
                            val datos = ByteArray(bufferInfo.size)
                            buffer.get(datos)
                            val flagsMuxer = bufferInfo.flags and
                                (MediaCodec.BUFFER_FLAG_CODEC_CONFIG or
                                    MediaCodec.BUFFER_FLAG_END_OF_STREAM).inv()
                            muestras.add(
                                MuestraCodificada(
                                    datos,
                                    MediaCodec.BufferInfo().apply {
                                        set(0, datos.size, bufferInfo.presentationTimeUs, flagsMuxer)
                                    }
                                )
                            )
                        }
                        enc.releaseOutputBuffer(indiceSalida, false)
                        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                            salidaTerminada = true
                            return
                        }
                    }
                }
            }
        }

        try {
            val enc = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
            encoder = enc
            enc.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            enc.start()

            while (!entradaTerminada) {
                val indiceEntrada = enc.dequeueInputBuffer(TIMEOUT_US)
                if (indiceEntrada >= 0) {
                    val buffer = enc.getInputBuffer(indiceEntrada)!!
                    buffer.clear()
                    val restante = bytesPcm.size - offset
                    if (restante <= 0) {
                        enc.queueInputBuffer(
                            indiceEntrada, 0, 0, ptsActual(), MediaCodec.BUFFER_FLAG_END_OF_STREAM
                        )
                        entradaTerminada = true
                    } else {
                        // Recortar a un número entero de frames de audio: si `offset`
                        // cayera a mitad de una muestra, los canales quedarían invertidos
                        // para todo el resto de la pista y el pts se desfasaría.
                        val bruto = minOf(bytesPorFrame, restante, buffer.remaining())
                        val tam = bruto - bruto % bytesPorMuestra
                        check(tam > 0) {
                            "El buffer de entrada del codificador AAC ($bruto B) no alcanza " +
                                "para una muestra de $bytesPorMuestra B"
                        }
                        buffer.put(bytesPcm, offset, tam)
                        enc.queueInputBuffer(indiceEntrada, 0, tam, ptsActual(), 0)
                        offset += tam
                        muestrasPorCanalEnviadas += (tam / bytesPorMuestra).toLong()
                    }
                }
                // Sólo se drena mientras aún queda entrada por alimentar. Una vez que se
                // encoló el EOS de entrada, el único drenaje es el final: así ninguna
                // llamada con finalDeFlujo=false puede robarse el EOS de salida.
                if (!entradaTerminada) drenar(enc, finalDeFlujo = false)
            }
            drenar(enc, finalDeFlujo = true)
        } finally {
            encoder?.let {
                runCatching { it.stop() }
                it.release()
            }
        }

        val formatoFinal = checkNotNull(salidaFormato) {
            "El codificador AAC nunca entregó su MediaFormat de salida (falta el csd)"
        }
        return PistaCodificada(formatoFinal, muestras)
    }
}
