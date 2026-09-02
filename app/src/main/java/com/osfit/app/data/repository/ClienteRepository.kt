package com.osfit.app.data.repository

import com.google.firebase.Timestamp
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Rutina
import kotlinx.coroutines.flow.Flow

interface ClienteRepository {
    fun observarClientes(): Flow<List<Cliente>>
    fun observarCliente(clienteId: String): Flow<Cliente?>
    suspend fun crearCliente(nombre: String, telefono: String): String
    suspend fun asignarRutina(clienteId: String, rutina: Rutina)
    suspend fun actualizarDatosPersonales(
        clienteId: String,
        nombre: String,
        telefono: String,
        peso: Double?,
        altura: Double?,
        edad: Int?
    )
    suspend fun actualizarActivo(clienteId: String, activo: Boolean)
    /** "Asignar día": deja el ancla manual. No toca ningún registro de asistencia. */
    suspend fun asignarDiaAncla(clienteId: String, diaIndex: Int, fecha: String)
    suspend fun actualizarProximoPago(clienteId: String, fecha: Timestamp)
    suspend fun actualizarFechaIngreso(clienteId: String, fecha: Timestamp)
    suspend fun actualizarEjercicioFavorito(clienteId: String, diaIndex: Int, ejercicio: String)
    suspend fun actualizarDiaFavorito(clienteId: String, diaIndex: Int)
    suspend fun eliminarCliente(clienteId: String)
}
