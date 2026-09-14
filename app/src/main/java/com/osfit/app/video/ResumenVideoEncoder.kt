package com.osfit.app.video

import android.content.Context
import android.graphics.Canvas
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
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
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
 * Codifica un video mp4 haciendo que `dibujarFrame` pinte cada instante directamente sobre
 * el canvas de la Surface de entrada del codificador: se generan
 * `duracionTotalMs * fps / 1000` frames, con una pista de audio opcional (música de fondo
 * transcodificada a AAC) si `res/raw/resumen_musica.*` existe.
 *
 * Los timestamps de video se asignan manualmente por índice de frame (no hay pacing en
 * tiempo real): el frame `i` se presenta en `i / fps` segundos.
 */
object ResumenVideoEncoder {

    private const val TAG = "ResumenVideoEncoder"
    private const val ANCHO = 1080
    private const val ALTO = 1920
    private const val BIT_RATE_VIDEO = 4_000_000
    private const val BIT_RATE_AUDIO = 128_000
    private const val TIMEOUT_US = 10_000L

    /**
     * Tope de espera del drenaje final de video. Si el codificador nunca entrega el buffer
     * marcado con END_OF_STREAM (se ha visto en hardware real quedándose corto por un frame),
     * el bucle de drenaje sale al agotarse este tiempo en vez de girar para siempre: la
     * post-condición posterior sobre el número de frames convierte el cuelgue indefinido en un
     * error inmediato y diagnosticable.
     */
    private const val MAX_ESPERA_EOS_MS = 5_000L

    /**
     * Proporción mínima de frames codificados respecto a los pedidos para dar el video por
     * bueno.
     *
     * La post-condición original exigía igualdad exacta, y con razón: cuando esta función
     * codificaba 3-4 tarjetas estáticas, una muestra perdida era una pantalla entera de
     * contenido desaparecida. A 30 fps una "muestra" es 1/30 de segundo: perder un par de
     * frames deja el video 33-66 ms más corto, sin contenido faltante ni saltos visibles.
     * Un codificador con entrada por Surface no garantiza correspondencia 1:1 entre los
     * buffers posteados con `unlockCanvasAndPost()` y los buffers de salida (puede fusionar
     * o descartar frames, sobre todo cuando el productor postea sin pacing en tiempo real,
     * como hace el bucle de abajo). Con igualdad exacta esa diferencia imperceptible se
     * convierte en un fallo total: el usuario no recibe ningún video.
     *
     * El guardia se mantiene, pero calibrado: salta cuando faltan tantos frames que el video
     * sí quedaría degradado, y toda pérdida —aunque se tolere— se registra con Log.w.
     */
    private const val MIN_PROPORCION_FRAMES = 0.95
    private const val MUESTRAS_POR_FRAME_AAC = 1024

