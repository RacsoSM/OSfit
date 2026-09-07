package com.osfit.app.data.model

/**
 * Logro que el entrenador define por su cuenta y otorga a mano. A diferencia de
 * [MedallaCatalogo] no tiene categoría: no hay ranking ni fórmula detrás, y por eso tampoco
 * hay siembra automática — el catálogo arranca vacío.
 */
data class LogroPersonalCatalogo(
    val id: String = "",
    val nombre: String = "",
    // Se muestra debajo del logro en la escena del video cuando es el único de su escena.
    // "$nombrePersona" se reemplaza por el nombre del cliente al generar el video.
    val mensaje: String = "",
    // Nombre de archivo en filesDir/logrosPersonales/; null = insignia genérica dibujada por
    // el renderer (no hay imágenes empaquetadas).
    val imagenArchivo: String? = null
)
