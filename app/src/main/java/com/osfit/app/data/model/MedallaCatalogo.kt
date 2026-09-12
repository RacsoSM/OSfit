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
    val imagenArchivo: String? = null,
    // URL de descarga de la misma imagen en Storage, para que la web la pinte con un <img src>.
    // No reemplaza a imagenArchivo: el generador de video sigue leyendo el PNG de filesDir.
    val imagenUrl: String? = null,
    // Se muestra debajo de la medalla en la escena del video cuando se otorga. "$nombrePersona"
    // se reemplaza por el nombre del cliente al generar el video.
    val mensaje: String = ""
)
