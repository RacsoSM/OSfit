package com.osfit.app.ui.clientes

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.model.LogroPersonalOtorgado
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.model.MedallaOtorgada
import com.osfit.app.data.model.VideoPublicado
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.data.repository.LogroPersonalRepository
import com.osfit.app.data.repository.MedallaRepository
import com.osfit.app.data.repository.ResumenStorageRepository
import com.osfit.app.data.repository.VideoPublicadoRepository
import com.osfit.app.domain.MedallaCalculator
import com.osfit.app.domain.RangoResumen
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.domain.ResumenClienteData
import com.osfit.app.domain.RetencionVideos
import com.osfit.app.video.ResumenVideoGenerator
import java.io.File
import java.time.LocalDate
import java.time.YearMonth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

private const val TAG_RESUMEN = "ResumenVideo"

class ResumenClienteViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository,
    private val medallaRepository: MedallaRepository = AppContainer.medallaRepository,
    private val logroPersonalRepository: LogroPersonalRepository = AppContainer.logroPersonalRepository,
    private val videoPublicadoRepository: VideoPublicadoRepository = AppContainer.videoPublicadoRepository,
    private val resumenStorageRepository: ResumenStorageRepository = AppContainer.resumenStorageRepository
) : ViewModel() {

    private val _generando = MutableStateFlow(false)
    val generando: StateFlow<Boolean> = _generando

    /** 0f..1f mientras `generando` es true; sólo para feedback visual, no hay garantía de
     *  linealidad real (el codificador puede fusionar/descartar frames de hardware). */
    private val _progreso = MutableStateFlow(0f)
    val progreso: StateFlow<Float> = _progreso

    /** Mensaje para mostrarle al entrenador (Toast); la pantalla lo limpia al consumirlo. */
    private val _mensaje = MutableStateFlow<String?>(null)
    val mensaje: StateFlow<String?> = _mensaje

    fun limpiarMensaje() {
        _mensaje.value = null
    }

    /**
     * El mp4 quincenal que se acaba de generar, listo para publicarse en la web sin volver a
     * codificarlo. Sólo la quincena llega acá: es la única que tiene `rangoInicio` y
     * `encabezadoRango` de quincena, que son la clave y el rótulo del video en la web.
     */
    data class VideoQuincenalListo(
        val archivo: File,
        val rangoInicio: String,
        val encabezadoRango: String,
        val duracionSegundos: Int
    )

    private val _videoListo = MutableStateFlow<VideoQuincenalListo?>(null)
    val videoListo: StateFlow<VideoQuincenalListo?> = _videoListo

    private val _publicando = MutableStateFlow(false)
    val publicando: StateFlow<Boolean> = _publicando

    /**
     * Sube el mp4 y escribe su documento; después aplica la retención de
     * [RetencionVideos.MAXIMO]. Republicar la misma quincena pisa lo anterior: la ruta sale de
     * `rangoInicio` (se sobreescribe el blob) y el documento usa ese mismo id (upsert).
     */
    fun publicarEnLaWeb() {
        val listo = _videoListo.value ?: return
        if (_publicando.value) return
        // El generador borra del caché los resúmenes de más de una hora, así que el archivo
        // puede haber desaparecido si la pantalla quedó abierta mucho rato.
        if (!listo.archivo.exists()) {
            _videoListo.value = null
            _mensaje.value = "El video ya no está en el teléfono; vuelve a generarlo para publicarlo"
            return
        }
        _publicando.value = true
        viewModelScope.launch {
            try {
                val rutaStorage = resumenStorageRepository.subir(clienteId, listo.rangoInicio, listo.archivo)
                videoPublicadoRepository.publicar(
                    clienteId,
                    VideoPublicado(
                        rangoInicio = listo.rangoInicio,
                        encabezadoRango = listo.encabezadoRango,
                        rutaStorage = rutaStorage,
                        duracionSegundos = listo.duracionSegundos
                    )
                )
                // Con el blob subido y el documento escrito la publicación ya está hecha y se
                // avisa acá: publicar y limpiar son dos cosas distintas y sólo la primera es
                // lo que el entrenador pidió. Si después falla la limpieza, decirle "no se
                // pudo publicar" sería mentira — el video está visible en la página — y lo
                // llevaría a republicar creyendo que no quedó.
                _mensaje.value = "Video publicado en la página de la clienta"
                limpiarSobrantes()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                Log.w(TAG_RESUMEN, "Falló la publicación del resumen en la web", e)
                _mensaje.value = "No se pudo publicar el video en la web"
            } finally {
                _publicando.value = false
            }
        }
    }

    /**
     * Borra primero el blob de Storage y recién después el documento de Firestore: el borrado
     * no es atómico entre los dos, así que hay que elegir cuál falla mejor. Si se fuera al
     * revés y fallara el blob, quedaría un mp4 huérfano que nadie ve, nadie encuentra y se
     * paga todos los meses. En este orden, si falla el documento queda un registro apuntando a
     * un archivo que no está: eso se ve, la página lo resuelve como "video no disponible" y el
     * próximo publicar lo reintenta. Se prefiere el fallo visible.
     *
     * Ningún fallo de acá aborta ni revierte lo ya publicado: cada sobrante va con su propio
     * `runCatching` para que uno problemático no impida limpiar los demás (igual que el lote
     * de "Subir insignias"), y lo que no se pueda borrar queda para el próximo publicar.
     */
    private suspend fun limpiarSobrantes() {
        runCatching {
            val publicados = videoPublicadoRepository.observarDe(clienteId).first()
            RetencionVideos.sobrantes(publicados).forEach { video ->
                runCatching {
                    resumenStorageRepository.borrar(clienteId, video.rangoInicio)
                    videoPublicadoRepository.borrar(clienteId, video.rangoInicio)
                }.onFailure { Log.w(TAG_RESUMEN, "No se pudo borrar el video ${video.rangoInicio}", it) }
            }
        }.onFailure { Log.w(TAG_RESUMEN, "No se pudo aplicar la retención de videos publicados", it) }
    }

    fun generarResumenSemanal(context: Context, fechaReferencia: LocalDate = LocalDate.now()) {
        generarYCompartir(context) { calcularResumenSemanal(fechaReferencia) }
    }

    fun generarResumenMensual(context: Context, mes: YearMonth = YearMonth.now()) {
        generarYCompartir(context) { calcularResumenMensual(mes) }
    }

    /**
     * Lanza la generación en [viewModelScope] (no en el scope del Composable): así una
     * rotación de pantalla no deja el trabajo huérfano ni reinicia la bandera de "generando".
     *
     * Se usa el `applicationContext` porque la corrutina puede sobrevivir a la Activity;
     * por eso [com.osfit.app.util.CompartirUtil] agrega FLAG_ACTIVITY_NEW_TASK.
     *
     * El try/catch atrapa `Throwable` y no sólo `Exception`: una excepción del códec
     * (MediaCodec por Surface no está soportado en todos los dispositivos), del FileProvider
     * o un OutOfMemoryError al crear los bitmaps mataría el proceso completo en vez de
     * avisarle al usuario.
     */
    private fun generarYCompartir(
        context: Context,
        obtenerResumen: suspend () -> ResumenClienteData?
    ) {
        if (_generando.value) return
        _generando.value = true
        _progreso.value = 0f
        val contextoApp = context.applicationContext
        viewModelScope.launch {
            try {
                val resumen = obtenerResumen()
                if (resumen == null) {
                    _mensaje.value = "No se pudo calcular el resumen de este cliente"
                    return@launch
                }
                ResumenVideoGenerator.generarYCompartir(contextoApp, resumen) { fraccion ->
                    _progreso.value = fraccion
                }
            } catch (e: CancellationException) {
                // La cancelación (se cerró la pantalla) no es un error: debe seguir propagándose.
                throw e
            } catch (e: Throwable) {
                Log.w(TAG_RESUMEN, "Falló la generación del resumen en video", e)
                _mensaje.value = "No se pudo generar el video del resumen"
            } finally {
                // En `finally` para que el botón no quede trabado aunque falle o se cancele.
                _generando.value = false
                _progreso.value = 0f
            }
        }
    }

    suspend fun calcularResumenSemanal(fechaReferencia: LocalDate = LocalDate.now()): ResumenClienteData? =
        calcularResumen(ResumenClienteCalculator.rangoSemanal(fechaReferencia))

    suspend fun calcularResumenQuincenal(fechaReferencia: LocalDate = LocalDate.now()): ResumenClienteData? =
        calcularResumen(ResumenClienteCalculator.rangoQuincenal(fechaReferencia))

    suspend fun calcularResumenMensual(mes: YearMonth = YearMonth.now()): ResumenClienteData? =
        calcularResumen(ResumenClienteCalculator.rangoMensual(mes))

    data class PreparacionResumenQuincenal(
        val resumen: ResumenClienteData,
        val sugerencia: MedallaCatalogo?,
        val catalogo: List<MedallaCatalogo>,
        val catalogoLogros: List<LogroPersonalCatalogo>
    )

    /** Calcula el resumen quincenal y, con él, la categoría automática sugerida (si hay), ya
     *  resuelta contra el catálogo actual — todo lo que necesita ConfirmarMedallaDialog en un
     *  solo viaje. Lee el catálogo directo del repositorio (no del StateFlow ya cacheado de
     *  MedallasViewModel, que esta pantalla no comparte) para no depender de que algo más lo
     *  haya suscrito antes. */
    suspend fun prepararConfirmacionQuincenal(
        fechaReferencia: LocalDate = LocalDate.now()
    ): PreparacionResumenQuincenal? {
        val resumen = calcularResumenQuincenal(fechaReferencia) ?: return null
        val catalogoActual = medallaRepository.observarCatalogo().first()
        val catalogoLogros = logroPersonalRepository.observarCatalogo().first()
        val categoriaSugerida = MedallaCalculator.sugerirCategoria(resumen)
        val sugerencia = categoriaSugerida?.let { cat -> catalogoActual.firstOrNull { it.categoria == cat } }
        return PreparacionResumenQuincenal(resumen, sugerencia, catalogoActual, catalogoLogros)
    }

    /**
     * Duplica parte del try/catch/finally de [generarYCompartir] a propósito: ese helper genérico
     * recalcula el resumen desde una lambda y no conoce medallas, y este flujo ya trae el resumen
     * calculado (de [prepararConfirmacionQuincenal]) más el efecto secundario de otorgar la medalla
     * antes de generar — meter eso en el helper genérico lo complicaría para las otras 2 llamadas
     * (semanal/mensual) que nunca lo necesitan.
     */
    fun confirmarYGenerarQuincenal(
        context: Context,
        preparacion: PreparacionResumenQuincenal,
        elegida: MedallaCatalogo?,
        logrosElegidos: List<LogroPersonalCatalogo> = emptyList()
    ) {
        if (_generando.value) return
        _generando.value = true
        _progreso.value = 0f
        val contextoApp = context.applicationContext
        viewModelScope.launch {
            try {
                if (elegida != null) {
                    medallaRepository.otorgarMedalla(
                        preparacion.resumen.cliente.id,
                        MedallaOtorgada(
                            rangoInicio = preparacion.resumen.rango.inicio.toString(),
                            medallaId = elegida.id,
                            nombreMedalla = elegida.nombre,
                            imagenUrl = elegida.imagenUrl,
                            encabezadoRango = preparacion.resumen.rango.encabezado,
                            fueAjustadaManualmente = elegida.id != preparacion.sugerencia?.id
                        )
                    )
                }
                val rangoInicio = preparacion.resumen.rango.inicio.toString()
                // Siempre se llama, incluso con lista vacía: así limpia los logros de una
                // generación anterior de la misma quincena (ver LogroPersonalRepository).
                logroPersonalRepository.otorgarLogros(
                    preparacion.resumen.cliente.id,
                    rangoInicio,
                    logrosElegidos.mapIndexed { indice, logro ->
                        LogroPersonalOtorgado(
                            id = "${rangoInicio}_${logro.id}",
                            rangoInicio = rangoInicio,
                            logroId = logro.id,
                            nombreLogro = logro.nombre,
                            imagenUrl = logro.imagenUrl,
                            mensaje = logro.mensaje,
                            encabezadoRango = preparacion.resumen.rango.encabezado,
                            orden = indice
                        )
                    }
                )
                val generado = ResumenVideoGenerator.generarYCompartir(
                    contextoApp, preparacion.resumen, elegida, logrosElegidos
                ) { fraccion -> _progreso.value = fraccion }
                // Se guarda el mp4 recién hecho para que "Publicar en la web" suba exactamente
                // el video que el entrenador acaba de compartir, sin regenerarlo.
                _videoListo.value = VideoQuincenalListo(
                    archivo = generado.archivo,
                    rangoInicio = rangoInicio,
                    encabezadoRango = preparacion.resumen.rango.encabezado,
                    duracionSegundos = generado.duracionSegundos
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                Log.w(TAG_RESUMEN, "Falló la generación del resumen en video", e)
                _mensaje.value = "No se pudo generar el video del resumen"
            } finally {
                _generando.value = false
                _progreso.value = 0f
            }
        }
    }

    private suspend fun calcularResumen(rango: RangoResumen): ResumenClienteData? {
        val cliente = clienteRepository.observarCliente(clienteId).first() ?: return null
        val clientesActivos = clienteRepository.observarClientes().first().filter { it.activo }
        // El cliente del resumen debe entrar en su propia comparación aunque esté inactivo.
        val clientesParaRanking = if (clientesActivos.any { it.id == cliente.id }) {
            clientesActivos
        } else {
            clientesActivos + cliente
        }
        val asistencias = asistenciaRepository.observarAsistenciasPorRango(
            rango.inicio.toString(),
            rango.fin.toString()
        ).first()
        return ResumenClienteCalculator.calcularResumenCliente(cliente, clientesParaRanking, asistencias, rango)
    }
}
