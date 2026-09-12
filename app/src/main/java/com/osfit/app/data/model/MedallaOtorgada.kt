package com.osfit.app.data.model

data class MedallaOtorgada(
    // ISO date del inicio de la quincena; también el id del documento (upsert por período).
    val rangoInicio: String = "",
    val medallaId: String = "",
    // Copia del nombre al momento de otorgarla: si el catálogo se edita después, el
    // historial en "Logros" no cambia retroactivamente.
    val nombreMedalla: String = "",
    // La insignia se copia por el mismo motivo: si el entrenador le cambia el dibujo a la
    // medalla, la que ya se ganó tiene que seguir viéndose como se veía. null = la web dibuja
    // la genérica, que es lo que pasa con todo lo otorgado antes de que existiera este campo.
    val imagenUrl: String? = null,
    val encabezadoRango: String = "", // "2da quincena de agosto"
    val fueAjustadaManualmente: Boolean = false
)
