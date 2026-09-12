package com.osfit.app.ui.logros

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.repository.InsigniaStorageRepository
import com.osfit.app.data.repository.LogroPersonalRepository
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

    private companion object {
        const val TAG = "LogrosPersonalesVM"
    }
}
