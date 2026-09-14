package com.osfit.app.data.repository

import com.google.firebase.Timestamp
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.DiaDenormalizado
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
        edad: Int?,
        segundosPorEjercicio: Int?,
        minutosDescanso: Double?
    )
    suspend fun actualizarActivo(clienteId: String, activo: Boolean)
    suspend fun actualizarCancion(clienteId: String, archivo: String?, ruta: String?, inicioSegundos: Int?)
    /**
     * Escribe SÓLO `cancionRuta`. Lo usa el respaldo cuando la subida termina, que puede ser
     * después de que el entrenador ya guardó y se fue de la pantalla: escribir ahí el resto de
     * los campos pisaría con datos viejos el `cancionArchivo` y el `cancionInicioSegundos` que
     * ese guardado acaba de dejar.
     */
    suspend fun actualizarCancionRuta(clienteId: String, ruta: String?)
    /** "Asignar día": deja el ancla manual. No toca ningún registro de asistencia. */
    suspend fun asignarDiaAncla(clienteId: String, diaIndex: Int, fecha: String)
    suspend fun actualizarProximoPago(clienteId: String, fecha: Timestamp)
    suspend fun actualizarFechaIngreso(clienteId: String, fecha: Timestamp)
    suspend fun actualizarEjercicioFavorito(clienteId: String, diaIndex: Int, ejercicio: String)
    suspend fun actualizarDiaFavorito(clienteId: String, diaIndex: Int)
    /** Refresca el día denormalizado que consume la web. Lo llama SincronizadorDiaWeb. */
    suspend fun actualizarDiaDenormalizado(clienteId: String, valor: DiaDenormalizado)
    suspend fun actualizarTieneAccesoWeb(clienteId: String, tiene: Boolean)
    suspend fun eliminarCliente(clienteId: String)
}
