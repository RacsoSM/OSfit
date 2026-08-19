package com.osfit.app.ui.rutinas

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.repository.RutinaRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class RutinasViewModel(
    private val rutinaRepository: RutinaRepository = AppContainer.rutinaRepository
) : ViewModel() {

    val rutinas: StateFlow<List<Rutina>> = rutinaRepository.observarRutinas()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun eliminarRutina(rutinaId: String) {
        viewModelScope.launch {
            rutinaRepository.eliminarRutina(rutinaId)
        }
    }
}
