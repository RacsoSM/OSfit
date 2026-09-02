package com.osfit.app.ui.top

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.osfit.app.data.AppContainer
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.domain.RachaCalculator
import java.time.LocalDate
import java.time.YearMonth
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

data class TopCliente(val clienteId: String, val nombre: String, val valor: Int)

data class PuestoPodio(val posicion: Int, val valor: Int, val clientes: List<TopCliente>)

private fun construirPodio(candidatos: List<TopCliente>): List<PuestoPodio> =
    candidatos.groupBy { it.valor }
        .toList()
        .sortedByDescending { (valor, _) -> valor }
        .take(3)
        .mapIndexed { indice, (valor, clientes) ->
            PuestoPodio(posicion = indice + 1, valor = valor, clientes = clientes.sortedBy { it.nombre })
        }

class TopViewModel(
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository
) : ViewModel() {

    private val _mesVisible = MutableStateFlow(YearMonth.now())
    val mesVisible: StateFlow<YearMonth> = _mesVisible.asStateFlow()

    private val clientesActivos = clienteRepository.observarClientes()
        .map { lista -> lista.filter { it.activo } }

    @OptIn(ExperimentalCoroutinesApi::class)
    private val asistenciasDelMes = _mesVisible.flatMapLatest { mes ->
        asistenciaRepository.observarAsistenciasPorRango(
            mes.atDay(1).toString(),
            mes.atEndOfMonth().toString()
        )
    }

    val topRacha: StateFlow<List<PuestoPodio>> = combine(clientesActivos, asistenciasDelMes, _mesVisible) { clientes, asistencias, mes ->
        val inicio = mes.atDay(1)
        val fin = mes.atEndOfMonth()
        // Las faltas justificadas ("soborno") cuentan como asistencia solo aquí, en la racha.
        val asistenciasPorCliente = asistencias.groupBy { it.clienteId }
        val candidatos = clientes.mapNotNull { cliente ->
            val fechas = RachaCalculator.fechasQueCuentan(asistenciasPorCliente[cliente.id].orEmpty())
            val racha = RachaCalculator.calcularRachaMasLargaEnRango(fechas, inicio, fin)
            if (racha > 0) TopCliente(cliente.id, cliente.nombre, racha) else null
        }
        construirPodio(candidatos)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val topAsistencia: StateFlow<List<PuestoPodio>> = combine(clientesActivos, asistenciasDelMes) { clientes, asistencias ->
        val asistenciasPorCliente = asistencias.filter { it.asistio }.groupBy { it.clienteId }
        val candidatos = clientes.mapNotNull { cliente ->
            val total = asistenciasPorCliente[cliente.id]?.size ?: 0
            if (total > 0) TopCliente(cliente.id, cliente.nombre, total) else null
        }
        construirPodio(candidatos)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun cambiarMes(mes: YearMonth) {
        _mesVisible.value = mes
    }
}
