package com.osfit.app.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.Cliente
import com.osfit.app.data.model.Rutina
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class FirestoreClienteRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) : ClienteRepository {
    private val coleccion = db.collection("clientes")

    override fun observarClientes(): Flow<List<Cliente>> = callbackFlow {
        val registro = coleccion.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val clientes = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(Cliente::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(clientes)
        }
        awaitClose { registro.remove() }
    }

    override fun observarCliente(clienteId: String): Flow<Cliente?> = callbackFlow {
        val registro = coleccion.document(clienteId).addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            trySend(snapshot?.toObject(Cliente::class.java)?.copy(id = snapshot.id))
        }
        awaitClose { registro.remove() }
    }

    override suspend fun crearCliente(nombre: String, telefono: String): String {
        val cliente = Cliente(nombre = nombre, telefono = telefono, activo = true, diaActualIndex = 0)
        val ref = coleccion.add(cliente).await()
        return ref.id
    }

    override suspend fun asignarRutina(clienteId: String, rutina: Rutina) {
        coleccion.document(clienteId).update(
            mapOf(
                "rutinaAsignada" to rutina,
                "plantillaOrigenId" to rutina.id,
                "diaActualIndex" to 0,
                "diaAnclaFecha" to null
            )
        ).await()
    }

    override suspend fun actualizarDatosPersonales(
        clienteId: String,
        nombre: String,
        telefono: String,
        peso: Double?,
        altura: Double?,
        edad: Int?
    ) {
        coleccion.document(clienteId).update(
            mapOf(
                "nombre" to nombre,
                "telefono" to telefono,
                "peso" to peso,
                "altura" to altura,
                "edad" to edad
            )
        ).await()
    }

    override suspend fun actualizarActivo(clienteId: String, activo: Boolean) {
        coleccion.document(clienteId).update("activo", activo).await()
    }

    override suspend fun asignarDiaAncla(clienteId: String, diaIndex: Int, fecha: String) {
        coleccion.document(clienteId).update(
            mapOf("diaActualIndex" to diaIndex, "diaAnclaFecha" to fecha)
        ).await()
    }

    override suspend fun actualizarProximoPago(clienteId: String, fecha: Timestamp) {
        coleccion.document(clienteId).update("fechaProximoPago", fecha).await()
    }

    override suspend fun actualizarFechaIngreso(clienteId: String, fecha: Timestamp) {
        coleccion.document(clienteId).update("fechaIngreso", fecha).await()
    }

    override suspend fun actualizarEjercicioFavorito(clienteId: String, diaIndex: Int, ejercicio: String) {
        coleccion.document(clienteId).update("ejercicioFavoritoPorDia.$diaIndex", ejercicio).await()
    }

    override suspend fun actualizarDiaFavorito(clienteId: String, diaIndex: Int) {
        coleccion.document(clienteId).update("diaFavoritoIndex", diaIndex).await()
    }

    override suspend fun eliminarCliente(clienteId: String) {
        coleccion.document(clienteId).delete().await()
    }
}
