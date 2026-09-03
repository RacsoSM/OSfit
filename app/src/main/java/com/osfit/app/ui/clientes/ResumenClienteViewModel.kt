package com.osfit.app.ui.clientes

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.domain.RangoResumen
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.domain.ResumenClienteData
import com.osfit.app.video.ResumenVideoGenerator
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
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository
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

    suspend fun calcularResumenMensual(mes: YearMonth = YearMonth.now()): ResumenClienteData? =
        calcularResumen(ResumenClienteCalculator.rangoMensual(mes))

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
