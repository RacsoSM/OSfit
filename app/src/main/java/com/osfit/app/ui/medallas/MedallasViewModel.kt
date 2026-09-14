package com.osfit.app.ui.medallas

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.repository.InsigniaStorageRepository
import com.osfit.app.data.repository.MedallaRepository
import com.osfit.app.util.MedallaImagenUtil
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File

class MedallasViewModel(
    private val medallaRepository: MedallaRepository = AppContainer.medallaRepository,
    private val insigniaStorageRepository: InsigniaStorageRepository = AppContainer.insigniaStorageRepository
) : ViewModel() {

    init {
        viewModelScope.launch { medallaRepository.asegurarCategoriasAutomaticas() }
    }

    val medallas: StateFlow<List<MedallaCatalogo>> = medallaRepository.observarCatalogo()
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

    /**
     * [imagen] es el PNG ya copiado a filesDir por la pantalla; se sube a Storage **después**
     * de guardar la medalla y en un paso aparte, para que un fallo de red deje la medalla
     * creada sin URL en vez de impedir crearla. Esas quedan para el botón "Subir insignias".
     *
     * Se sube siempre que haya imagen, sin intentar detectar si cambió: el archivo se llama
     * igual (`<id>.png`) antes y después de reemplazarlo, así que no hay forma de distinguir
     * una imagen nueva de la anterior, y son unos pocos KB.
     */
    fun guardar(medalla: MedallaCatalogo, imagen: File?) {
        viewModelScope.launch {
            medallaRepository.guardarMedalla(medalla)
            if (imagen == null) return@launch
            runCatching {
                val url = insigniaStorageRepository.subirMedalla(medalla.id, imagen)
                medallaRepository.actualizarImagenUrl(medalla.id, url)
            }.onFailure { Log.w(TAG, "No se pudo subir la insignia de la medalla ${medalla.id}", it) }
        }
    }

    fun eliminar(medalla: MedallaCatalogo) {
        viewModelScope.launch { medallaRepository.eliminarMedalla(medalla) }
    }

    /**
     * Red de seguridad de [guardar]: sube las medallas que se quedaron con imagen local pero
     * sin `imagenUrl` (por ejemplo, porque la subida de [guardar] falló por falta de red).
     *
     * No corta en el primer fallo — cada medalla se sube con su propio `runCatching` — porque
     * el objetivo es dejar el catálogo lo más completo posible en una sola pasada, no abortar
     * ante la primera insignia problemática.
     */
    fun subirPendientes(context: Context) {
        if (_subiendoPendientes.value) return
        _subiendoPendientes.value = true
        viewModelScope.launch {
            try {
                // Se lee del StateFlow que este ViewModel ya mantiene vivo en vez de volver a
                // suscribirse al catálogo: un listener de Firestore de más por cada toque.
                val pendientes = medallas.value
                    .filter { it.imagenArchivo != null && it.imagenUrl == null }
                var subidas = 0
                var fallidas = 0
                for (medalla in pendientes) {
                    val archivo = MedallaImagenUtil.archivoImagen(context, medalla.imagenArchivo!!)
                    runCatching {
                        val url = insigniaStorageRepository.subirMedalla(medalla.id, archivo)
                        medallaRepository.actualizarImagenUrl(medalla.id, url)
                    }.onSuccess { subidas++ }
                        .onFailure {
                            fallidas++
                            Log.w(TAG, "No se pudo subir la insignia pendiente de la medalla ${medalla.id}", it)
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
                // En `finally` para que el botón no quede trabado en "Subiendo insignias..."
                // para siempre si algo lanza antes de llegar al final.
                _subiendoPendientes.value = false
            }
        }
    }

    private companion object {
        const val TAG = "MedallasViewModel"
    }
}
