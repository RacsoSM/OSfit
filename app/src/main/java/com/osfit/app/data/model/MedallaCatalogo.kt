package com.osfit.app.data.model

enum class CategoriaMedallaAutomatica { ASISTENCIA, TIEMPO, RACHA, ESFUERZO, CONSTANCIA }

data class MedallaCatalogo(
    val id: String = "",
    val nombre: String = "",
    // null = medalla subjetiva (creada y otorgada manualmente, sin fórmula de ranking).
    val categoria: CategoriaMedallaAutomatica? = null,
    // Nombre de archivo en filesDir/medallas/; null = usa la insignia por defecto de la
    // categoría (dibujada por el renderer, no hay imagen empaquetada) o el ícono genérico
    // si es subjetiva sin imagen propia.
    val imagenArchivo: String? = null
)
