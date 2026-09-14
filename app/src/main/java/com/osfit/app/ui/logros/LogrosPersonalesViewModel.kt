package com.osfit.app.ui.logros

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.repository.InsigniaStorageRepository
import com.osfit.app.data.repository.LogroPersonalRepository
import com.osfit.app.util.LogroPersonalImagenUtil
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File

/** Espejo de MedallasViewModel, sin el `init { asegurarCategoriasAutomaticas() }`: los logros
 *  personales no tienen categorías fijas ni siembra, el catálogo arranca vacío. */
class LogrosPersonalesViewModel(
    private val repositorio: LogroPersonalRepository = AppContainer.logroPersonalRepository,
    private val insigniaStorageRepository: InsigniaStorageRepository = AppContainer.insigniaStorageRepository
) : ViewModel() {

    val logros: StateFlow<List<LogroPersonalCatalogo>> = repositorio.observarCatalogo()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** true mientras corre el lote de "Subir insignias"; deshabilita el botón para que no se
     *  lance dos veces en paralelo. */
    private val _subiendoPendientes = MutableStateFlow(false)
    val subiendoPendientes: StateFlow<Boolean> = _subiendoPendientes

    /** Mensaje para mostrarle al entrenador (Toast); la pantalla lo limpia al consumirlo. */
    private val _mensaje = MutableStateFlow<String?>(null)
    val mensaje: StateFlow<String?> = _mensaje

    fun limpiarMensaje() {
        _mensaje.value = null
    }

    /** Misma secuencia que MedallasViewModel.guardar: primero el documento, después la subida
     *  aparte, para que quedarse sin red no impida crear el logro. */
    fun guardar(logro: LogroPersonalCatalogo, imagen: File?) {
        viewModelScope.launch {
            repositorio.guardarLogro(logro)
            if (imagen == null) return@launch
            runCatching {
                val url = insigniaStorageRepository.subirLogro(logro.id, imagen)
                repositorio.actualizarImagenUrl(logro.id, url)
            }.onFailure { Log.w(TAG, "No se pudo subir la insignia del logro ${logro.id}", it) }
        }
    }

    fun eliminar(logro: LogroPersonalCatalogo) {
        viewModelScope.launch { repositorio.eliminarLogro(logro.id) }
    }

    /** Espejo de MedallasViewModel.subirPendientes: ver ahí el porqué de no cortar en el
     *  primer fallo, de leer del StateFlow y del `finally`. */
    fun subirPendientes(context: Context) {
        if (_subiendoPendientes.value) return
        _subiendoPendientes.value = true
        viewModelScope.launch {
            try {
                val pendientes = logros.value
                    .filter { it.imagenArchivo != null && it.imagenUrl == null }
                var subidas = 0
                var fallidas = 0
                for (logro in pendientes) {
                    val archivo = LogroPersonalImagenUtil.archivoImagen(context, logro.imagenArchivo!!)
                    runCatching {
                        val url = insigniaStorageRepository.subirLogro(logro.id, archivo)
                        repositorio.actualizarImagenUrl(logro.id, url)
                    }.onSuccess { subidas++ }
                        .onFailure {
                            fallidas++
                            Log.w(TAG, "No se pudo subir la insignia pendiente del logro ${logro.id}", it)
                        }
                }
                _mensaje.value = when {
                    pendientes.isEmpty() -> "No hay insignias pendientes de subir"
                    fallidas == 0 -> "Se subieron $subidas insignias"
                    else -> "Se subieron $subidas insignias, $fallidas fallaron"
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                Log.w(TAG, "Falló el lote de subida de insignias pendientes", e)
                _mensaje.value = "No se pudieron subir las insignias pendientes"
            } finally {
                _subiendoPendientes.value = false
            }
        }
    }

    private companion object {
        const val TAG = "LogrosPersonalesVM"
    }
}
