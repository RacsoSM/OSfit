package com.osfit.app.data.fake

import com.google.firebase.Timestamp
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.DiaRutina
import com.osfit.app.data.model.Ejercicio
import com.osfit.app.data.model.Rutina
import com.osfit.app.data.repository.ClienteRepository
import java.time.LocalDate
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update

/**
 * Implementación 100% en memoria de [ClienteRepository], usada por el modo sandbox
 * para probar manualmente el avance de día de rutina sin tocar Firestore.
 */
class FakeClienteRepository : ClienteRepository {

    private fun ejercicios(prefijo: String): List<Ejercicio> = listOf(
        Ejercicio(nombre = "$prefijo 1", series = 4, repeticiones = "8-10", pesoONota = ""),
        Ejercicio(nombre = "$prefijo 2", series = 3, repeticiones = "10-12", pesoONota = "")
    )

    private fun rutinaDe4Dias(nombre: String): Rutina = Rutina(
        id = "rutina-$nombre",
        nombre = nombre,
        dias = listOf(
            DiaRutina(nombreDia = "Empuje", ejercicios = ejercicios("Press")),
            DiaRutina(nombreDia = "Tirón", ejercicios = ejercicios("Remo")),
            DiaRutina(nombreDia = "Pierna", ejercicios = ejercicios("Sentadilla")),
            DiaRutina(nombreDia = "Full Body", ejercicios = ejercicios("Peso muerto"))
        )
    )

    private fun rutinaDe3Dias(nombre: String): Rutina = Rutina(
        id = "rutina-$nombre",
        nombre = nombre,
        dias = listOf(
            DiaRutina(nombreDia = "Empuje", ejercicios = ejercicios("Press")),
            DiaRutina(nombreDia = "Tirón", ejercicios = ejercicios("Remo")),
            DiaRutina(nombreDia = "Pierna", ejercicios = ejercicios("Sentadilla"))
        )
    )

    private val idCounter = AtomicInteger(5)

    private val clientesIniciales: List<Cliente> = listOf(
        // a. A mitad de ciclo, sin día pendiente.
        Cliente(
            id = "1",
            nombre = "Ana Mitad de Ciclo",
            telefono = "555-0001",
            activo = true,
            rutinaAsignada = rutinaDe4Dias("Ana"),
            plantillaOrigenId = "rutina-Ana",
            diaActualIndex = 1,
            diaPendienteIndex = null,
            diaPendienteFecha = null
        ),
        // b. En el último día de su ciclo: sirve para probar el wraparound a día 0.
        Cliente(
            id = "2",
            nombre = "Beto Último Día",
            telefono = "555-0002",
            activo = true,
            rutinaAsignada = rutinaDe3Dias("Beto"),
            plantillaOrigenId = "rutina-Beto",
            diaActualIndex = 2,
            diaPendienteIndex = null,
            diaPendienteFecha = null
        ),
        // c. Con día pendiente "vencido": diaEfectivo ya debería reportar el pendiente.
        Cliente(
            id = "3",
            nombre = "Carla Pendiente Vencido",
            telefono = "555-0003",
            activo = true,
            rutinaAsignada = rutinaDe4Dias("Carla"),
            plantillaOrigenId = "rutina-Carla",
            diaActualIndex = 0,
            diaPendienteIndex = 1,
            diaPendienteFecha = LocalDate.now().minusDays(3).toString()
        ),
        // d. Sin rutina asignada.
        Cliente(
            id = "4",
            nombre = "Diego Sin Rutina",
            telefono = "555-0004",
            activo = true,
            rutinaAsignada = null,
            plantillaOrigenId = "",
            diaActualIndex = 0,
            diaPendienteIndex = null,
            diaPendienteFecha = null
        )
    )

    private val clientesFlow = MutableStateFlow(clientesIniciales)

    override fun observarClientes(): Flow<List<Cliente>> = clientesFlow.asStateFlow()

    override fun observarCliente(clienteId: String): Flow<Cliente?> =
        clientesFlow.asStateFlow().map { lista -> lista.firstOrNull { it.id == clienteId } }

