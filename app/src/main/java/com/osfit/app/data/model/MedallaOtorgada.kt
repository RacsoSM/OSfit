package com.osfit.app.data.model

data class MedallaOtorgada(
    // ISO date del inicio de la quincena; también el id del documento (upsert por período).
    val rangoInicio: String = "",
    val medallaId: String = "",
    // Copia del nombre al momento de otorgarla: si el catálogo se edita después, el
    // historial en "Logros" no cambia retroactivamente.
    val nombreMedalla: String = "",
    val encabezadoRango: String = "", // "2da quincena de agosto"
    val fueAjustadaManualmente: Boolean = false
)
