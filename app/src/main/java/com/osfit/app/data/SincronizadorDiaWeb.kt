package com.osfit.app.data

import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.data.repository.ClienteRepository
import com.osfit.app.domain.RutinaProgressCalculator
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.flow.first

/**
 * Único lugar que refresca el día denormalizado que consume la web.
 *
 * Existe como clase aparte, y no como llamadas sueltas dentro de cada repositorio, porque
 * el riesgo de este diseño es justamente "un camino de escritura que olvidó refrescar":
 * concentrarlo hace que la pregunta "¿quién refresca?" se responda leyendo un solo archivo.
 *
 * Refrescar es idempotente y barato (una lectura y un update), así que ante la duda conviene
 * llamarlo de más y no de menos.
 */
class SincronizadorDiaWeb(
    private val clienteRepository: ClienteRepository,
    private val asistenciaRepository: AsistenciaRepository
) {
    companion object {
        /** Zona del gimnasio (Culiacán). No usar la del dispositivo: la web fija esta misma. */
        val ZONA: ZoneId = ZoneId.of("America/Mazatlan")

        fun hoy(): String = LocalDate.now(ZONA).toString()
    }

    suspend fun refrescar(clienteId: String, hoy: String = hoy()) {
        val cliente = clienteRepository.observarCliente(clienteId).first() ?: return
        val asistencias = asistenciaRepository.observarAsistenciasPorCliente(clienteId).first()
        val valor = RutinaProgressCalculator.denormalizar(cliente, asistencias, hoy)
        clienteRepository.actualizarDiaDenormalizado(clienteId, valor)
    }

    /** Para operaciones que tocan a varios clientes de una vez, como "Reiniciar día". */
    suspend fun refrescarTodos(hoy: String = hoy()) {
        clienteRepository.observarClientes().first().forEach { refrescar(it.id, hoy) }
    }
}
