package com.osfit.app.ui.clientes

import androidx.lifecycle.ViewModel
import com.osfit.app.data.AppContainer
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.domain.RangoResumen
import com.osfit.app.domain.ResumenClienteCalculator
import com.osfit.app.domain.ResumenClienteData
import java.time.LocalDate
import java.time.YearMonth
import kotlinx.coroutines.flow.first

class ResumenClienteViewModel(
    private val clienteId: String,
    private val clienteRepository: ClienteRepository = AppContainer.clienteRepository,
    private val asistenciaRepository: AsistenciaRepository = AppContainer.asistenciaRepository
) : ViewModel() {

    suspend fun calcularResumenSemanal(fechaReferencia: LocalDate = LocalDate.now()): ResumenClienteData? =
        calcularResumen(ResumenClienteCalculator.rangoSemanal(fechaReferencia))

    suspend fun calcularResumenMensual(mes: YearMonth = YearMonth.now()): ResumenClienteData? =
        calcularResumen(ResumenClienteCalculator.rangoMensual(mes))

    private suspend fun calcularResumen(rango: RangoResumen): ResumenClienteData? {
        val cliente = clienteRepository.observarCliente(clienteId).first() ?: return null
        val clientesActivos = clienteRepository.observarClientes().first().filter { it.activo }
        // El cliente del resumen debe entrar en su propia comparación aunque esté inactivo.
        val clientesParaRanking = if (clientesActivos.any { it.id == cliente.id }) {
            clientesActivos
        } else {
            clientesActivos + cliente
        }
        val asistencias = asistenciaRepository.observarAsistenciasPorRango(
            rango.inicio.toString(),
            rango.fin.toString()
        ).first()
        return ResumenClienteCalculator.calcularResumenCliente(cliente, clientesParaRanking, asistencias, rango)
    }
}
