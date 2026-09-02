package com.osfit.app.data.repository

import com.osfit.app.data.model.Asistencia
import kotlinx.coroutines.flow.Flow

interface AsistenciaRepository {
    fun observarAsistenciasPorFecha(fecha: String): Flow<List<Asistencia>>
    fun observarAsistenciasPorRango(fechaInicio: String, fechaFin: String): Flow<List<Asistencia>>
    fun observarTodasAsistencias(): Flow<List<Asistencia>>
    fun observarAsistenciasPorCliente(clienteId: String): Flow<List<Asistencia>>

    suspend fun registrarAsistencia(
        clienteId: String,
        fecha: String,
        asistio: Boolean,
        diaActualIndexPrevio: Int,
        diaRutinaRealizado: Int?,
        totalDiasRutina: Int,
        diaPendienteFechaActual: String?,
        nota: String
    )

    suspend fun iniciarTiempo(
        clienteId: String,
        fecha: String,
        diaActualIndexPrevio: Int,
        totalDiasRutina: Int
    )

    suspend fun detenerTiempo(clienteId: String, fecha: String)
    suspend fun reiniciarDia(fecha: String, clienteIdsConPendiente: List<String>)
    suspend fun actualizarDiaRealizado(clienteId: String, fecha: String, nuevoDia: Int)
}
