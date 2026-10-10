package com.osfit.app.data.model

/**
 * Los avisos que la función `programarAvisos` manda sola cada mañana a las 9:00 (Mazatlán),
 * solo a las clientas a las que el entrenador se los prendió en el apartado Web. Las llaves
 * son las de [Cliente.avisosAutomaticos] y del campo `automatico` de [Notificacion].
 *
 * GEMELO: `TipoAviso` en `functions/src/avisosAutomaticos.ts`.
 */
enum class AvisoAutomatico(val llave: String, val titulo: String, val descripcion: String) {
    RACHA_PERDIDA(
        "rachaPerdida",
        "Racha perdida",
        "Al día hábil siguiente de perder una racha de 3 días o más; la invita a revivirla."
    ),
    RECORDATORIO_PAGO(
        "recordatorioPago",
        "Recordatorio de pago",
        "2 días antes de que venza su periodo y el mismo día."
    );

    companion object {
        fun deLlave(llave: String): AvisoAutomatico? = entries.firstOrNull { it.llave == llave }
    }
}
