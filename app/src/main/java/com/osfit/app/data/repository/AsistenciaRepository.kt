package com.osfit.app.data.repository

import com.osfit.app.data.model.Asistencia
import kotlinx.coroutines.flow.Flow

interface AsistenciaRepository {
    fun observarAsistenciasPorFecha(fecha: String): Flow<List<Asistencia>>
    fun observarAsistenciasPorRango(fechaInicio: String, fechaFin: String): Flow<List<Asistencia>>
    fun observarTodasAsistencias(): Flow<List<Asistencia>>
    fun observarAsistenciasPorCliente(clienteId: String): Flow<List<Asistencia>>

    /**
     * Registra la asistencia del día. Solo escribe el registro: el día que le toca al
     * cliente se deduce de estos registros, así que no hay nada que actualizar en él.
     */
    suspend fun registrarAsistencia(
        clienteId: String,
        fecha: String,
        asistio: Boolean,
        diaRutinaRealizado: Int?,
        nota: String
    )

    /** Iniciar el cronómetro equivale a marcar asistencia del [diaRutinaRealizado] dado. */
    suspend fun iniciarTiempo(
        clienteId: String,
        fecha: String,
        diaRutinaRealizado: Int
    )

    suspend fun detenerTiempo(clienteId: String, fecha: String)
    suspend fun reiniciarDia(fecha: String)
    suspend fun actualizarDiaRealizado(clienteId: String, fecha: String, nuevoDia: Int)

    /**
     * Marca (o desmarca) una falta como justificada. Una falta justificada sigue
     * siendo una falta para las estadísticas, pero cuenta como asistencia para la racha.
     */
    suspend fun justificarFalta(clienteId: String, fecha: String, justificada: Boolean)
}
