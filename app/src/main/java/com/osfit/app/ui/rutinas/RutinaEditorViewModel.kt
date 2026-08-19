package com.osfit.app.ui.rutinas

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.repository.RutinaRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class RutinaEditorViewModel(
    private val rutinaId: String?,
    private val rutinaRepository: RutinaRepository = AppContainer.rutinaRepository
) : ViewModel() {

    private val _rutina = MutableStateFlow(Rutina())
    val rutina: StateFlow<Rutina> = _rutina.asStateFlow()

    private val _guardado = MutableStateFlow(false)
    val guardado: StateFlow<Boolean> = _guardado.asStateFlow()

    init {
        if (!rutinaId.isNullOrBlank()) {
            viewModelScope.launch {
                rutinaRepository.obtenerRutina(rutinaId)?.let { _rutina.value = it }
            }
        }
    }

    fun cambiarNombre(nombre: String) {
        _rutina.value = _rutina.value.copy(nombre = nombre)
    }

    fun agregarDia() {
        val dias = _rutina.value.dias + DiaRutina(nombreDia = "Día ${_rutina.value.dias.size + 1}")
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun eliminarDia(indiceDia: Int) {
        val dias = _rutina.value.dias.toMutableList().apply { removeAt(indiceDia) }
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun cambiarNombreDia(indiceDia: Int, nombre: String) {
        val dias = _rutina.value.dias.toMutableList()
        dias[indiceDia] = dias[indiceDia].copy(nombreDia = nombre)
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun agregarEjercicio(indiceDia: Int) {
        val dias = _rutina.value.dias.toMutableList()
        val ejercicios = dias[indiceDia].ejercicios + Ejercicio()
        dias[indiceDia] = dias[indiceDia].copy(ejercicios = ejercicios)
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun eliminarEjercicio(indiceDia: Int, indiceEjercicio: Int) {
        val dias = _rutina.value.dias.toMutableList()
        val ejercicios = dias[indiceDia].ejercicios.toMutableList().apply { removeAt(indiceEjercicio) }
        dias[indiceDia] = dias[indiceDia].copy(ejercicios = ejercicios)
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun actualizarEjercicio(indiceDia: Int, indiceEjercicio: Int, ejercicio: Ejercicio) {
        val dias = _rutina.value.dias.toMutableList()
        val ejercicios = dias[indiceDia].ejercicios.toMutableList()
        ejercicios[indiceEjercicio] = ejercicio
        dias[indiceDia] = dias[indiceDia].copy(ejercicios = ejercicios)
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun guardar() {
        viewModelScope.launch {
            rutinaRepository.guardarRutina(_rutina.value)
            _guardado.value = true
        }
    }
}