    /**
     * @param dibujarFrame pinta el frame del instante dado sobre el canvas que recibe (el de
     *   la Surface de entrada del codificador). Se le exige limpiar el canvas: puede llegar
     *   con contenido de un frame anterior.
     */
    suspend fun generar(
        duracionTotalMs: Long,
        fps: Int,
        context: Context,
        salida: File,
        // Canción personalizada del cliente; si es null o no existe en disco, se cae al
        // recurso `res/raw/resumen_musica.*` empacado en el APK.
        archivoMusica: File? = null,
        inicioMusicaSegundos: Int = 0,
        onProgreso: (Float) -> Unit = {},
        dibujarFrame: (canvas: Canvas, tiempoMs: Long) -> Unit
    ) = withContext<Unit>(Dispatchers.Default) {
        require(duracionTotalMs > 0) { "duracionTotalMs debe ser positivo" }
        require(fps > 0) { "fps debe ser positivo" }

        val inicioTotalNs = System.nanoTime()
        val inicioVideoNs = System.nanoTime()
        // El video (dibujar + codificar cada frame) es, con mucho, la parte lenta: se le
        // reserva el 95% de la barra de progreso y el 5% restante a audio + mux.
        val pistaVideo = codificarVideo(duracionTotalMs, fps, dibujarFrame) { fraccionVideo ->
            onProgreso(fraccionVideo * 0.95f)
        }
        val msVideo = (System.nanoTime() - inicioVideoNs) / 1_000_000L

        // El audio es opcional: si no hay canción personalizada ni recurso empacado, o falla
        // la transcodificación, se genera el video sin música en vez de abortar todo.
        val inicioAudioNs = System.nanoTime()
        val pistaAudio = runCatching {
            if (archivoMusica != null && archivoMusica.exists()) {
                codificarAudioDesdeArchivo(
                    archivoMusica, inicioMusicaSegundos * 1_000_000L, duracionTotalMs * 1_000L
                )
            } else {
                obtenerResIdMusica(context)?.let { resId ->
                    codificarAudioDesdeRecurso(context, resId, duracionTotalMs * 1_000L)
                }
            }
        }.onFailure { Log.w(TAG, "No se pudo transcodificar la música de fondo", it) }
            .getOrNull()?.takeIf { it.muestras.isNotEmpty() }
        val msAudio = (System.nanoTime() - inicioAudioNs) / 1_000_000L

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
        onProgreso(1f)

        // Diagnóstico de rendimiento (una sola línea, para leer desde adb logcat).
        val msTotal = (System.nanoTime() - inicioTotalNs) / 1_000_000L
        Log.i(
            TAG,
            "Video generado en $msTotal ms (frames: $msVideo ms, audio: $msAudio ms, " +
                "${framesTotales(duracionTotalMs, fps)} frames a $fps fps)"
        )
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

    /** Frames que se van a postear para [duracionTotalMs] a [fps]. */
    private fun framesTotales(duracionTotalMs: Long, fps: Int): Int =
        ((duracionTotalMs * fps) / 1000L).toInt().coerceAtLeast(1)

    /**
     * `suspend` para poder cooperar con la cancelación: el bucle de frames no tiene ningún
     * punto de suspensión propio, así que sin el `ensureActive()` de cada vuelta una
     * generación abandonada (el usuario sale de la pantalla y se cancela el `viewModelScope`)
     * seguía codificando sus ~870 frames a pleno CPU, compitiendo con la siguiente. Al
     * lanzarse la `CancellationException` desde dentro del `try`, el `finally` igual libera
     * el MediaCodec y la Surface.
     */
    private suspend fun codificarVideo(
        duracionTotalMs: Long,
        fps: Int,
        dibujarFrame: (Canvas, Long) -> Unit,
        onProgreso: (Float) -> Unit
    ): PistaCodificada {
        val contexto = currentCoroutineContext()
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, ANCHO, ALTO).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE_VIDEO)
            setInteger(MediaFormat.KEY_FRAME_RATE, fps)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
        }
        // La construcción/configure/start también van dentro del try: un MediaCodec que
        // se fuga bloquea el codificador de hardware para todo el dispositivo hasta que
        // muere el proceso.
        var encoder: MediaCodec? = null
        var surface: Surface? = null

        val totalFrames = framesTotales(duracionTotalMs, fps)
        val duracionFrameUs = 1_000_000L / fps
        var salidaFormato: MediaFormat? = null
        val muestras = mutableListOf<MuestraCodificada>()
        val bufferInfo = MediaCodec.BufferInfo()
        // Cuenta sólo muestras reales escritas (los buffers de codec-config y el EOS
        // vacío no cuentan), de modo que pts = indiceMuestra * duracionFrameUs.
        var indiceMuestra = 0
        // Se marca si el drenaje final salió por el tope de inactividad en vez de por el
        // buffer con END_OF_STREAM, para que el mensaje del check() posterior distinga
        // "el códec se colgó" de "el códec terminó bien pero perdió un frame".
        var drenajeFinalAbandonado = false

        fun drenar(enc: MediaCodec, finalDeFlujo: Boolean) {
            if (finalDeFlujo) enc.signalEndOfInputStream()
            // Reloj de inactividad del drenaje final: se mide con reloj de pared (y no
            // sumando TIMEOUT_US por vuelta) para que el tope aplique a CUALQUIER camino
            // del `when`, incluidos códigos de retorno inesperados sin rama propia.
            // Con finalDeFlujo=false nunca se usa: el primer INFO_TRY_AGAIN_LATER ya
            // devuelve el control al bucle de frames.
            var inicioInactividadNs = System.nanoTime()
            // Ojo con bajar TIMEOUT_US a 0 en el sondeo por frame: parece desperdicio —son
            // ~11,5 ms por frame, 19,5 s de los 71 s de un video— pero NO lo es. Medido en
            // dispositivo con el sondeo a 0: el drenaje baja a 0,4 ms por frame y la espera en
            // `lockCanvas` sube de 0,1 a 61 ms, con el tramo de 100 frames pasando de 4,4 a
            // 7,6 s. Ese rato es el que el codificador usa para consumir frames y liberar
            // buffers de entrada; quitarlo sólo mueve la espera a `lockCanvas`, y encima sale
            // más caro. El límite real es que el codificador no da 30 fps a 1080x1920 mientras
            // la CPU dibuja, y eso no se arregla desde acá.
            while (true) {
                val indiceSalida = enc.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)
                val inactividadMs = (System.nanoTime() - inicioInactividadNs) / 1_000_000L
                when {
                    indiceSalida == MediaCodec.INFO_TRY_AGAIN_LATER -> {
                        if (!finalDeFlujo) return
                        // La salida ya está completa: seguir esperando el buffer con
                        // END_OF_STREAM no puede mejorarla, y en el dispositivo del usuario ese
                        // buffer no llega nunca (se quemaban los 5 s del tope en cada video).
                        if (muestras.size >= totalFrames) return
                        if (inactividadMs >= MAX_ESPERA_EOS_MS) {
                            Log.w(
                                TAG,
                                "El codificador de video no entregó END_OF_STREAM tras " +
                                    "$MAX_ESPERA_EOS_MS ms; se abandona el drenaje final con " +
                                    "${muestras.size} frames"
                            )
                            drenajeFinalAbandonado = true
                            return
                        }
                    }
                    indiceSalida == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        salidaFormato = enc.outputFormat
                        // Hubo avance: el tope de espera cuenta inactividad, no trabajo útil.
                        inicioInactividadNs = System.nanoTime()
                    }
                    indiceSalida >= 0 -> {
                        inicioInactividadNs = System.nanoTime()
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
                    // Códigos negativos sin rama propia (p.ej. el obsoleto
                    // INFO_OUTPUT_BUFFERS_CHANGED). Esta rama es el `else` real del `when`:
                    // ninguna combinación de código de retorno y `finalDeFlujo` puede quedar
                    // sin salida acotada.
                    else -> {
                        // En el drenaje por frame (dentro del bucle principal) no hay nada que
                        // esperar: igual que con INFO_TRY_AGAIN_LATER, se devuelve el control
                        // de inmediato en vez de girar aquí.
                        if (!finalDeFlujo) return
                        // Misma salida temprana que arriba: con la salida ya completa no queda
                        // nada que esperar.
                        if (muestras.size >= totalFrames) return
                        if (inactividadMs >= MAX_ESPERA_EOS_MS) {
                            Log.w(
                                TAG,
                                "Drenaje final abandonado tras $MAX_ESPERA_EOS_MS ms sin avance " +
                                    "(último código $indiceSalida) con ${muestras.size} frames"
                            )
                            drenajeFinalAbandonado = true
                            return
                        }
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

            // Reparto del tiempo de cada frame entre las cuatro cosas que puede estar haciendo.
            // Existe porque desde fuera "va lento" no distingue dos causas opuestas: que pintar
            // cueste caro (nsDibujo alto) o que el codificador no consuma y `lockCanvas` se
            // quede esperando un buffer de entrada libre (nsEspera alto). Diagnosticar eso a
            // ojo costó una tarde entera y cuatro conclusiones equivocadas.
            var nsEspera = 0L
            var nsDibujo = 0L
            var nsPost = 0L
            var nsDrenaje = 0L
            var nsEsperaPrevio = 0L
            var nsDibujoPrevio = 0L
            var nsPostPrevio = 0L
            var nsDrenajePrevio = 0L
            var inicioTramoNs = System.nanoTime()

            for (indiceFrame in 0 until totalFrames) {
                // Un frame es el grano de cancelación: si se canceló, se sale aquí (a lo sumo
                // un frame tarde) y el finally libera códec y Surface.
                contexto.ensureActive()
                val tiempoMs = indiceFrame * 1000L / fps
                // Se pinta directo sobre el canvas de la Surface: sin bitmap intermedia de
                // pantalla completa por frame y sin el blit posterior.
                val antesDeEsperar = System.nanoTime()
                val canvas = sfc.lockCanvas(null)
                val antesDeDibujar = System.nanoTime()
                nsEspera += antesDeDibujar - antesDeEsperar
                try {
                    dibujarFrame(canvas, tiempoMs)
                } finally {
                    val antesDePostear = System.nanoTime()
                    nsDibujo += antesDePostear - antesDeDibujar
                    sfc.unlockCanvasAndPost(canvas)
                    nsPost += System.nanoTime() - antesDePostear
                }
                val antesDeDrenar = System.nanoTime()
                drenar(enc, finalDeFlujo = false)
                nsDrenaje += System.nanoTime() - antesDeDrenar
                onProgreso((indiceFrame + 1).toFloat() / totalFrames)

                // Se informa por tramos y no acumulado: lo que importa es si el ritmo se
                // degrada según avanza el video, y un acumulado esconde justamente eso.
                if ((indiceFrame + 1) % 100 == 0) {
                    val ahoraNs = System.nanoTime()
                    val msTramo = (ahoraNs - inicioTramoNs) / 1_000_000L
                    Log.i(
                        TAG,
                        "frames ${indiceFrame + 1 - 99}-${indiceFrame + 1} de $totalFrames en " +
                            "$msTramo ms: espera=${(nsEspera - nsEsperaPrevio) / 1_000_000L} ms, " +
                            "dibujo=${(nsDibujo - nsDibujoPrevio) / 1_000_000L} ms, " +
                            "post=${(nsPost - nsPostPrevio) / 1_000_000L} ms, " +
                            "drenaje=${(nsDrenaje - nsDrenajePrevio) / 1_000_000L} ms, " +
                            "muestras=${muestras.size}"
                    )
                    nsEsperaPrevio = nsEspera
                    nsDibujoPrevio = nsDibujo
                    nsPostPrevio = nsPost
                    nsDrenajePrevio = nsDrenaje
                    inicioTramoNs = ahoraNs
                }
            }
            Log.i(
                TAG,
                "Reparto del video: espera=${nsEspera / 1_000_000L} ms, " +
                    "dibujo=${nsDibujo / 1_000_000L} ms, post=${nsPost / 1_000_000L} ms, " +
                    "drenaje=${nsDrenaje / 1_000_000L} ms"
            )
            // Drenaje extra antes de señalar el fin de flujo: el pipeline interno del
            // codificador con entrada por Surface tiene latencia (el propio códec reporta
            // `latency = 4` en este dispositivo), así que el último unlockCanvasAndPost()
            // puede no haberse latcheado todavía cuando se llama a signalEndOfInputStream().
            // Esta pasada le da la oportunidad de emitir lo que ya tenga listo antes del EOS.
            drenar(enc, finalDeFlujo = false)
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
        // Post-condición: como los frames se postean a la Surface uno tras otro sin pacing en
        // tiempo real, algunos codificadores pueden fusionar o descartar frames. Perder unos
        // pocos a 30 fps es imperceptible (ver MIN_PROPORCION_FRAMES), pero perder muchos sí
        // degrada el video, y cero frames nunca es aceptable: mejor fallar aquí que
        // compartirle al cliente un video incompleto.
        val minimoFrames = Math
            .ceil(totalFrames * MIN_PROPORCION_FRAMES)
            .toInt()
            .coerceIn(1, totalFrames)
        check(muestras.isNotEmpty() && muestras.size >= minimoFrames) {
            val motivo = if (drenajeFinalAbandonado) {
                " (drenaje final abandonado por timeout de $MAX_ESPERA_EOS_MS ms)"
            } else {
                ""
            }
            "El codificador de video emitió ${muestras.size} de $totalFrames frames " +
                "(mínimo aceptable $minimoFrames)$motivo"
        }
        if (muestras.size != totalFrames) {
            // Pérdida tolerada: el video es válido y se comparte, pero queda rastro del
            // número exacto de frames que descartó este dispositivo para poder diagnosticarlo
            // desde un reporte de error.
            Log.w(
                TAG,
                "El codificador de video emitió ${muestras.size} de $totalFrames frames; " +
                    "dentro de la tolerancia (mínimo $minimoFrames), se continúa"
            )
        }
        return PistaCodificada(formatoFinal, muestras)
    }

    // ---------------------------------------------------------------- audio

    private fun codificarAudioDesdeRecurso(
        context: Context,
        resId: Int,
        duracionObjetivoUs: Long
    ): PistaCodificada? {
        val pcm = decodificarAPcm(duracionObjetivoUs, inicioUs = 0L) { extractor ->
            val afd = context.resources.openRawResourceFd(resId)
                ?: error("El recurso de música no se puede abrir como fd (¿está comprimido?)")
            try {
                extractor.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            } finally {
                afd.close()
            }
        }
        if (pcm.datos.isEmpty()) return null
        val pcmLoop = repetirHastaDuracion(pcm, duracionObjetivoUs)
        if (pcmLoop.datos.isEmpty()) return null
        return codificarPcmAAac(pcmLoop)
    }

    /**
     * Igual que [codificarAudioDesdeRecurso] pero desde un archivo en disco (la canción
     * personalizada de un cliente), arrancando en [inicioUs] en vez de en el segundo 0: es
     * el fragmento que el trainer eligió en el preview de Editar cliente.
     */
    private fun codificarAudioDesdeArchivo(
        archivo: File,
        inicioUs: Long,
        duracionObjetivoUs: Long
    ): PistaCodificada? {
        val pcm = decodificarAPcm(duracionObjetivoUs, inicioUs) { extractor ->
            extractor.setDataSource(archivo.absolutePath)
        }
        if (pcm.datos.isEmpty()) return null
        val pcmLoop = repetirHastaDuracion(pcm, duracionObjetivoUs)
        if (pcmLoop.datos.isEmpty()) return null
        return codificarPcmAAac(pcmLoop)
    }

    /**
     * Decodifica a PCM 16 bits la fuente que arma [configurarFuente] sobre el extractor.
     * Deja de decodificar en cuanto tiene suficiente material para [duracionObjetivoUs]
     * (evita cargar en memoria pistas muy largas). El seek a [inicioUs] se hace DESPUÉS de
     * seleccionar la pista: `MediaExtractor.seekTo()` no tiene efecto sobre pistas que
     * todavía no se seleccionaron con `selectTrack()`.
     */
    private fun decodificarAPcm(
        duracionObjetivoUs: Long,
        inicioUs: Long,
        configurarFuente: (MediaExtractor) -> Unit
    ): Pcm {
        val extractor = MediaExtractor()
        // El decodificador se construye DENTRO del try: si configure()/start() lanza,
        // el finally igual libera extractor y códec (un MediaCodec fugado bloquea el
        // hardware para todo el dispositivo hasta que muere el proceso).
        var decoder: MediaCodec? = null
        val acumulador = AcumuladorPcm()
        var sampleRate = 0
        var canales = 0

        try {
            configurarFuente(extractor)

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
            if (inicioUs > 0) extractor.seekTo(inicioUs, MediaExtractor.SEEK_TO_CLOSEST_SYNC)

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
