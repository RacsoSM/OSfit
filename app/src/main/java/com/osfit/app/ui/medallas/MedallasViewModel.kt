package com.osfit.app.ui.medallas

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.repository.InsigniaStorageRepository
import com.osfit.app.data.repository.MedallaRepository
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

    private companion object {
        const val TAG = "MedallasViewModel"
    }
}
