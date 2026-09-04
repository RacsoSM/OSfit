package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.osfit.app.data.model.CategoriaMedallaAutomatica
import com.osfit.app.data.model.MedallaCatalogo
import com.osfit.app.data.model.MedallaOtorgada
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class MedallaRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val catalogo = db.collection("medallas")
    private fun otorgadasCollection(clienteId: String) =
        db.collection("clientes").document(clienteId).collection("medallas")

    fun observarCatalogo(): Flow<List<MedallaCatalogo>> = callbackFlow {
        val registro = catalogo.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val medallas = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(MedallaCatalogo::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(medallas)
        }
        awaitClose { registro.remove() }
    }

    /** Siembra las 5 categorías automáticas con id fijo (su nombre en minúsculas) si todavía
     *  no existen. Idempotente: nunca pisa una que ya exista, para no perder un nombre o
     *  imagen que el trainer ya haya editado. */
    suspend fun asegurarCategoriasAutomaticas() {
        val existentes = catalogo.get().await().documents.map { it.id }.toSet()
        val faltantes = CategoriaMedallaAutomatica.entries.filter { it.name.lowercase() !in existentes }
        if (faltantes.isEmpty()) return
        val batch = db.batch()
        faltantes.forEach { cat ->
            val medalla = MedallaCatalogo(nombre = nombrePorDefecto(cat), categoria = cat)
            batch.set(catalogo.document(cat.name.lowercase()), medalla.copy(id = ""))
        }
        batch.commit().await()
    }

    private fun nombrePorDefecto(categoria: CategoriaMedallaAutomatica): String = when (categoria) {
        CategoriaMedallaAutomatica.ASISTENCIA -> "Rey de la asistencia"
        CategoriaMedallaAutomatica.TIEMPO -> "Rey del tiempo"
        CategoriaMedallaAutomatica.RACHA -> "Racha imparable"
        CategoriaMedallaAutomatica.ESFUERZO -> "Máquina de entrenar"
        CategoriaMedallaAutomatica.CONSTANCIA -> "El más constante"
    }

    /** [medalla.id] no puede estar vacío: las 5 automáticas usan su nombre de categoría en
     *  minúsculas, y una subjetiva nueva debe traer un id generado por quien llama (ver
     *  MedallasScreen, Task 9) — así la imagen se puede copiar a filesDir/medallas/<id> antes
     *  de guardar el documento, sin depender de un id que Firestore recién genere después. */
    suspend fun guardarMedalla(medalla: MedallaCatalogo) {
        require(medalla.id.isNotBlank()) { "MedallaCatalogo.id no puede estar vacío al guardar" }
        catalogo.document(medalla.id).set(medalla.copy(id = "")).await()
    }

    /** Lanza [IllegalArgumentException] si [medalla] es una de las 5 automáticas: no son
     *  borrables, solo editables (nombre/imagen). */
    suspend fun eliminarMedalla(medalla: MedallaCatalogo) {
        require(medalla.categoria == null) { "No se puede borrar una categoría automática" }
        catalogo.document(medalla.id).delete().await()
    }

    fun observarOtorgadas(clienteId: String): Flow<List<MedallaOtorgada>> = callbackFlow {
        val registro = otorgadasCollection(clienteId)
            .orderBy("rangoInicio", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val otorgadas = snapshot?.documents?.mapNotNull { doc -> doc.toObject(MedallaOtorgada::class.java) } ?: emptyList()
                trySend(otorgadas)
            }
        awaitClose { registro.remove() }
    }

    suspend fun otorgarMedalla(clienteId: String, otorgada: MedallaOtorgada) {
        otorgadasCollection(clienteId).document(otorgada.rangoInicio).set(otorgada).await()
    }
}
