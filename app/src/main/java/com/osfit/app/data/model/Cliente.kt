package com.osfit.app.data.model

import com.google.firebase.Timestamp

data class Cliente(
    val id: String = "",
    val nombre: String = "",
    val telefono: String = "",
    val activo: Boolean = true,
    val rutinaAsignada: Rutina? = null,
    val plantillaOrigenId: String = "",
    // Ancla de "Asignar día": el día asignado manualmente y desde cuándo vale. El día que
    // le toca al cliente se deduce del historial de asistencias (Calendario-Rutina); el
    // ancla solo manda mientras no haya asistencias posteriores a su fecha.
    val diaActualIndex: Int = 0,
    val diaAnclaFecha: String? = null,
    // Obsoletos: ya no se escriben. Se conservan solo para congelar el día de los clientes
    // que existían antes de que Calendario-Rutina pasara a ser la fuente de verdad.
    // Ver RutinaProgressCalculator.FECHA_CORTE.
    @Deprecated("Reemplazado por la derivación desde asistencias")
    val diaPendienteIndex: Int? = null,
    @Deprecated("Reemplazado por la derivación desde asistencias")
    val diaPendienteFecha: String? = null,
    val fechaProximoPago: Timestamp? = null,
    val fechaIngreso: Timestamp? = null,
    val ejercicioFavoritoPorDia: Map<String, String> = emptyMap(),
    val diaFavoritoIndex: Int? = null,
    val peso: Double? = null,
    val altura: Double? = null,
    val edad: Int? = null,
    val segundosPorEjercicio: Int? = null,
    val minutosDescanso: Double? = null,
    // Nombre del archivo dentro de filesDir/canciones/ (no la URI original: se copia al
    // elegirla para no depender de un permiso de content:// que puede revocarse).
    val cancionArchivo: String? = null,
    val cancionInicioSegundos: Int? = null
)
