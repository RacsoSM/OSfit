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
    /**
     * Deja la rutina como **propia** del cliente: congela `rutina` en `rutinaAsignada` y borra
     * `plantillaOrigenId`, que es lo único que discrimina los dos modos (spec
     * `2026-09-15-rutinas-en-la-web-design.md`). No se agrega un campo de "modo" porque serían
     * dos fuentes de verdad capaces de contradecirse.
     *
     * A diferencia de `asignarRutina`, **no toca `diaActualIndex` ni `diaAnclaFecha`**: el día
     * del ciclo y el origen de la rutina son cosas distintas, y moverlo acá le cambiaría el día
     * al cliente sin motivo.
     */
    suspend fun guardarRutinaPropia(clienteId: String, rutina: Rutina)
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

    /**
     * Los pesos y notas propios de esta clienta, por nombre de ejercicio.
     *
     * Escribe el mapa **entero** y no una clave suelta: las claves son nombres de ejercicio
     * escritos por una persona y pueden traer puntos ("Press 3.5"), que en una ruta de campo de
     * Firestore (`pesoPorEjercicio.$clave`) se interpretarían como anidamiento y crearían un
     * documento con la forma equivocada.
     */
    suspend fun actualizarPesosPropios(clienteId: String, pesos: Map<String, String>)
    suspend fun actualizarDiaFavorito(clienteId: String, diaIndex: Int)
    /** Refresca el día denormalizado que consume la web. Lo llama SincronizadorDiaWeb. */
    suspend fun actualizarDiaDenormalizado(clienteId: String, valor: DiaDenormalizado)
    suspend fun actualizarTieneAccesoWeb(clienteId: String, tiene: Boolean)
    suspend fun eliminarCliente(clienteId: String)
}
