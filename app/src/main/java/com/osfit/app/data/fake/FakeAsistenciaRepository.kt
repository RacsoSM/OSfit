package com.osfit.app.data.fake

import com.google.firebase.Timestamp
import com.osfit.app.data.model.Asistencia
import com.osfit.app.data.repository.AsistenciaRepository
import com.osfit.app.domain.TiempoGymCalculator
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/**
 * Implementación 100% en memoria de [AsistenciaRepository], usada por el modo sandbox.
 * Solo guarda registros de asistencia: el día que le toca a cada cliente se deduce de
 * ellos, así que ya no necesita tocar el repositorio de clientes.
 */
class FakeAsistenciaRepository : AsistenciaRepository {

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
        diaRutinaRealizado: Int?,
        nota: String
    ) {
        val existente = obtenerExistente(clienteId, fecha)
        // Solo se escribe el registro: el día del cliente se deduce de estos registros.
        upsert(
            Asistencia(
                clienteId = clienteId,
                fecha = fecha,
                asistio = asistio,
                diaRutinaRealizado = if (asistio) diaRutinaRealizado else null,
                nota = nota,
                horaLlegada = existente?.horaLlegada,
                horaSalida = existente?.horaSalida,
                duracionMinutos = existente?.duracionMinutos
            )
        )
    }

    override suspend fun iniciarTiempo(
        clienteId: String,
        fecha: String,
        diaRutinaRealizado: Int
    ) {
        val existente = obtenerExistente(clienteId, fecha)
        // Respeta un día ya registrado, para no pisar una corrección hecha en la pestaña Rutina.
        val dia = existente?.diaRutinaRealizado ?: diaRutinaRealizado
        upsert(
            (existente ?: Asistencia(clienteId = clienteId, fecha = fecha)).copy(
                asistio = true,
                diaRutinaRealizado = dia,
                horaLlegada = Timestamp.now(),
                horaSalida = null,
                duracionMinutos = null
            )
        )
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

    override suspend fun reiniciarDia(fecha: String) {
        asistenciasFlow.update { lista -> lista.filterNot { it.fecha == fecha } }
    }

    override suspend fun actualizarDiaRealizado(clienteId: String, fecha: String, nuevoDia: Int) {
        val existente = obtenerExistente(clienteId, fecha) ?: return
        upsert(existente.copy(diaRutinaRealizado = nuevoDia))
    }
}
