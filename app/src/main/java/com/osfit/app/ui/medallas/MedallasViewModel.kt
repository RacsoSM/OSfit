package com.osfit.app.ui.medallas

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.repository.MedallaRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class MedallasViewModel(
    private val medallaRepository: MedallaRepository = AppContainer.medallaRepository
) : ViewModel() {

    init {
        viewModelScope.launch { medallaRepository.asegurarCategoriasAutomaticas() }
    }

    val medallas: StateFlow<List<MedallaCatalogo>> = medallaRepository.observarCatalogo()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun guardar(medalla: MedallaCatalogo) {
        viewModelScope.launch { medallaRepository.guardarMedalla(medalla) }
    }

    fun eliminar(medalla: MedallaCatalogo) {
        viewModelScope.launch { medallaRepository.eliminarMedalla(medalla) }
    }
}
