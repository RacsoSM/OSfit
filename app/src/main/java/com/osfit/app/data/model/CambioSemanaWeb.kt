package com.osfit.app.data.model

import com.google.firebase.Timestamp

/**
 * Cambio de semana del ciclo de RPE que la clienta hizo ella misma desde la web (función
 * `cambiarSemana`, 2026-11-26). Alimenta el indicador del entrenador en el calendario.
 *
 * `semana` es la del bloque de 4: 1 Base, 2 Carga, 3 Fuerza, 4 Descarga (ver
 * `web/src/ciclo.ts`). Doc id: "<clienteId>_<fecha>", como `CambioDiaWeb`: si cambia dos veces
 * el mismo día, la segunda pisa a la primera.
 */
data class CambioSemanaWeb(
    val clienteId: String = "",
    val fecha: String = "",
    val semana: Int = 0,
    val creado: Timestamp = Timestamp.now()
) {
    companion object {
        private val FASES = listOf("Base", "Carga", "Fuerza", "Descarga")

        /** "Descarga" para la semana 4; null si la semana no existe. */
        fun nombreDeSemana(semana: Int): String? = FASES.getOrNull(semana - 1)
    }
}
