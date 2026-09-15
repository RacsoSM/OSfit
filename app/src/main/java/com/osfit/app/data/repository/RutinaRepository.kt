package com.osfit.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.osfit.app.data.model.Rutina
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class RutinaRepository(
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val coleccion = db.collection("rutinas")
    private val clientes = db.collection("clientes")

    fun observarRutinas(): Flow<List<Rutina>> = callbackFlow {
        val registro = coleccion.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val rutinas = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(Rutina::class.java)?.copy(id = doc.id)
            } ?: emptyList()
            trySend(rutinas)
        }
        awaitClose { registro.remove() }
    }

    suspend fun obtenerRutina(rutinaId: String): Rutina? {
        val doc = coleccion.document(rutinaId).get().await()
        return doc.toObject(Rutina::class.java)?.copy(id = doc.id)
    }

    /**
     * Guarda la plantilla **y la copia a quienes la siguen**.
     *
     * La copia hace falta porque la página de la clienta no puede leer esta colección:
     * `firestore.rules` concede `rutinas` sólo al entrenador, y abrirla le enseñaría a cada
     * clienta las plantillas de todas. Lo único que su sesión lee es su propio documento, así
     * que la plantilla tiene que llegar ahí.
     *
     * Antes del 2026-09-15 no se copiaba, y el efecto era que **los cambios a una plantilla
     * nunca llegaban a la web**: la app mostraba la plantilla viva y la página de la clienta
     * seguía con la copia congelada del día que se le asignó. Las dos discrepaban en silencio.
     */
    suspend fun guardarRutina(rutina: Rutina): String {
        val id = if (rutina.id.isBlank()) {
            coleccion.add(rutina.copy(id = "")).await().id
        } else {
            coleccion.document(rutina.id).set(rutina.copy(id = "")).await()
            rutina.id
        }
        propagarASeguidoras(rutina.copy(id = id))
        return id
    }

    /**
     * Escribe **sólo** `rutinaAsignada`. Ni `diaActualIndex` ni `diaAnclaFecha` ni
     * `plantillaOrigenId`: editar los ejercicios de una plantilla no debe moverle el día del
     * ciclo a nadie, y quien la sigue la sigue igual que antes.
     *
     * Quien tiene rutina propia queda fuera por construcción: al desprenderse se le borró
     * `plantillaOrigenId`, así que este filtro no la encuentra y sus ejercicios no se pisan.
     */
    private suspend fun propagarASeguidoras(rutina: Rutina) {
        if (rutina.id.isBlank()) return
        val seguidoras = clientes.whereEqualTo("plantillaOrigenId", rutina.id).get().await()
        // En lotes porque Firestore rechaza el batch entero pasadas las 500 escrituras, y un
        // gimnasio puede crecer hasta ahí sin que nadie vuelva a mirar esta línea.
        seguidoras.documents.chunked(400).forEach { grupo ->
            val lote = db.batch()
            grupo.forEach { doc -> lote.update(doc.reference, "rutinaAsignada", rutina) }
            lote.commit().await()
        }
    }

    suspend fun eliminarRutina(rutinaId: String) {
        coleccion.document(rutinaId).delete().await()
    }
}
