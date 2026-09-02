package com.osfit.app.data.fake

import com.google.firebase.Timestamp
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.domain.RutinaProgressCalculator
import com.osfit.app.domain.TiempoGymCalculator
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/**
 * Implementación 100% en memoria de [AsistenciaRepository], usada por el modo sandbox.
 * Recibe el [FakeClienteRepository] concreto (no la interfaz) porque, igual que la
 * implementación real hace un batch write cruzando las colecciones "asistencias" y
 * "clientes", este fake necesita llamar a [FakeClienteRepository.actualizarDiaPendiente]
 * y a su método exclusivo [FakeClienteRepository.limpiarDiaPendiente].
 */
class FakeAsistenciaRepository(
    private val clienteRepository: FakeClienteRepository
) : AsistenciaRepository {

    private val asistenciasFlow = MutableStateFlow<List<Asistencia>>(emptyList())
    private val idCounter = java.util.concurrent.atomic.AtomicInteger(1)

    override fun observarAsistenciasPorFecha(fecha: String): Flow<List<Asistencia>> =
        asistenciasFlow.asStateFlow().map { lista -> lista.filter { it.fecha == fecha } }

    override fun observarAsistenciasPorRango(fechaInicio: String, fechaFin: String): Flow<List<Asistencia>> =
        asistenciasFlow.asStateFlow().map { lista ->
            lista.filter { it.fecha >= fechaInicio && it.fecha <= fechaFin }
        }

    override fun observarTodasAsistencias(): Flow<List<Asistencia>> = asistenciasFlow.asStateFlow()

    override fun observarAsistenciasPorCliente(clienteId: String): Flow<List<Asistencia>> =
        asistenciasFlow.asStateFlow().map { lista -> lista.filter { it.clienteId == clienteId } }

    private fun obtenerExistente(clienteId: String, fecha: String): Asistencia? =
        asistenciasFlow.value.firstOrNull { it.clienteId == clienteId && it.fecha == fecha }

    private fun upsert(asistencia: Asistencia) {
        asistenciasFlow.update { lista ->
            val existente = lista.firstOrNull { it.clienteId == asistencia.clienteId && it.fecha == asistencia.fecha }
            if (existente != null) {
                lista.map { if (it.id == existente.id) asistencia.copy(id = existente.id) else it }
            } else {
                lista + asistencia.copy(id = "fake-asistencia-${idCounter.getAndIncrement()}")
            }
        }
    }

    override suspend fun registrarAsistencia(
        clienteId: String,
        fecha: String,
        asistio: Boolean,
        diaActualIndexPrevio: Int,
        diaRutinaRealizado: Int?,
        totalDiasRutina: Int,
        diaPendienteFechaActual: String?,
        nota: String
    ) {
        val siguienteDiaActualIndex = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
            asistio = asistio,
            diaActualIndexPrevio = diaActualIndexPrevio,
            diaRutinaRealizado = diaRutinaRealizado,
            totalDias = totalDiasRutina
        )

        val existente = obtenerExistente(clienteId, fecha)

        val asistencia = Asistencia(
            clienteId = clienteId,
            fecha = fecha,
            asistio = asistio,
            diaRutinaRealizado = if (asistio) diaRutinaRealizado else null,
            nota = nota,
            horaLlegada = existente?.horaLlegada,
            horaSalida = existente?.horaSalida,
            duracionMinutos = existente?.duracionMinutos
        )

        upsert(asistencia)

        if (asistio) {
            clienteRepository.actualizarDiaPendiente(clienteId, siguienteDiaActualIndex, fecha)
        } else if (diaPendienteFechaActual == fecha) {
            clienteRepository.limpiarDiaPendiente(clienteId)
        }
    }

    override suspend fun iniciarTiempo(
        clienteId: String,
        fecha: String,
        diaActualIndexPrevio: Int,
        totalDiasRutina: Int
    ) {
        val existente = obtenerExistente(clienteId, fecha)

        val diaRutinaRealizado = existente?.diaRutinaRealizado ?: diaActualIndexPrevio

        val asistencia = (existente ?: Asistencia(clienteId = clienteId, fecha = fecha)).copy(
            asistio = true,
            diaRutinaRealizado = diaRutinaRealizado,
            horaLlegada = Timestamp.now(),
            horaSalida = null,
            duracionMinutos = null
        )

        upsert(asistencia)

        if (existente?.diaRutinaRealizado == null) {
            val siguienteDiaActualIndex = RutinaProgressCalculator.calcularSiguienteDiaActualIndex(
                asistio = true,
                diaActualIndexPrevio = diaActualIndexPrevio,
                diaRutinaRealizado = diaRutinaRealizado,
                totalDias = totalDiasRutina
            )
            clienteRepository.actualizarDiaPendiente(clienteId, siguienteDiaActualIndex, fecha)
        }
    }

    override suspend fun detenerTiempo(clienteId: String, fecha: String) {
        val existente = obtenerExistente(clienteId, fecha) ?: return
        val horaLlegada = existente.horaLlegada ?: return
        val ahora = Timestamp.now()
        val duracion = TiempoGymCalculator.calcularDuracionMinutos(
            inicioMillis = horaLlegada.toDate().time,
            finMillis = ahora.toDate().time
        )
        upsert(existente.copy(horaSalida = ahora, duracionMinutos = duracion))
    }

    override suspend fun reiniciarDia(fecha: String, clienteIdsConPendiente: List<String>) {
        asistenciasFlow.update { lista -> lista.filterNot { it.fecha == fecha } }
        clienteIdsConPendiente.forEach { clienteId ->
            clienteRepository.limpiarDiaPendiente(clienteId)
        }
    }

    override suspend fun actualizarDiaRealizado(clienteId: String, fecha: String, nuevoDia: Int) {
        val existente = obtenerExistente(clienteId, fecha) ?: return
        upsert(existente.copy(diaRutinaRealizado = nuevoDia))
    }
}
