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

    /** Siembra las 5 categorías automáticas con id fijo (su nombre en minúsculas) si todavía no
     *  existen, y de paso les rellena el mensaje por defecto si vino vacío (campo agregado
     *  después de la siembra original). Nunca pisa un nombre/imagen/mensaje que el trainer ya
     *  haya editado. */
    suspend fun asegurarCategoriasAutomaticas() {
        val existentes = catalogo.get().await().documents.associateBy { it.id }
        val batch = db.batch()
        var hayCambios = false
        CategoriaMedallaAutomatica.entries.forEach { cat ->
            val id = cat.name.lowercase()
            val doc = existentes[id]
            if (doc == null) {
                val medalla = MedallaCatalogo(nombre = nombrePorDefecto(cat), categoria = cat, mensaje = mensajePorDefecto(cat))
                batch.set(catalogo.document(id), medalla.copy(id = ""))
                hayCambios = true
            } else if (doc.getString("mensaje").isNullOrBlank()) {
                batch.update(catalogo.document(id), "mensaje", mensajePorDefecto(cat))
                hayCambios = true
            }
        }
        if (hayCambios) batch.commit().await()
    }

    private fun nombrePorDefecto(categoria: CategoriaMedallaAutomatica): String = when (categoria) {
        CategoriaMedallaAutomatica.ASISTENCIA -> "Rey de la asistencia"
        CategoriaMedallaAutomatica.TIEMPO -> "Rey del tiempo"
        CategoriaMedallaAutomatica.RACHA -> "Racha imparable"
        CategoriaMedallaAutomatica.ESFUERZO -> "Máquina de entrenar"
        CategoriaMedallaAutomatica.CONSTANCIA -> "El más constante"
    }

    private fun mensajePorDefecto(categoria: CategoriaMedallaAutomatica): String = when (categoria) {
        CategoriaMedallaAutomatica.ASISTENCIA -> "Sorprendentemente, tienes el record de asistencia, sigue así, vas excelente!"
        CategoriaMedallaAutomatica.TIEMPO -> "Eres la persona que más tiempo estuvo en el gimnasio este periodo, se ve que te agrada estar con nosotros, esperamos que sigas así jajajaj"
        CategoriaMedallaAutomatica.RACHA -> "Lograste mantener la racha más larga de todas en este periodo, Felicidades!"
        CategoriaMedallaAutomatica.ESFUERZO -> "Eres la persona que más se está esforzando y eso merece mucho reconocimiento, sigue con ese ritmo \$nombrePersona"
        CategoriaMedallaAutomatica.CONSTANCIA -> "Eres la persona que más está enfocada en el gimnasio, sigue así!"
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

    /** Quita una insignia ya otorgada (p. ej. desde "Logros", fuera del flujo de resumen). */
    suspend fun quitarMedalla(clienteId: String, rangoInicio: String) {
        otorgadasCollection(clienteId).document(rangoInicio).delete().await()
    }
}
