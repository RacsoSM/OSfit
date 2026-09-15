package com.osfit.app.ui.rutinas

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.SincronizadorDiaWeb
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.model.VariacionDia
import com.osfit.app.data.repository.RutinaRepository
import com.osfit.app.domain.conVariacionNueva
import com.osfit.app.domain.sinLaUltimaVariacion
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class RutinaEditorViewModel(
    private val rutinaId: String?,
    private val rutinaRepository: RutinaRepository = AppContainer.rutinaRepository,
    private val sincronizadorDiaWeb: SincronizadorDiaWeb = AppContainer.sincronizadorDiaWeb
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

    /**
     * Lee y escribe la lista de ejercicios que corresponde, sin que cada operación tenga que
     * saber del invariante: [variacion] nulo es la lista base, con valor es esa variación. Todas
     * las de abajo pasan por aquí, que es lo que impide que una se olvide del caso.
     */
    private fun ejerciciosDe(indiceDia: Int, variacion: Int?): List<Ejercicio> {
        val dia = _rutina.value.dias[indiceDia]
        return if (variacion == null) {
            dia.ejercicios
        } else {
            dia.variaciones.getOrNull(variacion)?.ejercicios.orEmpty()
        }
    }

    private fun conEjercicios(indiceDia: Int, variacion: Int?, ejercicios: List<Ejercicio>) {
        val dias = _rutina.value.dias.toMutableList()
        val dia = dias[indiceDia]
        dias[indiceDia] = if (variacion == null) {
            dia.copy(ejercicios = ejercicios)
        } else {
            dia.copy(
                variaciones = dia.variaciones.toMutableList().also {
                    it[variacion] = VariacionDia(ejercicios)
                }
            )
        }
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun agregarEjercicio(indiceDia: Int, variacion: Int? = null) {
        conEjercicios(indiceDia, variacion, ejerciciosDe(indiceDia, variacion) + Ejercicio())
    }

    fun eliminarEjercicio(indiceDia: Int, indiceEjercicio: Int, variacion: Int? = null) {
        val ejercicios = ejerciciosDe(indiceDia, variacion).toMutableList()
        ejercicios.removeAt(indiceEjercicio)
        conEjercicios(indiceDia, variacion, ejercicios)
    }

    fun actualizarEjercicio(
        indiceDia: Int,
        indiceEjercicio: Int,
        ejercicio: Ejercicio,
        variacion: Int? = null
    ) {
        val ejercicios = ejerciciosDe(indiceDia, variacion).toMutableList()
        ejercicios[indiceEjercicio] = ejercicio
        conEjercicios(indiceDia, variacion, ejercicios)
    }

    fun moverEjercicio(
        indiceDia: Int,
        indiceEjercicio: Int,
        desplazamiento: Int,
        variacion: Int? = null
    ) {
        val ejercicios = ejerciciosDe(indiceDia, variacion).toMutableList()
        val destino = indiceEjercicio + desplazamiento
        if (destino !in ejercicios.indices) return
        ejercicios.add(destino, ejercicios.removeAt(indiceEjercicio))
        conEjercicios(indiceDia, variacion, ejercicios)
    }

    /**
     * Las variaciones de una plantilla las ven **todas** las clientas que la siguen, y cada una
     * rota por su cuenta según su propio historial de asistencias: no hay contador compartido.
     */
    fun agregarVariacion(indiceDia: Int) {
        val dias = _rutina.value.dias.toMutableList()
        dias[indiceDia] = conVariacionNueva(dias[indiceDia])
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun quitarVariacion(indiceDia: Int) {
        val dias = _rutina.value.dias.toMutableList()
        dias[indiceDia] = sinLaUltimaVariacion(dias[indiceDia])
        _rutina.value = _rutina.value.copy(dias = dias)
    }

    fun guardar() {
        viewModelScope.launch {
            rutinaRepository.guardarRutina(_rutina.value)
            // Agregar o quitar días de la plantilla le cambia el tamaño del ciclo a todas sus
            // seguidoras, así que el trío denormalizado que consume la web puede quedar fuera de
            // rango. Es lo mismo que hace `asignarRutina` por la misma razón.
            sincronizadorDiaWeb.refrescarTodos()
            _guardado.value = true
        }
    }
}