    override suspend fun crearCliente(nombre: String, telefono: String): String {
        val id = "fake-${idCounter.getAndIncrement()}"
        val cliente = Cliente(
            id = id,
            nombre = nombre,
            telefono = telefono,
            activo = true,
            diaActualIndex = 0
        )
        clientesFlow.update { it + cliente }
        return id
    }

    override suspend fun asignarRutina(clienteId: String, rutina: Rutina) {
        actualizarCliente(clienteId) {
            it.copy(
                rutinaAsignada = rutina,
                plantillaOrigenId = rutina.id,
                diaActualIndex = 0,
                diaPendienteIndex = null,
                diaPendienteFecha = null
            )
        }
    }

    override suspend fun actualizarDatosPersonales(
        clienteId: String,
        nombre: String,
        telefono: String,
        peso: Double?,
        altura: Double?,
        edad: Int?
    ) {
        actualizarCliente(clienteId) {
            it.copy(nombre = nombre, telefono = telefono, peso = peso, altura = altura, edad = edad)
        }
    }

    override suspend fun actualizarActivo(clienteId: String, activo: Boolean) {
        actualizarCliente(clienteId) { it.copy(activo = activo) }
    }

    override suspend fun actualizarDiaActual(clienteId: String, diaIndex: Int) {
        actualizarCliente(clienteId) {
            it.copy(diaActualIndex = diaIndex, diaPendienteIndex = null, diaPendienteFecha = null)
        }
    }

    override suspend fun actualizarDiaPendiente(clienteId: String, diaIndex: Int, fecha: String) {
        actualizarCliente(clienteId) {
            it.copy(diaPendienteIndex = diaIndex, diaPendienteFecha = fecha)
        }
    }

    override suspend fun actualizarProximoPago(clienteId: String, fecha: Timestamp) {
        actualizarCliente(clienteId) { it.copy(fechaProximoPago = fecha) }
    }

    override suspend fun actualizarFechaIngreso(clienteId: String, fecha: Timestamp) {
        actualizarCliente(clienteId) { it.copy(fechaIngreso = fecha) }
    }

    override suspend fun actualizarEjercicioFavorito(clienteId: String, diaIndex: Int, ejercicio: String) {
        actualizarCliente(clienteId) {
            it.copy(ejercicioFavoritoPorDia = it.ejercicioFavoritoPorDia + (diaIndex.toString() to ejercicio))
        }
    }

    override suspend fun actualizarDiaFavorito(clienteId: String, diaIndex: Int) {
        actualizarCliente(clienteId) { it.copy(diaFavoritoIndex = diaIndex) }
    }

    override suspend fun eliminarCliente(clienteId: String) {
        clientesFlow.update { lista -> lista.filterNot { it.id == clienteId } }
    }

    /**
     * Método exclusivo del fake (no forma parte de [ClienteRepository]): limpia el día
     * pendiente de un cliente, replicando lo que hace inline
     * [com.osfit.app.data.repository.FirestoreAsistenciaRepository.registrarAsistencia]
     * cuando se marca "Faltó" en la fecha del pendiente actual.
     */
    suspend fun limpiarDiaPendiente(clienteId: String) {
        actualizarCliente(clienteId) { it.copy(diaPendienteIndex = null, diaPendienteFecha = null) }
    }

    /**
     * Método exclusivo del fake: escribe de una sola vez el día actual consolidado y el
     * pendiente, replicando el batch de
     * [com.osfit.app.data.repository.FirestoreAsistenciaRepository] que actualiza los tres
     * campos juntos al registrar asistencia o iniciar el tiempo.
     */
    suspend fun aplicarProgreso(
        clienteId: String,
        diaActualIndex: Int,
        diaPendienteIndex: Int?,
        diaPendienteFecha: String?
    ) {
        actualizarCliente(clienteId) {
            it.copy(
                diaActualIndex = diaActualIndex,
                diaPendienteIndex = diaPendienteIndex,
                diaPendienteFecha = diaPendienteFecha
            )
        }
    }

    private fun actualizarCliente(clienteId: String, transform: (Cliente) -> Cliente) {
        clientesFlow.update { lista ->
            lista.map { cliente -> if (cliente.id == clienteId) transform(cliente) else cliente }
        }
    }
}
