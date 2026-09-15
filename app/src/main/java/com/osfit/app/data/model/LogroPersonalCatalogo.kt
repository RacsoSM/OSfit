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
    // Nombre de archivo en filesDir/logrosPersonales/; null = imagen por defecto
    // (R.drawable.logro_personal_default), que resuelve LogroPersonalImagenUtil.
    val imagenArchivo: String? = null,
    // URL de descarga de la misma imagen en Storage, para que la web la pinte con un <img src>.
    // No reemplaza a imagenArchivo: el generador de video sigue leyendo el PNG de filesDir.
    val imagenUrl: String? = null
)
