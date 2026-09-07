package com.osfit.app.ui.logros

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.LogroPersonalCatalogo
import com.osfit.app.data.repository.LogroPersonalRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Espejo de MedallasViewModel, sin el `init { asegurarCategoriasAutomaticas() }`: los logros
 *  personales no tienen categorías fijas ni siembra, el catálogo arranca vacío. */
class LogrosPersonalesViewModel(
    private val repositorio: LogroPersonalRepository = AppContainer.logroPersonalRepository
) : ViewModel() {

    val logros: StateFlow<List<LogroPersonalCatalogo>> = repositorio.observarCatalogo()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun guardar(logro: LogroPersonalCatalogo) {
        viewModelScope.launch { repositorio.guardarLogro(logro) }
    }

    fun eliminar(logro: LogroPersonalCatalogo) {
        viewModelScope.launch { repositorio.eliminarLogro(logro.id) }
    }
}
